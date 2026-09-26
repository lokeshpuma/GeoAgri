"""
Intercrop Recommendation Service.
Scores companion crops and calculates multi-cropping recommendations.
"""

from __future__ import annotations
from functools import lru_cache
from pathlib import Path
import joblib
import numpy as np
import pandas as pd

from app.services.crops import intercrop_registry

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
MODELS_DIR = BASE_DIR / "ml" / "models"
MODEL_PATH = MODELS_DIR / "crop_recommender.pkl"
META_PATH = MODELS_DIR / "crop_recommender_meta.pkl"


@lru_cache(maxsize=1)
def _load_model():
    if not MODEL_PATH.exists() or not META_PATH.exists():
        return None, None

    try:
        model = joblib.load(MODEL_PATH)
        meta = joblib.load(META_PATH)
        return model, meta
    except Exception:
        return None, None


def _clamp(value, min_value=0.0, max_value=1.0):
    return max(min_value, min(max_value, value))


def _range_score(value, low, high, tolerance=0.35):
    try:
        value = float(value)
        low = float(low)
        high = float(high)
    except Exception:
        return 0.0

    if low <= value <= high:
        return 1.0

    span = max(high - low, 1.0)

    if value < low:
        distance = (low - value) / span
    else:
        distance = (value - high) / span

    return max(0.0, 1.0 - distance / tolerance)


def _rule_score(crop, env, season):
    notes = []

    season_score = 1.0
    crop_seasons = crop.get("seasons", ["kharif"])
    if season not in crop_seasons and "perennial" not in crop_seasons and "annual" not in crop_seasons:
        season_score = 0.20
        notes.append("season mismatch")

    temp_score = _range_score(
        env.get("temp_c", env.get("temp_mean_c", 25.0)),
        crop["temp_min_c"],
        crop["temp_max_c"],
    )

    rain_score = _range_score(
        env.get("rainfall_mm", 600.0),
        crop["rain_min_mm"],
        crop["rain_max_mm"],
    )

    ph_score = _range_score(
        env.get("ph", 6.5),
        crop["ph_min"],
        crop["ph_max"],
    )

    total = 0.35 * season_score + 0.25 * temp_score + 0.25 * rain_score + 0.15 * ph_score
    return round(_clamp(total), 4), notes


def _model_probabilities(soil, env=None):
    model, meta = _load_model()

    if model is None or meta is None or soil is None:
        return {}

    soil_clean = {str(k).lower(): v for k, v in soil.items()} if isinstance(soil, dict) else {}
    env_clean = {str(k).lower(): v for k, v in env.items()} if isinstance(env, dict) else {}

    required = ["n", "p", "k"]
    if not all(key in soil_clean for key in required):
        return {}

    try:
        n_val = float(soil_clean.get("n", 0.0))
        p_val = float(soil_clean.get("p", 0.0))
        k_val = float(soil_clean.get("k", 0.0))

        temp_val = float(
            soil_clean.get("temperature",
                soil_clean.get("temp",
                    env_clean.get("temp_c",
                        env_clean.get("temp_mean_c",
                            env_clean.get("temperature", 25.0)))))
        )
        hum_val = float(
            soil_clean.get("humidity",
                env_clean.get("humidity_pct",
                    env_clean.get("humidity", 60.0)))
        )
        ph_val = float(
            soil_clean.get("ph",
                env_clean.get("ph", 6.5))
        )
        rain_val = float(
            soil_clean.get("rainfall",
                env_clean.get("rainfall_mm",
                    env_clean.get("rainfall", 500.0)))
        )

        feat_names = meta.get("features", ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"])
        features_df = pd.DataFrame(
            [[n_val, p_val, k_val, temp_val, hum_val, ph_val, rain_val]],
            columns=feat_names,
        )
        probabilities = model.predict_proba(features_df)[0]
        classes = meta.get("classes", [])

        result = {}
        for crop_class, probability in zip(classes, probabilities):
            crop_id = intercrop_registry.normalize_crop_name(crop_class)
            result[crop_id] = float(probability)

        return result
    except Exception:
        return {}


def recommend_intercrops(env, season, limit=100, soil=None, only_validated=False) -> list[dict]:
    crops = intercrop_registry.get_all_crops()
    model_probs = _model_probabilities(soil, env=env)

    recommendations = []

    for crop in crops:
        is_validated = (crop.get("data_confidence") == "high")
        if only_validated and not is_validated:
            continue

        rule_score, notes = _rule_score(crop, env, season)
        model_score = model_probs.get(crop["crop_id"], None)

        if is_validated:
            if model_score is not None:
                recommendation_score = 0.45 * rule_score + 0.55 * model_score
                confidence = "high"
                confidence_score = round(0.80 + 0.19 * model_score, 4)
                notes.append("ML model confidence available")
            else:
                recommendation_score = rule_score
                confidence = "medium"
                confidence_score = 0.70
        else:
            # Low confidence crop without real empirical grounding
            confidence = "low"
            confidence_score = 0.35
            # Scale down low confidence unvalidated crops so they do not artificially dominate validated crops
            recommendation_score = round(rule_score * 0.70, 4)
            notes.append("Recommendation based on low-confidence unvalidated data")

        recommendations.append(
            {
                "crop": crop,
                "crop_id": crop["crop_id"],
                "crop_name": crop.get("crop_name", crop["crop_id"]),
                "rule_score": round(rule_score, 4),
                "model_score": round(model_score, 4) if model_score is not None else None,
                "recommendation_score": round(recommendation_score, 4),
                "confidence": confidence,
                "confidence_score": confidence_score,
                "is_validated": is_validated,
                "rationale_bits": notes,
            }
        )

    recommendations.sort(
        key=lambda item: item["recommendation_score"],
        reverse=True,
    )

    return recommendations[:limit]
