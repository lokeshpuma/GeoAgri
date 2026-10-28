"""
Build the global crop registry from the FAO EcoCrop export.

    python backend/ml/training/build_global_crop_registry.py

Reads   backend/ml/data/raw/external/ecocrop/EcoCrop_DB.csv
Writes  backend/ml/data/processed/crop_registry_global.json
        backend/ml/data/processed/crop_registry_global_report.json

Honesty rules
- Every row comes from the EcoCrop file. Nothing is invented.
- A row is kept only if it has a full temperature, rainfall and pH envelope that is
  internally consistent (min <= optimum_min <= optimum_max <= max). Rows that fail are
  counted in the report with the reason, not repaired silently.
- confidence_tier "B" = envelope only (no yield ground truth).
  confidence_tier "A" = envelope AND real yield data for that crop in the existing local
  registry (ml/data/processed/crop_registry.json). When FAOSTAT yield data is added
  (see PRD v3.2 section 9) crops with a FAOSTAT yield series are promoted to "A".
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]  # backend/ml
RAW = ROOT / "data" / "raw" / "external" / "ecocrop" / "EcoCrop_DB.csv"
LEGACY = ROOT / "data" / "processed" / "crop_registry.json"
OUT = ROOT / "data" / "processed" / "crop_registry_global.json"
REPORT = ROOT / "data" / "processed" / "crop_registry_global_report.json"

# EcoCrop CAT tokens (exact, from the file) -> GeoAgri category. Priority order: food and
# commercial crops first, so a species tagged both "vegetables" and "ornamentals" is a vegetable.
CATEGORY_PRIORITY = [
    ("cereals & pseudocereals", "cereal"),
    ("pulses (grain legumes)", "pulse"),
    ("roots/tubers", "root_tuber"),
    ("vegetables", "vegetable"),
    ("fruits & nuts", "fruit_nut"),
    ("medicinals & aromatic", "medicinal_aromatic"),
    ("materials", "materials"),
    ("forage/pasture", "fodder"),
    ("cover crop", "cover_crop"),
    ("forest/wood", "agroforestry"),
    ("ornamentals/turf", "ornamental"),
    ("environmental", "environmental"),
    ("weed", "weed"),
]
# Categories offered as crop recommendations by default. Ornamental, weed, environmental and
# forestry-only species stay in the registry but are opt-in (include_all_categories=True).
RECOMMENDABLE = {"cereal", "pulse", "root_tuber", "vegetable", "fruit_nut",
                 "medicinal_aromatic", "materials", "fodder", "cover_crop"}
LEGUME_FAMILIES = {"Leguminosae", "Fabaceae", "Papilionaceae", "Mimosaceae", "Caesalpiniaceae"}

COLS = {
    "temp": ["TMIN", "TOPMN", "TOPMX", "TMAX"],
    "rain": ["RMIN", "ROPMN", "ROPMX", "RMAX"],
    "ph": ["PHMIN", "PHOPMN", "PHOPMX", "PHMAX"],
}


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def family_of(famname: object) -> str | None:
    if not isinstance(famname, str) or not famname.strip():
        return None
    return famname.split(":")[-1].strip() or None


def categories_of(cat: object) -> list[str]:
    text = str(cat).lower() if isinstance(cat, str) else ""
    return [label for needle, label in CATEGORY_PRIORITY if needle in text]


def category_of(cat: object) -> str:
    found = categories_of(cat)
    return found[0] if found else "other"


def first_common_name(com: object) -> str | None:
    if not isinstance(com, str):
        return None
    for part in com.split(","):
        name = part.strip()
        # skip names with broken legacy encoding characters
        if name and name.isascii() and 2 < len(name) < 40:
            return name
    return None


def ordered(vals: list[float]) -> bool:
    return all(not np.isnan(v) for v in vals) and vals[0] <= vals[1] <= vals[2] <= vals[3]


def split_list(text: object) -> list[str]:
    if not isinstance(text, str):
        return []
    return [t.strip() for t in text.split(",") if t.strip()]


LEGACY_CATEGORY = {  # GeoAgri legacy registry category -> new category (used only when EcoCrop has no CAT)
    "cereals": "cereal", "pulses": "pulse", "oilseeds": "materials", "fibre": "materials",
    "fibres": "materials", "cash_crops": "materials", "plantation": "materials", "tubers": "root_tuber",
    "vegetables": "vegetable", "fruits": "fruit_nut", "nuts": "fruit_nut", "spices": "medicinal_aromatic",
    "medicinal": "medicinal_aromatic", "fodder": "fodder", "cereal": "cereal", "pulse": "pulse",
    "oilseed": "materials", "vegetable": "vegetable", "fruit": "fruit_nut", "spice_medicinal": "medicinal_aromatic",
}


def main() -> None:
    df = pd.read_csv(RAW, encoding="latin-1", low_memory=False)
    legacy_ids: set[str] = set()
    legacy_cat: dict[str, str] = {}
    if LEGACY.exists():
        for c in json.loads(LEGACY.read_text()):
            legacy_cat[c["crop_id"]] = c.get("category", "")
            legacy_cat[slug(c["crop_name"])] = c.get("category", "")
        legacy_ids = {slug(c["crop_name"]) for c in json.loads(LEGACY.read_text())}
        legacy_ids |= {c["crop_id"] for c in json.loads(LEGACY.read_text())}

    for col in sum(COLS.values(), []) + ["ALTMX", "GMIN", "GMAX", "KTMP", "LATMN", "LATMX"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    rejected = {"missing_envelope": 0, "inconsistent_order": 0, "implausible_range": 0, "duplicate": 0}
    rows, seen = [], set()
    for _, r in df.iterrows():
        sci = str(r["ScientificName"]).strip()
        t = [r[c] for c in COLS["temp"]]
        p = [r[c] for c in COLS["rain"]]
        h = [r[c] for c in COLS["ph"]]
        if any(np.isnan(v) for v in t + p + h):
            rejected["missing_envelope"] += 1
            continue
        if not (ordered(t) and ordered(p) and ordered(h)):
            rejected["inconsistent_order"] += 1
            continue
        if not (-30 <= t[0] and t[3] <= 55 and 0 <= p[0] and p[3] <= 12000 and 2 <= h[0] and h[3] <= 12):
            rejected["implausible_range"] += 1
            continue
        crop_id = slug(sci)
        if crop_id in seen:
            rejected["duplicate"] += 1
            continue
        seen.add(crop_id)

        family = family_of(r["FAMNAME"])
        common = first_common_name(r["COMNAME"])
        name_slug = slug(common) if common else ""
        has_local_yield = crop_id in legacy_ids or (name_slug and name_slug in legacy_ids)
        primary = category_of(r["CAT"])
        if primary == "other":
            mapped = LEGACY_CATEGORY.get(str(legacy_cat.get(name_slug, "")).lower())
            if mapped:
                primary = mapped
        life = split_list(r["LIFO"])
        lispa = str(r["LISPA"]).lower() if isinstance(r["LISPA"], str) else ""

        rows.append({
            "crop_id": crop_id,
            "common_name": common or sci,
            "scientific_name": sci,
            "family": family,
            "category": primary,
            "categories_all": categories_of(r["CAT"]) or [primary],
            "recommendable": primary in RECOMMENDABLE,
            "life_form": life,
            "life_span": lispa or None,
            "temp_c": {"min": t[0], "opt_min": t[1], "opt_max": t[2], "max": t[3]},
            "rainfall_mm": {"min": p[0], "opt_min": p[1], "opt_max": p[2], "max": p[3]},
            "ph": {"min": h[0], "opt_min": h[1], "opt_max": h[2], "max": h[3]},
            "killing_temp_c": None if np.isnan(r["KTMP"]) else float(r["KTMP"]),
            "altitude_max_m": None if np.isnan(r["ALTMX"]) else float(r["ALTMX"]),
            "latitude_range": [None if np.isnan(r["LATMN"]) else float(r["LATMN"]),
                               None if np.isnan(r["LATMX"]) else float(r["LATMX"])],
            "growth_cycle_days": [None if np.isnan(r["GMIN"]) else float(r["GMIN"]),
                                  None if np.isnan(r["GMAX"]) else float(r["GMAX"])],
            "soil_texture_optimal": split_list(r["TEXT"]),
            "soil_texture_range": split_list(r["TEXTR"]),
            "soil_depth": r["DEP"] if isinstance(r["DEP"], str) else None,
            "fertility_need": r["FER"] if isinstance(r["FER"], str) else None,
            "salinity_tolerance": r["SAL"] if isinstance(r["SAL"], str) else None,
            "drainage": r["DRA"] if isinstance(r["DRA"], str) else None,
            "koppen_zones": split_list(r["CLIZ"]),
            "is_nitrogen_fixer": bool(family in LEGUME_FAMILIES),
            "has_real_yield_data": bool(has_local_yield),
            "confidence_tier": "A" if has_local_yield else "B",
            "data_sources": ["FAO EcoCrop"] + (["GeoAgri local yield table"] if has_local_yield else []),
        })

    rows.sort(key=lambda x: (x["confidence_tier"], x["common_name"].lower()))
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    report = {
        "source_rows": int(len(df)),
        "kept": len(rows),
        "rejected": rejected,
        "tier_counts": {"A": sum(r["confidence_tier"] == "A" for r in rows),
                        "B": sum(r["confidence_tier"] == "B" for r in rows)},
        "category_counts": pd.Series([r["category"] for r in rows]).value_counts().to_dict(),
        "nitrogen_fixers": sum(r["is_nitrogen_fixer"] for r in rows),
        "recommendable": sum(r["recommendable"] for r in rows),
    }
    REPORT.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    assert len(rows) >= 1500, "Expected 1,500+ usable species; the source file may be damaged."


if __name__ == "__main__":
    main()
