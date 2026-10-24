"""
Irrigability Engine Service (PRD v2.0 §7, §14.1).
Evaluates land irrigability verdicts, limiting reasons, usable irrigable area,
and permissible irrigation modes.
"""
from __future__ import annotations

import os
import yaml
from pathlib import Path
from typing import Any
from app.schemas.predict import Irrigability, LandClassification
from app.core.config import get_settings


class IrrigabilityEngine:
    def __init__(self, rules_file: str | None = None):
        self.rules = self._load_rules(rules_file)

    def _load_rules(self, rules_file: str | None) -> dict[str, Any]:
        if not rules_file:
            settings = get_settings()
            rules_file = str(Path(settings.IRRIGABILITY_RULES_PATH))
            if not os.path.isabs(rules_file):
                backend_dir = Path(__file__).resolve().parents[3]
                rules_file = str(backend_dir / rules_file)

        if os.path.exists(rules_file):
            try:
                with open(rules_file, "r") as f:
                    return yaml.safe_load(f) or {}
            except Exception:
                pass
        return {}

    def evaluate(
        self,
        land_class: LandClassification,
        features: dict[str, Any],
        area_ha: float | None = None,
        record: dict[str, Any] | None = None,
        layer_hits: list[dict[str, Any]] | None = None
    ) -> Irrigability:
        """
        Evaluates plot irrigability following PRD §7.2 decision precedence:
        1. Non-agri official/confirmed classes -> NOT_IRRIGABLE
        2. Wasteland -> NOT_IRRIGABLE
        3. Physical Forest Cover -> NOT_IRRIGABLE_PROVISIONAL
        4. Cropland -> evaluates terrain, soil texture, water availability
        """
        reasons = []
        dominant = land_class.dominant
        # 0. Missing / Unknown evidence
        if dominant == "UNKNOWN":
            return Irrigability(
                verdict="UNVERIFIED",
                reasons=[{
                    "rule_id": "missing_evidence:unknown_land_class",
                    "verdict": "UNVERIFIED",
                    "reason": "Insufficient satellite or legal record evidence to establish land classification.",
                    "layer": "multi_sensor_inventory"
                }],
                reclaimable="unknown",
                irrigable_area_ha=None,
                irrigation_options=[],
                crop_models="skipped_not_irrigable"
            )

        # 1. Forest Legal / Urban Built / Water Body
        if dominant == "FOREST_LEGAL":
            return Irrigability(
                verdict="NOT_IRRIGABLE",
                reasons=[{
                    "rule_id": "hard_exclusion:forest_legal",
                    "verdict": "NOT_IRRIGABLE",
                    "reason": "Plot overlaps legally gazetted reserved forest or wildlife sanctuary.",
                    "layer": "forest_department_boundary"
                }],
                reclaimable="none",
                irrigable_area_ha=0.0 if area_ha is not None else None,
                irrigation_options=[],
                crop_models="skipped_not_irrigable"
            )

        if dominant == "URBAN_BUILT":
            return Irrigability(
                verdict="NOT_IRRIGABLE",
                reasons=[{
                    "rule_id": "hard_exclusion:urban_built",
                    "verdict": "NOT_IRRIGABLE",
                    "reason": "Plot is classified as urban built-up / non-agricultural property.",
                    "layer": "ghsl_built_up"
                }],
                reclaimable="none",
                irrigable_area_ha=0.0 if area_ha is not None else None,
                irrigation_options=[],
                crop_models="skipped_not_irrigable"
            )

        if dominant == "WATER_BODY":
            return Irrigability(
                verdict="NOT_IRRIGABLE",
                reasons=[{
                    "rule_id": "hard_exclusion:water_body",
                    "verdict": "NOT_IRRIGABLE",
                    "reason": "Plot falls directly within a natural lake, reservoir, or river water body.",
                    "layer": "hydrolakes_or_copernicus"
                }],
                reclaimable="none",
                irrigable_area_ha=0.0 if area_ha is not None else None,
                irrigation_options=[],
                crop_models="skipped_not_irrigable"
            )

        # 2. Wasteland
        if dominant == "WASTELAND":
            sub = land_class.subclass or "barren_rocky"
            reclaimable_status = "possible" if "kharab_a" in sub or "grassland" in sub else "unlikely"
            return Irrigability(
                verdict="NOT_IRRIGABLE_PROVISIONAL" if land_class.confidence < 0.90 else "NOT_IRRIGABLE",
                reasons=[{
                    "rule_id": f"wasteland:{sub}",
                    "verdict": "NOT_IRRIGABLE",
                    "reason": f"Plot is non-cultivable wasteland ({sub}). Reclaimability: {reclaimable_status}.",
                    "layer": "bhuvan_wasteland_or_srtm_slope"
                }],
                reclaimable=reclaimable_status,
                irrigable_area_ha=0.0 if area_ha is not None else None,
                irrigation_options=[],
                crop_models="skipped_not_irrigable"
            )

        # 3. Physical Forest Cover (without legal confirmation)
        if dominant == "FOREST_COVER":
            return Irrigability(
                verdict="NOT_IRRIGABLE_PROVISIONAL",
                reasons=[{
                    "rule_id": "provisional:forest_cover",
                    "verdict": "NOT_IRRIGABLE_PROVISIONAL",
                    "reason": "Dense contiguous tree canopy observed from satellite imagery. Legal status unverified.",
                    "layer": "sentinel2_hansen_canopy"
                }],
                reclaimable="none",
                irrigable_area_ha=0.0 if area_ha is not None else None,
                irrigation_options=[],
                crop_models="skipped_not_irrigable"
            )

        raw_slope = features.get("slope")
        raw_clay = features.get("texture_clay_pct")
        raw_sand = features.get("texture_sand_pct")

        if raw_slope is None and raw_clay is None:
            return Irrigability(
                verdict="UNVERIFIED",
                reasons=[{
                    "rule_id": "missing_evidence:unverified_soil_terrain",
                    "verdict": "UNVERIFIED",
                    "reason": "Missing terrain slope and soil texture evidence to evaluate irrigability feasibility.",
                    "layer": "soil_and_dem"
                }],
                reclaimable="unknown",
                irrigable_area_ha=None,
                irrigation_options=[],
                crop_models="skipped_not_irrigable"
            )

        slope = float(raw_slope) if raw_slope is not None else 2.0
        clay = float(raw_clay) if raw_clay is not None else 25.0
        sand = float(raw_sand) if raw_sand is not None else 45.0

        # Check hard terrain limit
        if slope > 20.0:
            return Irrigability(
                verdict="NOT_IRRIGABLE",
                reasons=[{
                    "rule_id": "hard_terrain:slope_exceeded",
                    "verdict": "NOT_IRRIGABLE",
                    "reason": f"Steep slope ({slope:.1f}° > 20.0°) prevents safe irrigation and causes critical soil erosion.",
                    "layer": "srtm_dem"
                }],
                reclaimable="terracing_required",
                irrigable_area_ha=0.0 if area_ha is not None else None,
                irrigation_options=[],
                crop_models="skipped_not_irrigable"
            )

        # Usable area calculation (e.g. subtracting building footprint if farm + farmhouse)
        irrigable_area = area_ha
        if area_ha is not None:
            # If buildings detected, deduct building footprint (~0.1 ha or building share)
            building_share = land_class.class_shares.get("URBAN_BUILT", 0.0)
            if building_share > 0:
                deducted = round(area_ha * (1.0 - building_share), 2)
                irrigable_area = max(0.05, deducted)
                reasons.append({
                    "rule_id": "setback:building_footprint",
                    "verdict": "INFO",
                    "reason": f"Subtracted building footprint ({building_share*100:.1f}%) from gross plot area.",
                    "layer": "ms_buildings_footprint"
                })

        # Soft Limits -> CONDITIONALLY_IRRIGABLE
        options = ["rainfed_only"]
        is_conditional = False

        if slope > 8.0:
            is_conditional = True
            options.extend(["drip", "sprinkler"])
            reasons.append({
                "rule_id": "soft_limit:slope_drip_only",
                "verdict": "CONDITIONALLY_IRRIGABLE",
                "reason": f"Moderate slope ({slope:.1f}° > 8.0°) requires micro-irrigation (drip/sprinkler) to avoid soil runoff.",
                "layer": "srtm_dem"
            })
        else:
            options.extend(["canal", "well/borewell", "tank", "drip", "sprinkler"])

        if sand > 82.0:
            is_conditional = True
            reasons.append({
                "rule_id": "soft_limit:excessive_sand",
                "verdict": "CONDITIONALLY_IRRIGABLE",
                "reason": f"High sand fraction ({sand:.1f}% > 82%) leads to rapid percolation; frequent light irrigation needed.",
                "layer": "soilgrids_texture"
            })

        if clay > 65.0:
            is_conditional = True
            reasons.append({
                "rule_id": "soft_limit:heavy_clay",
                "verdict": "CONDITIONALLY_IRRIGABLE",
                "reason": f"Heavy clay soil ({clay:.1f}% > 65%) requires controlled drainage to avoid root hypoxia.",
                "layer": "soilgrids_texture"
            })

        verdict = "CONDITIONALLY_IRRIGABLE" if is_conditional else "IRRIGABLE"

        return Irrigability(
            verdict=verdict,
            reasons=reasons,
            reclaimable="not_applicable",
            irrigable_area_ha=irrigable_area,
            irrigation_options=list(set(options)),
            crop_models="evaluated"
        )


_engine_instance: IrrigabilityEngine | None = None

def get_irrigability_engine() -> IrrigabilityEngine:
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = IrrigabilityEngine()
    return _engine_instance
