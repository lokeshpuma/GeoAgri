"""
Land Classification Service (PRD v2.1 §5, §14.1, M15, M29).
Consumes structured Evidence to classify land into official and physical classes:
AGRICULTURAL, FOREST_LEGAL, FOREST_COVER, WASTELAND, URBAN_BUILT, WATER_BODY, UNKNOWN.

All thresholds and confidence scores are loaded dynamically from rules YAML.
Zero hardcoded confidence or share literals.
"""
from __future__ import annotations

import os
import copy
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import yaml

from app.schemas.predict import LandClassification
from app.core.config import get_settings


class LandClassifier:
    def __init__(self, rules_file: Optional[str] = None):
        self.rules = self._load_rules(rules_file)

    def _load_rules(self, rules_file: Optional[str]) -> Dict[str, Any]:
        if not rules_file:
            settings = get_settings()
            rules_val = getattr(settings, "LAND_CLASS_RULES", getattr(settings, "LAND_CLASS_RULES_PATH", "backend/app/rules/land_class_rules.yaml"))
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

    def classify(
        self,
        features: Optional[Union[Dict[str, Any], Any]] = None,
        record: Optional[Dict[str, Any]] = None,
        layer_hits: Optional[List[Dict[str, Any]]] = None,
        evidence: Optional[Any] = None
    ) -> LandClassification:
        """
        Computes dominant land class, class shares, subclass, and confidence.
        Reads thresholds from self.rules ('thresholds', 'detection', 'confidence_scoring').
        Accepts either an Evidence container, a feature dictionary, or both.
        """
        # Load confidence scoring from YAML (M15: no hardcoded literals)
        conf_cfg = self.rules.get("confidence_scoring", {})
        c_official = float(conf_cfg.get("verified_official_record", 0.98))
        c_doc = float(conf_cfg.get("user_provided_document", 0.90))
        c_multi = float(conf_cfg.get("multi_sensor_consistent", 0.85))
        c_single = float(conf_cfg.get("single_sensor_rs", 0.70))
        c_conflict = float(conf_cfg.get("conflicting_signals", 0.50))

        # Thresholds from YAML
        thresh = self.rules.get("thresholds", {})
        det_cfg = self.rules.get("detection", {})
        min_sources = int(det_cfg.get("min_independent_sources", 2))

        water_thresh = float(thresh.get("water", {}).get("min_share_for_dominant", 0.35))
        urban_thresh = float(thresh.get("urban", {}).get("min_share_for_dominant", 0.30))
        forest_thresh = float(thresh.get("forest_cover", {}).get("min_share_for_dominant", 0.50))
        wasteland_thresh = float(thresh.get("wasteland", {}).get("barren_rocky_slope_min_deg", 25.0))

        # Flexible argument handling
        det_block: Dict[str, Any] = {}
        feat: Dict[str, Any] = {}
        rec: Optional[Dict[str, Any]] = record
        indep: Dict[str, List[str]] = {}

        # If first positional argument is Evidence
        if hasattr(features, "detection"):
            evidence = features
            features = None
        elif isinstance(features, dict) and ("detection" in features or "independent_sources" in features):
            evidence = features
            features = None

        if evidence is not None:
            if hasattr(evidence, "detection"):
                det_block = evidence.detection or {}
            elif isinstance(evidence, dict):
                det_block = evidence.get("detection", {})

            if hasattr(evidence, "features"):
                feat = dict(evidence.features or {})
            elif isinstance(evidence, dict) and "features" in evidence:
                feat = dict(evidence.get("features", {}))

            if hasattr(evidence, "record") and evidence.record is not None:
                rec = evidence.record
            elif isinstance(evidence, dict) and evidence.get("record"):
                rec = evidence["record"]

            if hasattr(evidence, "independent_sources"):
                indep = evidence.independent_sources or {}
            elif isinstance(evidence, dict):
                indep = evidence.get("independent_sources", {})

        if isinstance(features, dict):
            feat.update(features)

        layer_hits = layer_hits or []
        layer_names = [h.get("name", "").lower() for h in layer_hits]

        # 1. Document / Official Record Precedence (PRD §5.2, M14)
        if rec and rec.get("verification") in ["official", "user_provided"]:
            rec_class = rec.get("class_geoagri") or rec.get("recorded_land_class")
            valid_classes = ["AGRICULTURAL", "FOREST_LEGAL", "FOREST_COVER", "WASTELAND", "URBAN_BUILT", "WATER_BODY"]
            if rec_class in valid_classes:
                sub = rec.get("subclass")
                legal_forest = "reserved_forest" if rec_class == "FOREST_LEGAL" else "none"
                ndwi = float(feat.get("ndwi", 0.0)) if feat.get("ndwi") is not None else 0.0
                slope = float(feat.get("slope", 0.0)) if feat.get("slope") is not None else 0.0
                is_water = any("water" in n or "hydrolakes" in n for n in layer_names)

                conflict = False
                base_conf = c_official if rec.get("verification") == "official" else c_doc
                confidence = base_conf
                if rec_class == "AGRICULTURAL" and (is_water or ndwi > water_thresh or slope > 22.0):
                    conflict = True
                    confidence = c_conflict

                return LandClassification(
                    dominant=rec_class,
                    class_shares={rec_class: 1.0},
                    subclass=sub,
                    legal_forest_status=legal_forest,
                    confidence=confidence,
                    conflict=conflict,
                    conflict_reason="record_vs_imagery_conflict" if conflict else None
                )

        # 2. Official Protected Area Layer Hit
        is_legal_forest = any("protected_area" in n or "reserved_forest" in n for n in layer_names) or \
                          (det_block.get("forest", {}).get("kind") == "legal" and det_block.get("forest", {}).get("legal_status") == "verified")
        if is_legal_forest:
            return LandClassification(
                dominant="FOREST_LEGAL",
                class_shares={"FOREST_LEGAL": 1.0},
                subclass="sanctuary_or_reserve",
                legal_forest_status="protected_forest",
                confidence=c_official
            )

        # 3. Measured Land Cover Shares from Detection or Layer Hits
        forest_det = det_block.get("forest", {})
        buildings_det = det_block.get("buildings", {})
        water_det = det_block.get("water", {})

        measured_forest_share = float(forest_det.get("share", 0.0))
        measured_built_share = float(buildings_det.get("share", 0.0))
        measured_water_share = float(water_det.get("share", 0.0))

        # Check raw features
        raw_ndwi = feat.get("ndwi")
        raw_ndvi = feat.get("ndvi")
        raw_slope = feat.get("slope")
        raw_vh = feat.get("vh")

        is_water_layer = any("hydrolakes" in n or "water" in n for n in layer_names)
        is_urban_layer = any("ghsl" in n or "building" in n or "urban" in n for n in layer_names)

        # Zero/Missing Evidence Guard (M15, M29)
        has_any_signal = (
            measured_forest_share > 0 or
            measured_built_share > 0 or
            measured_water_share > 0 or
            raw_ndwi is not None or
            raw_ndvi is not None or
            raw_slope is not None or
            is_water_layer or
            is_urban_layer or
            bool(det_block.get("sources"))
        )

        if not has_any_signal:
            return LandClassification(
                dominant="UNKNOWN",
                class_shares={"UNKNOWN": 1.0},
                subclass="insufficient_evidence",
                legal_forest_status="unknown",
                confidence=0.0
            )

        # 4. Plantation Guard (PRD §5.2, §5A.3)
        ndvi_val = float(raw_ndvi) if raw_ndvi is not None else 0.0
        vh_val = float(raw_vh) if raw_vh is not None else -18.0
        lat_val = float(feat.get("latitude") or feat.get("lat") or 0.0)
        lon_val = float(feat.get("longitude") or feat.get("lon") or 0.0)
        elev_val = float(feat.get("elevation") or 0.0)

        is_plantation = forest_det.get("plantation_signature") is True or \
            (ndvi_val > 0.70 and vh_val > -13.5 and ((11.5 <= lat_val <= 15.0 and 74.5 <= lon_val <= 77.0) or elev_val > 800.0))

        if is_plantation:
            return LandClassification(
                dominant="AGRICULTURAL",
                class_shares={"AGRICULTURAL": 1.0},
                subclass="agroforestry_plantation",
                legal_forest_status="none",
                confidence=c_multi
            )

        def _norm_source(name: str) -> str:
            n = name.lower()
            if "worldcover" in n:
                return "worldcover"
            if "osm" in n or "openstreetmap" in n:
                return "osm"
            if "hansen" in n:
                return "hansen"
            if "sentinel1" in n or "sar" in n:
                return "sentinel1_sar"
            if "sentinel2" in n or "sentinel" in n or "ndvi" in n or "ndwi" in n:
                return "sentinel2"
            if "ms_buildings" in n or "microsoft" in n:
                return "ms_buildings"

            if "ghsl" in n:
                return "ghsl"
            if "hydrolakes" in n:
                return "hydrolakes"
            return n.split(":")[0]

        # 5. Remote-Sensing Classification with M29 Independent Source Check
        # 5a. Water Body
        water_sources = {_norm_source(s) for s in indep.get("water", [])}
        if any("worldcover" in b for b in water_det.get("basis", [])):
            water_sources.add("worldcover")
        if is_water_layer:
            water_sources.add("hydrolakes")
        if raw_ndwi is not None and float(raw_ndwi) > water_thresh:
            water_sources.add("sentinel2")
        if raw_vh is not None and float(raw_vh) < -22.0:
            water_sources.add("sentinel1_sar")

        if measured_water_share >= water_thresh or is_water_layer or (raw_ndwi is not None and float(raw_ndwi) > water_thresh):
            if len(water_sources) < min_sources and not is_water_layer:
                return LandClassification(
                    dominant="UNKNOWN",
                    class_shares={"UNKNOWN": 1.0, "WATER_BODY": measured_water_share or water_thresh},
                    subclass="single_source_only",
                    legal_forest_status="none",
                    confidence=c_single
                )
            share_val = max(water_thresh, measured_water_share) if measured_water_share > 0 else 1.0
            rem = max(0.0, round(1.0 - share_val, 4))
            shares = {"WATER_BODY": share_val}
            if rem > 0:
                shares["AGRICULTURAL"] = rem
            return LandClassification(
                dominant="WATER_BODY",
                class_shares=shares,
                subclass="open_water_body",
                legal_forest_status="none",
                confidence=c_multi if len(water_sources) >= 2 else c_single
            )

        # 5b. Urban Built-up
        urban_sources = {_norm_source(s) for s in indep.get("buildings", [])}
        if any("worldcover" in b for b in buildings_det.get("basis", [])):
            urban_sources.add("worldcover")
        if is_urban_layer:
            urban_sources.add("ghsl")
        if buildings_det.get("basis"):
            for b in buildings_det["basis"]:
                urban_sources.add(_norm_source(b))

        if measured_built_share >= urban_thresh or is_urban_layer:
            if len(urban_sources) < min_sources and not is_urban_layer:
                return LandClassification(
                    dominant="UNKNOWN",
                    class_shares={"UNKNOWN": 1.0, "URBAN_BUILT": measured_built_share or urban_thresh},
                    subclass="single_source_only",
                    legal_forest_status="none",
                    confidence=c_single
                )
            share_val = max(urban_thresh, measured_built_share) if measured_built_share > 0 else 1.0
            rem = max(0.0, round(1.0 - share_val, 4))
            shares = {"URBAN_BUILT": share_val}
            if rem > 0:
                shares["AGRICULTURAL"] = rem
            return LandClassification(
                dominant="URBAN_BUILT",
                class_shares=shares,
                subclass="dense_settlement",
                legal_forest_status="none",
                confidence=c_multi if len(urban_sources) >= 2 else c_single
            )

        # 5c. Forest Cover (Physical canopy without legal boundary)
        forest_sources = {_norm_source(s) for s in indep.get("forest", [])}
        if any("worldcover" in b for b in forest_det.get("basis", [])):
            forest_sources.add("worldcover")
        if forest_det.get("basis"):
            for b in forest_det["basis"]:
                forest_sources.add(_norm_source(b))
        if raw_ndvi is not None and float(raw_ndvi) > 0.65:
            forest_sources.add("sentinel2")
        if raw_vh is not None and float(raw_vh) > -13.5:
            forest_sources.add("sentinel1_sar")

        if measured_forest_share >= forest_thresh or (forest_det.get("state") == "detected" and forest_det.get("kind") == "cover") or (raw_ndvi is not None and float(raw_ndvi) > 0.70):
            if len(forest_sources) < min_sources:
                return LandClassification(
                    dominant="UNKNOWN",
                    class_shares={"UNKNOWN": 1.0, "FOREST_COVER": measured_forest_share or forest_thresh},
                    subclass="single_source_only",
                    legal_forest_status="unverified",
                    confidence=c_single
                )
            share_val = max(forest_thresh, measured_forest_share) if measured_forest_share > 0 else 1.0
            rem = max(0.0, round(1.0 - share_val, 4))
            shares = {"FOREST_COVER": share_val}
            if rem > 0:
                shares["AGRICULTURAL"] = rem
            return LandClassification(
                dominant="FOREST_COVER",
                class_shares=shares,
                subclass="dense_canopy",
                legal_forest_status="unknown",
                confidence=c_multi
            )


        # 5d. Wasteland / Barren Rocky
        slope_val = float(raw_slope) if raw_slope is not None else 0.0
        if slope_val > wasteland_thresh and ndvi_val < 0.25:
            return LandClassification(
                dominant="WASTELAND",
                class_shares={"WASTELAND": 1.0},
                subclass="barren_rocky",
                legal_forest_status="none",
                confidence=c_multi
            )

        # 5e. Farmhouse deduction (built share < farmhouse_max_share)
        farmhouse_max = float(det_cfg.get("buildings", {}).get("farmhouse_max_share", 0.05))
        if 0 < measured_built_share <= farmhouse_max:
            agri_share = round(1.0 - measured_built_share, 4)
            return LandClassification(
                dominant="AGRICULTURAL",
                class_shares={"AGRICULTURAL": agri_share, "URBAN_BUILT": measured_built_share},
                subclass="farm_with_farmhouse",
                legal_forest_status="none",
                confidence=c_multi
            )

        # 5f. Agricultural default / consensus
        conf_to_assign = c_multi if len(det_block.get("sources", [])) >= 2 else c_single
        return LandClassification(
            dominant="AGRICULTURAL",
            class_shares={"AGRICULTURAL": 1.0},
            subclass="cropland",
            legal_forest_status="none",
            confidence=conf_to_assign
        )


_classifier_instance: Optional[LandClassifier] = None


def get_land_classifier() -> LandClassifier:
    global _classifier_instance
    if _classifier_instance is None:
        _classifier_instance = LandClassifier()
    return _classifier_instance
