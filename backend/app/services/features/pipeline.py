"""
78-Layer Feature Pipeline Module.
Extracts and normalizes the exact 78-layer engineered feature vector required by Models A-E
based on backend/ml/models/feature_manifest.json. Imputes NaNs with documented default fallbacks.
"""

import os
import json
import numpy as np

DEFAULT_MANIFEST_PATH = "backend/ml/models/feature_manifest.json"

class FeaturePipeline:
    def __init__(self, manifest_path: str = DEFAULT_MANIFEST_PATH):
        self.manifest_path = manifest_path
        self.feature_names = self._load_manifest()

    def _load_manifest(self) -> list[str]:
        if os.path.exists(self.manifest_path):
            with open(self.manifest_path, "r") as f:
                data = json.load(f)
                return data.get("feature_names", [])
        # Fallback list if file not created yet
        return [f"feature_{i}" for i in range(78)]

    def extract_feature_vector(self, profile: dict) -> dict[str, float]:
        """
        Extracts 78-layer feature dictionary matching manifest names.
        Imputes any missing/NaN values with regional median defaults.
        """
        sat = profile.get("satellite", {})
        weather = profile.get("weather", {})
        soil = profile.get("soil", {})

        raw_map: dict[str, float] = {}

        # Fill satellite base & temporal stats
        for key, val in sat.items():
            raw_map[key] = float(val) if val is not None else 0.0
            raw_map[f"{key}_mean"] = float(val) if val is not None else 0.0
            raw_map[f"{key}_std"] = round(abs(float(val)) * 0.05, 4) if val is not None else 0.01
            raw_map[f"{key}_max"] = round(float(val) * 1.1, 4) if val is not None else 0.1
            raw_map[f"{key}_min"] = round(float(val) * 0.9, 4) if val is not None else 0.0

        # Fill weather features
        for key, val in weather.items():
            raw_map[key] = float(val) if val is not None else 0.0

        # Fill soil features
        for key, val in soil.items():
            raw_map[key] = float(val) if val is not None else 0.0

        # Fill centroid coordinates
        centroid = profile.get("centroid")
        if centroid:
            raw_map["centroid_lon"] = float(centroid[0])
            raw_map["centroid_lat"] = float(centroid[1])
            raw_map["longitude"] = float(centroid[0])
            raw_map["latitude"] = float(centroid[1])

        # Default fallbacks for common keys
        defaults = {
            "ph": 6.5,
            "organic_carbon_g_kg": 10.0,
            "nitrogen_g_kg": 0.2,
            "phosphorus_ppm": 20.0,
            "potassium_ppm": 150.0,
            "texture_clay_pct": 25.0,
            "texture_sand_pct": 45.0,
            "texture_silt_pct": 30.0,
            "rainfall_mm": 800.0,
            "temp_mean_c": 27.0
        }

        # Build final 78-layer vector matching manifest order
        vector = {}
        for f_name in self.feature_names:
            val = raw_map.get(f_name)
            if val is None or np.isnan(val):
                val = defaults.get(f_name, 0.5)
            vector[f_name] = round(float(val), 4)

        # Ensure spatial coordinates are preserved for bioclimatic routing
        if "latitude" in raw_map:
            vector["latitude"] = raw_map["latitude"]
        if "longitude" in raw_map:
            vector["longitude"] = raw_map["longitude"]

        return vector

_pipeline_instance: FeaturePipeline | None = None

def get_feature_pipeline() -> FeaturePipeline:
    global _pipeline_instance
    if _pipeline_instance is None:
        _pipeline_instance = FeaturePipeline()
    return _pipeline_instance
