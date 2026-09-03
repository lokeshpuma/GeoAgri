"""
Model B: Multi-Crop Recommendation Engine (Two-Stage).
Stage 1: ML Random Forest / environmental similarity scorer trained on raw datasets.
Stage 2: Agronomic rule filter (temperature, rainfall, pH, season window).
Includes resilient fallback path.
"""

import os
import joblib
import numpy as np
import pandas as pd
from app.services.crops.registry import get_crop_registry, CropProfile

class ModelBRecommendation:
    def __init__(self, model_path: str | None = None):
        self.model_artifact = None
        self._load_model(model_path)

    def _load_model(self, model_path: str | None = None):
        candidates = [
            model_path,
            "backend/ml/models/crop_recommendation_model.joblib",
            "ml/models/crop_recommendation_model.joblib"
        ]
        for path in candidates:
            if path and os.path.exists(path):
                try:
                    self.model_artifact = joblib.load(path)
                    break
                except Exception:
                    self.model_artifact = None

    def predict(self, feature_vector: dict, season: str = "kharif", force_fallback: bool = False) -> dict:
        """
        Predicts suitability scores for all 100+ registered crops.
        Returns dict: {crop_id: {"score": float, "suitability_score": float, "confidence": float, "is_fallback": bool}}
        """
        if force_fallback:
            return self._fallback_predict(feature_vector, season)

        try:
            registry = get_crop_registry()
            crops = registry.list_crops()
            
            rainfall = feature_vector.get("rainfall_mm", 800.0)
            temp = feature_vector.get("temp_mean_c", 27.0)
            ph = feature_vector.get("ph", 6.5)
            humidity = feature_vector.get("humidity_pct", 70.0)
            ndvi = feature_vector.get("ndvi_mean", feature_vector.get("ndvi", 0.65))
            
            n_val = feature_vector.get("nitrogen_g_kg", 5.0) * 10.0  # approximate kg/ha scale
            p_val = feature_vector.get("phosphorus_ppm", 40.0)
            k_val = feature_vector.get("potassium_ppm", 40.0)

            ml_scores = {}
            if self.model_artifact is not None:
                try:
                    clf = self.model_artifact["model"]
                    classes = self.model_artifact["classes"]
                    input_df = pd.DataFrame([{
                        "N": n_val,
                        "P": p_val,
                        "K": k_val,
                        "temperature": temp,
                        "humidity": humidity,
                        "ph": ph,
                        "rainfall": rainfall
                    }])
                    probs = clf.predict_proba(input_df)[0]
                    for cls_name, prob in zip(classes, probs):
                        ml_scores[cls_name] = float(prob)
                except Exception:
                    pass

            results = {}
            for crop in crops:
                # Stage 2 Agronomic filter penalty
                agronomic_penalty = 1.0

                # Season match check
                if crop.season not in ["annual", "perennial", season]:
                    agronomic_penalty *= 0.5

                # Temp match
                if temp < crop.ideal_temp_min or temp > crop.ideal_temp_max:
                    agronomic_penalty *= 0.7

                # Rainfall match
                if rainfall < crop.ideal_rainfall_min * 0.5:
                    agronomic_penalty *= 0.6

                # pH match
                if ph < crop.ideal_ph_min or ph > crop.ideal_ph_max:
                    agronomic_penalty *= 0.8

                # Stage 1 ML score or environmental similarity
                if crop.crop_id in ml_scores:
                    ml_prob = ml_scores[crop.crop_id]
                    # Blend ML probability with environmental envelope
                    base_score = 0.50 * (ml_prob * 3.0) + 0.50 * (
                        0.40 * (1.0 if crop.ideal_rainfall_min <= rainfall <= crop.ideal_rainfall_max else 0.7) +
                        0.30 * (1.0 if crop.ideal_temp_min <= temp <= crop.ideal_temp_max else 0.7) +
                        0.30 * (1.0 if crop.ideal_ph_min <= ph <= crop.ideal_ph_max else 0.7)
                    )
                else:
                    base_score = 0.40 * (1.0 if crop.ideal_rainfall_min <= rainfall <= crop.ideal_rainfall_max else 0.7) + \
                                 0.30 * (1.0 if crop.ideal_temp_min <= temp <= crop.ideal_temp_max else 0.7) + \
                                 0.30 * (1.0 if crop.ideal_ph_min <= ph <= crop.ideal_ph_max else 0.7)

                blended_score = round(float(np.clip(base_score * agronomic_penalty, 0.05, 1.0)), 3)
                suitability_score = round(float(np.clip(blended_score * (0.8 + 0.2 * ndvi), 0.05, 1.0)), 3)

                results[crop.crop_id] = {
                    "score": blended_score,
                    "suitability_score": suitability_score,
                    "confidence": 0.90 if (crop.crop_id in ml_scores and crop.data_confidence == "high") else (0.75 if crop.data_confidence == "medium" else 0.55),
                    "is_fallback": False
                }
            return results
        except Exception:
            return self._fallback_predict(feature_vector, season)

    def _fallback_predict(self, feature_vector: dict, season: str) -> dict:
        """Agronomic rule filter only fallback."""
        registry = get_crop_registry()
        crops = registry.list_crops()
        rainfall = feature_vector.get("rainfall_mm", 800.0)
        temp = feature_vector.get("temp_mean_c", 27.0)

        results = {}
        for crop in crops:
            score = 0.5
            if crop.season in [season, "annual", "perennial"]:
                score += 0.3
            if crop.ideal_rainfall_min <= rainfall <= crop.ideal_rainfall_max:
                score += 0.2
            results[crop.crop_id] = {
                "score": round(score, 3),
                "suitability_score": round(score * 0.9, 3),
                "confidence": 0.50,
                "is_fallback": True
            }
        return results
