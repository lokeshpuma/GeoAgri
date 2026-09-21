"""
Intercrop Recommendation Service.
Scores companion crops and calculates multi-cropping recommendations.
"""

from __future__ import annotations
from functools import lru_cache
from pathlib import Path
import joblib
import numpy as np

from app.services.crops import intercrop_registry

BASE_DIR = Path(__file__).resolve().parent.parent.parent
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


def _model_probabilities(soil):
    model, meta = _load_model()

    if model is None or meta is None:
        return {}

    if soil is None:
        return {}

    required = ["n", "p", "k"]
    if not all(key in soil for key in required):
        return {}

    features = np.array(
        [
            [
                float(soil.get("n", 0.0)),
                float(soil.get("p", 0.0)),
                float(soil.get("k", 0.0)),
                float(soil.get("temperature", 25.0)),
                float(soil.get("humidity", 60.0)),
                float(soil.get("ph", 6.5)),
                float(soil.get("rainfall", 500.0)),
            ]
        ]
    )

    try:
        probabilities = model.predict_proba(features)[0]
        classes = meta.get("classes", [])

        result = {}
        for crop_class, probability in zip(classes, probabilities):
            crop_id = intercrop_registry.normalize_crop_name(crop_class)
            result[crop_id] = float(probability)

        return result
    except Exception:
        return {}


def recommend_intercrops(env, season, limit=100, soil=None) -> list[dict]:
    crops = intercrop_registry.get_all_crops()
    model_probs = _model_probabilities(soil)

    recommendations = []

    for crop in crops:
        rule_score, notes = _rule_score(crop, env, season)
        model_score = model_probs.get(crop["crop_id"], None)

        if model_score is not None:
            recommendation_score = 0.55 * rule_score + 0.45 * model_score
            notes.append("ML model confidence available")
        else:
            recommendation_score = rule_score

        recommendations.append(
            {
                "crop": crop,
                "rule_score": round(rule_score, 4),
                "model_score": model_score,
                "recommendation_score": round(recommendation_score, 4),
                "rationale_bits": notes,
            }
        )

    recommendations.sort(
        key=lambda item: item["recommendation_score"],
        reverse=True,
    )

    return recommendations[:limit]
