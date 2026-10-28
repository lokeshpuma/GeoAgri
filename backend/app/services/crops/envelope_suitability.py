"""
Transparent agro-climatic suitability scoring for any crop in the global registry.

Method: the EcoCrop limiting-factor approach (Hackett 1991; also used in DIVA-GIS and the R
package Recocrop). Each factor is scored 0..1 with a trapezoid built from the crop's
min / optimum-min / optimum-max / max values. The overall score is the most limiting factor
(Liebig's law of the minimum), evaluated for every possible planting month; the best month wins.

This is NOT a trained model and not a yield forecast. It says how well the site's climate
and soil sit inside the crop's published envelope. Tier "A" crops are additionally covered by the
yield models; Tier "B" crops get this score only, and the API must label it that way.

Inputs are plain numbers, so the scorer has no dependency on the rest of the app.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable, Optional

REGISTRY_PATH = Path(__file__).resolve().parents[3] / "ml" / "data" / "processed" / "crop_registry_global.json"

GRADES = ((0.80, "excellent"), (0.60, "good"), (0.30, "marginal"), (0.0, "unsuitable"))


def trapezoid(x: float, lo: float, opt_lo: float, opt_hi: float, hi: float) -> float:
    """0 outside [lo, hi], 1 inside [opt_lo, opt_hi], linear in between."""
    if x is None or math.isnan(x):
        raise ValueError("trapezoid() needs a real number")
    if x <= lo or x >= hi:
        return 0.0
    if opt_lo <= x <= opt_hi:
        return 1.0
    if x < opt_lo:
        return (x - lo) / (opt_lo - lo) if opt_lo > lo else 1.0
    return (hi - x) / (hi - opt_hi) if hi > opt_hi else 1.0


def grade(score: float) -> str:
    for threshold, label in GRADES:
        if score >= threshold:
            return label
    return "unsuitable"


@dataclass
class Site:
    """Climate and soil of one location. Monthly lists have 12 values, January first."""
    monthly_temp_c: list[float]
    monthly_rain_mm: list[float]
    ph: Optional[float] = None
    absolute_min_temp_c: Optional[float] = None   # coldest night of the year, if known
    altitude_m: Optional[float] = None
    soil_texture: Optional[str] = None            # "light" | "medium" | "heavy" | "organic"
    irrigated: bool = False                       # True: rainfall factor is not limiting

    def validate(self) -> None:
        if len(self.monthly_temp_c) != 12 or len(self.monthly_rain_mm) != 12:
            raise ValueError("monthly_temp_c and monthly_rain_mm need exactly 12 values")
        if any(v is None or math.isnan(v) for v in self.monthly_temp_c + self.monthly_rain_mm):
            raise ValueError("monthly climate values must be real numbers (no missing values)")


@dataclass
class CropScore:
    crop_id: str
    common_name: str
    scientific_name: str
    category: str
    score: float                        # for the site's water mode (rainfed or irrigated)
    grade: str
    limiting_factor: str
    score_rainfed: float
    score_irrigated: float
    best_planting_month: int            # 1 = January
    season_months: int
    confidence_tier: str
    method: str = "ecocrop_envelope"
    factors: dict[str, float] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return self.__dict__.copy()


@lru_cache(maxsize=1)
def load_registry(path: str | None = None) -> list[dict[str, Any]]:
    p = Path(path) if path else REGISTRY_PATH
    if not p.exists():
        raise FileNotFoundError(
            f"Global crop registry not found at {p}. Run backend/ml/training/build_global_crop_registry.py"
        )
    return json.loads(p.read_text())


def season_length_months(crop: dict[str, Any]) -> int:
    """Growing-season length in months, following the Recocrop rule: the shortest cycle in the
    database (GMIN) plus one month of slack, unless GMIN equals GMAX. Perennials use all 12."""
    gmin, gmax = crop.get("growth_cycle_days") or (None, None)
    span = (crop.get("life_span") or "").lower()
    if gmin is None and gmax is None:
        return 12
    lo = gmin if gmin is not None else gmax
    hi = gmax if gmax is not None else gmin
    if "perennial" in span or lo >= 330:
        return 12
    months = math.ceil(lo / 30.0)
    if hi != lo:
        months += 1
    return max(1, min(12, months))


def _window(values: list[float], start: int, length: int) -> list[float]:
    return [values[(start + i) % 12] for i in range(length)]


def score_crop(crop: dict[str, Any], site: Site) -> CropScore:
    site.validate()
    length = season_length_months(crop)
    t, r, h = crop["temp_c"], crop["rainfall_mm"], crop["ph"]
    notes: list[str] = []

    best: Optional[tuple[float, int, dict[str, float], float, float]] = None
    for start in range(12):
        temps = _window(site.monthly_temp_c, start, length)
        rain_total = sum(_window(site.monthly_rain_mm, start, length))

        # Temperature: the coldest or hottest month of the season limits the crop.
        f_temp = min(trapezoid(x, t["min"], t["opt_min"], t["opt_max"], t["max"]) for x in temps)

        # Rainfall: EcoCrop rainfall values are for a full year. For a shorter season the envelope
        # is scaled by (season months + 1) / 12, the same rule Recocrop uses.
        scale = 1.0 if length >= 12 else min(1.0, (length + 1) / 12.0)
        f_rain = trapezoid(rain_total, r["min"] * scale, r["opt_min"] * scale, r["opt_max"] * scale, r["max"] * scale)

        factors = {"temperature": f_temp, "rainfall": f_rain}
        if site.ph is not None:
            factors["ph"] = trapezoid(site.ph, h["min"], h["opt_min"], h["opt_max"], h["max"])

        if site.absolute_min_temp_c is not None and crop.get("killing_temp_c") is not None:
            if site.absolute_min_temp_c < crop["killing_temp_c"] and length >= 12:
                factors["frost"] = 0.0
        if site.altitude_m is not None and crop.get("altitude_max_m"):
            amax = crop["altitude_max_m"]
            factors["altitude"] = 1.0 if site.altitude_m <= amax else max(0.0, 1.0 - (site.altitude_m - amax) / (0.25 * amax))

        others = [v for k, v in factors.items() if k != "rainfall"]
        irrigated_score = min(others)
        rainfed_score = min(factors.values())
        score = irrigated_score if site.irrigated else rainfed_score
        if best is None or score > best[0]:
            best = (score, start, factors, rainfed_score, irrigated_score)

    assert best is not None
    score, start, factors, rainfed_score, irrigated_score = best

    # Soft soil-texture adjustment (never a hard limit, texture classes are coarse).
    if site.soil_texture and crop.get("soil_texture_range"):
        if site.soil_texture.lower() not in [x.lower() for x in crop["soil_texture_range"]]:
            score *= 0.85
            rainfed_score *= 0.85
            irrigated_score *= 0.85
            factors["texture"] = 0.85
            notes.append(f"{site.soil_texture} soil is outside the crop's preferred textures")
    if site.ph is None:
        notes.append("Soil pH not provided, so pH was not scored")
    if site.irrigated:
        notes.append("Scored as irrigated: rainfall is not treated as a limit")
    elif irrigated_score - rainfed_score >= 0.3:
        notes.append("Much better with irrigation: rainfall alone limits this crop here")

    limiting = min(factors, key=lambda k: factors[k])
    return CropScore(
        crop_id=crop["crop_id"],
        common_name=crop["common_name"],
        scientific_name=crop["scientific_name"],
        category=crop["category"],
        score=round(score, 3),
        grade=grade(score),
        score_rainfed=round(rainfed_score, 3),
        score_irrigated=round(irrigated_score, 3),
        limiting_factor=(limiting if not site.irrigated or limiting != "rainfall" else
                         min((k for k in factors if k != "rainfall"), key=lambda k: factors[k])) if score < 0.999 else "none",
        best_planting_month=start + 1,
        season_months=length,
        confidence_tier=crop["confidence_tier"],
        factors={k: round(v, 3) for k, v in factors.items()},
        notes=notes,
    )


def rank_crops(
    site: Site,
    top_n: int = 15,
    include_all_categories: bool = False,
    categories: Optional[Iterable[str]] = None,
    min_grade_score: float = 0.30,
    registry: Optional[list[dict[str, Any]]] = None,
) -> list[CropScore]:
    """Rank every crop in the registry for this site. Unsuitable crops are dropped, never padded."""
    reg = registry if registry is not None else load_registry()
    wanted = set(categories) if categories else None
    out: list[CropScore] = []
    for crop in reg:
        if wanted is not None:
            if crop["category"] not in wanted:
                continue
        elif not include_all_categories and not crop.get("recommendable", False):
            continue
        s = score_crop(crop, site)
        if s.score >= min_grade_score:
            out.append(s)
    out.sort(key=lambda c: (-c.score, c.confidence_tier, c.common_name))
    return out[:top_n]
