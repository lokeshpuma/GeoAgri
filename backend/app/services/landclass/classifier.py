"""
Land Classification Service (PRD v2.0 §5, §14.1).
Fuses remote sensing indices (NDVI, NDWI, slope, elevation, SAR) with land records
and geographic spatial layers to determine land class and class shares.
"""
from __future__ import annotations

import os
import yaml
from pathlib import Path
from typing import Any
from app.schemas.predict import LandClassification
from app.core.config import get_settings


class LandClassifier:
    def __init__(self, rules_file: str | None = None):
        self.rules = self._load_rules(rules_file)

    def _load_rules(self, rules_file: str | None) -> dict[str, Any]:
        if not rules_file:
            settings = get_settings()
            rules_file = str(Path(settings.LAND_CLASS_RULES_PATH))
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

    def classify(
        self,
        features: dict[str, Any],
        record: dict[str, Any] | None = None,
        layer_hits: list[dict[str, Any]] | None = None
    ) -> LandClassification:
        """
        Computes dominant land class, class shares, subclass, and confidence.
        Precedence:
        1. Legal record verification (RTC, e-Khata, official forest)
        2. Strong physical environmental constraints (Water Body, Dense Urban, Rocky Wasteland)
        3. Forest Cover vs Plantation separation
        4. Cropland / Agricultural
        """
        layer_hits = layer_hits or []
        layer_names = [h.get("name", "").lower() for h in layer_hits]

        # 1. Document / Record Override (PRD v2.1 M14)
        if record and record.get("verification") in ["official", "user_provided"]:
            rec_class = record.get("class_geoagri") or record.get("recorded_land_class")
            if rec_class in ["AGRICULTURAL", "FOREST_LEGAL", "FOREST_COVER", "WASTELAND", "URBAN_BUILT", "WATER_BODY"]:
                sub = record.get("subclass")
                legal_forest = "reserved_forest" if rec_class == "FOREST_LEGAL" else "none"
                ndwi = float(features.get("ndwi", 0.0))
                slope = float(features.get("slope", 0.0))
                is_water = any("water" in n or "hydrolakes" in n for n in layer_names)
                conflict = False
                confidence = 0.95
                if rec_class == "AGRICULTURAL" and (is_water or ndwi > 0.35 or slope > 22.0):
                    conflict = True
                    confidence = 0.50
                return LandClassification(
                    dominant=rec_class,
                    class_shares={rec_class: 1.0},
                    subclass=sub,
                    legal_forest_status=legal_forest,
                    confidence=confidence,
                    conflict=conflict,
                    conflict_reason="record_vs_imagery_conflict" if conflict else None
                )

        # 2. Check Protected Area / Legal Forest Layer
        is_legal_forest = any("protected_area" in n or "reserved_forest" in n for n in layer_names)
        if is_legal_forest:
            return LandClassification(
                dominant="FOREST_LEGAL",
                class_shares={"FOREST_LEGAL": 0.90, "FOREST_COVER": 0.10},
                subclass="sanctuary_or_reserve",
                legal_forest_status="protected_forest",
                confidence=0.98
            )

        # 3. Check for missing evidence vs extract spectral and terrain signals
        raw_ndwi = features.get("ndwi")
        raw_ndvi = features.get("ndvi")
        raw_slope = features.get("slope")
        raw_elevation = features.get("elevation")
        raw_vh = features.get("vh")

        is_water_layer = any("hydrolakes" in n or "water" in n for n in layer_names)
        is_urban_layer = any("ghsl" in n or "building" in n or "urban" in n for n in layer_names)

        if raw_ndwi is None and raw_ndvi is None and raw_slope is None and not is_water_layer and not is_urban_layer:
            return LandClassification(
                dominant="UNKNOWN",
                class_shares={"UNKNOWN": 1.0},
                subclass="insufficient_evidence",
                legal_forest_status="unknown",
                confidence=0.0
            )

        ndwi = float(raw_ndwi) if raw_ndwi is not None else 0.0
        ndvi = float(raw_ndvi) if raw_ndvi is not None else 0.0
        slope = float(raw_slope) if raw_slope is not None else 0.0
        elevation = float(raw_elevation) if raw_elevation is not None else 0.0
        vh = float(raw_vh) if raw_vh is not None else -18.0

        # 3a. Water body check
        if is_water_layer or ndwi > 0.35:
            water_share = 0.95 if is_water_layer else min(1.0, 0.5 + ndwi)
            other_share = round(1.0 - water_share, 2)
            return LandClassification(
                dominant="WATER_BODY",
                class_shares={"WATER_BODY": water_share, "AGRICULTURAL": other_share},
                subclass="open_water_body",
                legal_forest_status="none",
                confidence=0.92
            )

        # 3b. Dense urban built-up check
        is_urban_layer = any("ghsl" in n or "building" in n or "urban" in n for n in layer_names)
        # Built-up optical signature: low NDVI, negative NDWI, moderate/high VV backscatter
        if is_urban_layer:
            return LandClassification(
                dominant="URBAN_BUILT",
                class_shares={"URBAN_BUILT": 0.85, "AGRICULTURAL": 0.15},
                subclass="dense_settlement",
                legal_forest_status="none",
                confidence=0.90
            )

        # 3c. Wasteland / Barren rocky hill check
        if slope > 22.0 and ndvi < 0.22:
            return LandClassification(
                dominant="WASTELAND",
                class_shares={"WASTELAND": 0.85, "AGRICULTURAL": 0.15},
                subclass="barren_rocky",
                legal_forest_status="none",
                confidence=0.88
            )

        # 3d. Dense Tree Canopy (Forest Cover vs Plantation)
        # If very high NDVI and high radar volume scattering, check if plantation (coffee/areca)
        if ndvi > 0.72 and vh > -13.0:
            # Check elevation & region for Western Ghats plantation zone (Chikkamagaluru, Kodagu, Hassan)
            lat = float(features.get("latitude", 13.0))
            lon = float(features.get("longitude", 75.5))
            is_plantation_zone = (11.5 <= lat <= 14.5) and (75.0 <= lon <= 76.5) and (600 <= elevation <= 1600)
            if is_plantation_zone and slope < 25.0:
                # Commercial plantation: classified as AGRICULTURAL (or UNKNOWN with note)
                return LandClassification(
                    dominant="AGRICULTURAL",
                    class_shares={"AGRICULTURAL": 0.75, "FOREST_COVER": 0.25},
                    subclass="agroforestry_plantation",
                    legal_forest_status="none",
                    confidence=0.82
                )
            else:
                # Physical forest cover without legal layer confirmation
                return LandClassification(
                    dominant="FOREST_COVER",
                    class_shares={"FOREST_COVER": 0.80, "AGRICULTURAL": 0.20},
                    subclass="dense_canopy",
                    legal_forest_status="unknown",
                    confidence=0.85
                )

        # 3e. Standard Agricultural Land (Cropland / Fallow)
        agri_share = 0.88
        other_share = round(1.0 - agri_share, 2)
        sub = "cultivable_cropland" if ndvi >= 0.30 else "seasonal_fallow"
        return LandClassification(
            dominant="AGRICULTURAL",
            class_shares={"AGRICULTURAL": agri_share, "WASTELAND": other_share},
            subclass=sub,
            legal_forest_status="none",
            confidence=0.85
        )


_classifier_instance: LandClassifier | None = None

def get_land_classifier() -> LandClassifier:
    global _classifier_instance
    if _classifier_instance is None:
        _classifier_instance = LandClassifier()
    return _classifier_instance
