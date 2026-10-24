"""
Irrigability Engine Service (PRD v2.1 §7, §14.1, M15, M29).
Evaluates plot irrigability verdicts, limiting reasons, usable irrigable area,
and permissible irrigation modes from configurable YAML rules.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import yaml

from app.schemas.predict import Irrigability, LandClassification
from app.core.config import get_settings


class IrrigabilityEngine:
    def __init__(self, rules_file: Optional[str] = None):
        self.rules = self._load_rules(rules_file)

    def _load_rules(self, rules_file: Optional[str]) -> Dict[str, Any]:
        if not rules_file:
            settings = get_settings()
            rules_val = getattr(settings, "IRRIGABILITY_RULES", getattr(settings, "IRRIGABILITY_RULES_PATH", "backend/app/rules/irrigability_rules.yaml"))
            rules_path = Path(rules_val)
            if not rules_path.is_absolute():
                for candidate in [
                    rules_path,
                    Path("backend") / rules_path,
                    Path(__file__).resolve().parents[2] / "rules" / rules_path.name,
                    Path("/Users/lokesh/Desktop/GeoAgri/backend/app/rules") / rules_path.name,
                ]:
                    if candidate.exists():
                        rules_path = candidate
                        break
            rules_file = str(rules_path)

        if os.path.exists(rules_file):
            try:
                with open(rules_file, "r", encoding="utf-8") as f:
                    return yaml.safe_load(f) or {}
            except Exception:
                pass
        return {}

    def evaluate(
        self,
        land_class: LandClassification,
        features: Dict[str, Any],
        area_ha: Optional[float] = None,
        record: Optional[Dict[str, Any]] = None,
        layer_hits: Optional[List[Dict[str, Any]]] = None
    ) -> Irrigability:
        """
        Evaluates plot irrigability following PRD §7.2 decision precedence:
        1. UNKNOWN / single_source_only -> UNVERIFIED
        2. Non-agri official/confirmed classes -> NOT_IRRIGABLE
        3. Wasteland -> NOT_IRRIGABLE
        4. Physical Forest Cover -> NOT_IRRIGABLE_PROVISIONAL
        5. Agricultural -> evaluates terrain, soil, and water-access limits
        """
        reasons = []
        dominant = land_class.dominant

        # Thresholds from YAML
        hard_limits = self.rules.get("hard_limits", {})
        soft_limits = self.rules.get("soft_limits", {})

        slope_hard_max = float(hard_limits.get("slope_deg_max", 20.0))
        slope_soft_max = float(soft_limits.get("slope_deg_drip_only", 8.0))
        sand_soft_max = float(soft_limits.get("sand_pct_max", 82.0))
        clay_soft_max = float(soft_limits.get("clay_pct_max", 65.0))
        water_dist_max = float(soft_limits.get("distance_to_water_m_max", 4000.0))

        # 0. Missing / Unknown evidence / Single Source Only (M29)
        if dominant == "UNKNOWN" or land_class.subclass == "single_source_only":
            reason_msg = "Single-source remote sensing evidence unconfirmed by secondary source." \
                if land_class.subclass == "single_source_only" \
                else "Insufficient satellite or legal record evidence to establish land classification."
            return Irrigability(
                verdict="UNVERIFIED",
                reasons=[{
                    "rule_id": f"missing_evidence:{land_class.subclass or 'unknown_land_class'}",
                    "verdict": "UNVERIFIED",
                    "reason": reason_msg,
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
            is_prov = land_class.confidence < float(self.rules.get("confidence_scoring", {}).get("user_provided_document", 0.90))
            return Irrigability(
                verdict="NOT_IRRIGABLE_PROVISIONAL" if is_prov else "NOT_IRRIGABLE",
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

        # 4. Agricultural Checks: Terrain, Soil, Water Access (§7.3)
        raw_slope = features.get("slope")
        raw_clay = features.get("texture_clay_pct")
        raw_sand = features.get("texture_sand_pct")
        raw_dist_water = features.get("distance_to_water_m")
        irr_source = record.get("irrigation_source") if record else None

        # Check for missing basic terrain/soil
        if raw_slope is None and raw_clay is None and raw_sand is None:
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

        # Hard Terrain Limit
        if slope > slope_hard_max:
            return Irrigability(
                verdict="NOT_IRRIGABLE",
                reasons=[{
                    "rule_id": "hard_terrain:slope_exceeded",
                    "verdict": "NOT_IRRIGABLE",
                    "reason": f"Steep slope ({slope:.1f}° > {slope_hard_max:.1f}°) prevents safe irrigation and causes critical soil erosion.",
                    "layer": "srtm_dem"
                }],
                reclaimable="terracing_required",
                irrigable_area_ha=0.0 if area_ha is not None else None,
                irrigation_options=[],
                crop_models="skipped_not_irrigable"
            )

        # Usable area calculation (deduct building footprint if farm + farmhouse)
        irrigable_area = area_ha
        if area_ha is not None:
            building_share = land_class.class_shares.get("URBAN_BUILT", 0.0)
            if building_share > 0:
                deducted = round(area_ha * (1.0 - building_share), 2)
                irrigable_area = max(0.01, deducted)
                reasons.append({
                    "rule_id": "setback:building_footprint",
                    "verdict": "INFO",
                    "reason": f"Subtracted building footprint ({building_share*100:.1f}%) from gross plot area.",
                    "layer": "ms_buildings_footprint"
                })

        # Soft Limits -> CONDITIONALLY_IRRIGABLE
        options = ["rainfed_only"]
        is_conditional = False

        if slope > slope_soft_max:
            is_conditional = True
            options.extend(["drip", "sprinkler"])
            reasons.append({
                "rule_id": "soft_limit:slope_drip_only",
                "verdict": "CONDITIONALLY_IRRIGABLE",
                "reason": f"Moderate slope ({slope:.1f}° > {slope_soft_max:.1f}°) requires micro-irrigation (drip/sprinkler) to avoid soil runoff.",
                "layer": "srtm_dem"
            })
        else:
            options.extend(["canal", "well/borewell", "tank", "drip", "sprinkler"])

        if sand > sand_soft_max:
            is_conditional = True
            reasons.append({
                "rule_id": "soft_limit:high_permeability",
                "verdict": "CONDITIONALLY_IRRIGABLE",
                "reason": f"High sand content ({sand:.1f}% > {sand_soft_max:.1f}%) results in rapid percolation; drip irrigation recommended.",
                "layer": "soilgrids_texture"
            })

        if clay > clay_soft_max:
            is_conditional = True
            reasons.append({
                "rule_id": "soft_limit:poor_aeration",
                "verdict": "CONDITIONALLY_IRRIGABLE",
                "reason": f"Heavy clay content ({clay:.1f}% > {clay_soft_max:.1f}%) causes poor infiltration and seasonal waterlogging risks.",
                "layer": "soilgrids_texture"
            })

        # Water Access Check (§7.3, M29)
        if irr_source:
            reasons.append({
                "rule_id": "water_access:recorded_source",
                "verdict": "INFO",
                "reason": f"Recorded irrigation source: {irr_source}.",
                "layer": "rtc_land_record"
            })
        elif raw_dist_water is not None:
            dist_water = float(raw_dist_water)
            if dist_water > water_dist_max:
                is_conditional = True
                reasons.append({
                    "rule_id": "soft_limit:distance_to_water_exceeded",
                    "verdict": "CONDITIONALLY_IRRIGABLE",
                    "reason": f"Distance to surface water ({dist_water:.0f}m > {water_dist_max:.0f}m); reliant on groundwater or rainfed mode.",
                    "layer": "hydrorivers_hydrolakes"
                })
        else:
            # Water access unknown -> report informative note
            reasons.append({
                "rule_id": "water_access:unknown",
                "verdict": "INFO",
                "reason": "Water source / canal proximity unknown; assuming rainfed / local well only until verified.",
                "layer": "water_infrastructure_inventory"
            })


        final_verdict = "CONDITIONALLY_IRRIGABLE" if is_conditional else "IRRIGABLE"
        return Irrigability(
            verdict=final_verdict,
            reasons=reasons,
            reclaimable="not_applicable",
            irrigable_area_ha=irrigable_area,
            irrigation_options=list(set(options)),
            crop_models="evaluated"
        )


_engine_instance: Optional[IrrigabilityEngine] = None


def get_irrigability_engine() -> IrrigabilityEngine:
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = IrrigabilityEngine()
    return _engine_instance


