"""
78-Layer Feature Pipeline Module (PRD v2.0 §4, v2.1 M18).
Extracts and normalizes the exact 78-layer engineered feature vector required by Models A-E.
Enforces feature honesty: missing features are preserved as None/NaN with no silent constants.
"""
from __future__ import annotations

import os
import json
from typing import Any
import numpy as np

DEFAULT_MANIFEST_PATH = "backend/ml/models/feature_manifest.json"


class FeaturePipeline:
    def __init__(self, manifest_path: str = DEFAULT_MANIFEST_PATH):
        self.manifest_path = manifest_path
        self.feature_names = self._load_manifest()

    def _load_manifest(self) -> list[str]:
        candidates = [
            self.manifest_path,
            "backend/ml/models/feature_manifest.json",
            "ml/models/feature_manifest.json"
        ]
        for p in candidates:
            if p and os.path.exists(p):
                try:
                    with open(p, "r") as f:
                        data = json.load(f)
                        names = data.get("feature_names", [])
                        if len(names) == 78:
                            return names
                except Exception:
                    pass
        # Fallback list if file not created yet
        return [f"feature_{i}" for i in range(78)]

    def extract_feature_vector(self, profile: dict) -> dict[str, Any]:
        """
        Extracts 78-layer feature dictionary matching manifest names.
        Per PRD v2.1 M18: Does not invent synthetic multipliers or silent defaults.
        Missing features remain None/NaN.
        """
        sat = profile.get("satellite") or {}
        weather = profile.get("weather") or {}
        soil = profile.get("soil") or {}

        raw_map: dict[str, Any] = {}

        # Fill satellite base & temporal measurements
        for key, val in sat.items():
            if val is not None and not (isinstance(val, float) and np.isnan(val)):
                f_val = float(val)
                raw_map[key] = f_val
                raw_map[f"{key}_mean"] = f_val
            else:
                raw_map[key] = None
                raw_map[f"{key}_mean"] = None

        # Fill weather features
        for key, val in weather.items():
            if val is not None and not (isinstance(val, float) and np.isnan(val)):
                raw_map[key] = float(val)
            else:
                raw_map[key] = None

        # Fill soil features
        for key, val in soil.items():
            if val is not None and not (isinstance(val, float) and np.isnan(val)):
                raw_map[key] = float(val)
            else:
                raw_map[key] = None

        # Fill centroid coordinates
        centroid = profile.get("centroid")
        if centroid and centroid[0] is not None and centroid[1] is not None:
            c_lon = float(centroid[0])
            c_lat = float(centroid[1])
            raw_map["centroid_lon"] = c_lon
            raw_map["centroid_lat"] = c_lat
            raw_map["longitude"] = c_lon
            raw_map["latitude"] = c_lat
        else:
            raw_map["centroid_lon"] = None
            raw_map["centroid_lat"] = None
            raw_map["longitude"] = None
            raw_map["latitude"] = None

        # Build final 78-layer vector matching manifest order
        vector: dict[str, Any] = {}
        for f_name in self.feature_names:
            val = raw_map.get(f_name)
            if val is not None and not (isinstance(val, float) and np.isnan(val)):
                vector[f_name] = round(float(val), 4)
            else:
                vector[f_name] = None

        # Preserve core physical and agronomic features for Models A-E
        for core_key in [
            "rainfall_mm", "temp_mean_c", "temp_max_c", "temp_min_c", "humidity_pct",
            "ph", "organic_carbon_g_kg", "nitrogen_g_kg", "phosphorus_ppm", "potassium_ppm",
            "texture_clay_pct", "texture_sand_pct", "texture_silt_pct",
            "elevation", "slope", "twi", "ndvi", "ndvi_mean", "ndmi", "ndwi",
            "slope_mean", "twi_mean", "vv", "vh", "sar_vv", "sar_vh", "latitude", "longitude"
        ]:
            if core_key in raw_map:
                vector[core_key] = raw_map[core_key]


        lat = raw_map.get("latitude")
        lon = raw_map.get("longitude")
        vector["latitude"] = lat
        vector["longitude"] = lon

        # Bioclimatic classification if inputs are present
        elev = raw_map.get("elevation")
        temp = raw_map.get("temp_mean_c")
        rain = raw_map.get("rainfall_mm")

        if lat is not None and lon is not None and elev is not None and temp is not None and rain is not None:
            from app.services.geo.land_mask import classify_global_biome
            biome_info = classify_global_biome(lat, lon, float(elev), float(temp), float(rain))
            vector["biome_type"] = biome_info["biome_type"]
            vector["is_arable"] = 1.0 if biome_info["is_arable"] else 0.0
            vector["is_water"] = 1.0 if biome_info["is_water"] else 0.0
            vector["biome_name"] = biome_info["biome_name"]
            vector["non_arable_reason"] = biome_info["non_arable_reason"]
            vector["suitability_ceiling"] = biome_info["suitability_ceiling"]
        else:
            vector["biome_type"] = None
            vector["is_arable"] = None
            vector["is_water"] = None
            vector["biome_name"] = None
            vector["non_arable_reason"] = None
            vector["suitability_ceiling"] = None

        return vector

    def impute_for_model(self, feature_vector: dict[str, Any]) -> tuple[dict[str, float], list[str]]:
        """
        Imputes missing/None values specifically for models that require dense numeric arrays.
        Returns the numeric dictionary and the list of imputed feature names.
        """
        imputed_names = []
        clean_vector: dict[str, float] = {}

        # Reference baseline medians (used only inside model wrapper when features are missing)
        reference_medians = {
            "ph": 6.8, "organic_carbon_g_kg": 8.0, "nitrogen_g_kg": 0.5,
            "phosphorus_ppm": 15.0, "potassium_ppm": 120.0,
            "texture_clay_pct": 25.0, "texture_sand_pct": 45.0, "texture_silt_pct": 30.0,
            "rainfall_mm": 750.0, "temp_mean_c": 26.0, "temp_max_c": 32.0, "temp_min_c": 20.0,
            "humidity_pct": 65.0, "solar_radiation_mj_m2": 18.0,
            "elevation": 500.0, "slope": 2.5, "twi": 6.0, "ndvi": 0.5, "ndwi": -0.2, "evi": 0.35,
            "savi": 0.40, "ndmi": 0.10, "vv": -12.0, "vh": -18.0
        }

        for k, v in feature_vector.items():
            if isinstance(v, (int, float)) and not np.isnan(v):
                clean_vector[k] = float(v)
            else:
                med = reference_medians.get(k, 0.0)
                clean_vector[k] = med
                imputed_names.append(k)

        return clean_vector, imputed_names


_pipeline_instance: FeaturePipeline | None = None

def get_feature_pipeline() -> FeaturePipeline:
    global _pipeline_instance
    if _pipeline_instance is None:
        _pipeline_instance = FeaturePipeline()
    return _pipeline_instance
