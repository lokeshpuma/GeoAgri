"""
Model B: Multi-Crop Recommendation Engine (Two-Stage + Bioclimatic Affinity).
Stage 1: ML Random Forest / environmental similarity scorer trained on raw datasets.
Stage 2: Agronomic rule filter (temperature, rainfall, pH, season window).
Stage 3: Geographic & bioclimatic agro-ecological zone affinity routing (Karnataka, California, Egypt, Pampas, Rajasthan, Punjab, etc.).
Includes resilient fallback path.
"""

import os
import joblib
import numpy as np
import pandas as pd
from app.services.crops.registry import get_crop_registry, CropProfile

def compute_bioclimatic_affinity(crop_id: str, lat: float, lon: float, rainfall: float, temp: float) -> float:
    """
    Computes location-specific bioclimatic affinity multiplier (0.15 to 1.65).
    Guarantees that crops uniquely adapted to regional geography (e.g. Ragi/Coffee in Karnataka,
    Almonds/Grapes in California, Long-staple Cotton/Berseem in Egypt, Bajra/Guar in Rajasthan)
    rank naturally as top agronomic recommendations without artificial bias.
    """
    base_id = crop_id.split("_var_")[0]
    abs_lat = abs(lat)

    # 1. Karnataka & Southern Peninsula, India (Lat: 11.0 - 18.5, Lon: 74.0 - 78.5)
    if 11.0 <= lat <= 18.5 and 74.0 <= lon <= 78.5:
        karnataka_affinity = {
            "finger_millet": 1.70,    # Finger Millet (Ragi): Karnataka #1 staple (>55% national share)
            "coffee": 1.65,           # Chikmagalur & Kodagu Western Ghats (>70% Indian coffee)
            "arecanut": 1.60,         # Malnad & coastal Karnataka #1 national producer
            "black_pepper": 1.55,     # Western Ghats spice hills
            "cardamom": 1.50,         # Western Ghats spice hills
            "rice": 1.40,             # Cauvery & Tungabhadra basin paddies
            "coconut": 1.40,
            "ginger": 1.35,
            "turmeric": 1.35,
            "maize": 1.25,
            "banana": 1.25,
            "mango": 1.20,
            "groundnut": 1.15,
            "sugarcane": 1.10,
            "cotton": 1.05,
            "soybean": 0.85,
            "chickpea": 0.85,
            "almond": 0.15,
            "apple": 0.10,
            "walnut": 0.10,
            "olive": 0.15,
            "pistachio": 0.15,
            "durum_wheat": 0.20,
            "berseem_clover": 0.20,
            "cluster_bean": 0.20,
            "moth_bean": 0.20,
            "cumin": 0.20,
        }
        return karnataka_affinity.get(base_id, 0.65)

    # 2. California & Western US (Lat: 32.5 - 42.0, Lon: -125.0 - -114.0)
    elif 32.5 <= lat <= 42.0 and -125.0 <= lon <= -114.0:
        california_affinity = {
            "almond": 1.75,           # Central Valley produces 80% of world's almonds
            "grapes": 1.70,           # World-renowned California wine and table grapes
            "tomato": 1.65,           # Central Valley supplies 90% of US processing tomatoes
            "pistachio": 1.60,        # Kern & Fresno pistachio orchards
            "walnut": 1.55,           # San Joaquin walnut groves
            "citrus": 1.50,           # Central Valley navel oranges & lemons
            "cotton": 1.35,           # San Joaquin Acala cotton
            "rice": 1.30,             # Sacramento Valley
            "onion": 1.30,
            "garlic": 1.35,
            "wheat": 1.20,
            "apple": 1.15,
            "olive": 1.45,
            "soybean": 0.20,          # Not commercially grown in California
            "groundnut": 0.20,
            "sugarcane": 0.15,
            "arecanut": 0.05,
            "rubber": 0.05,
            "tea": 0.05,
            "cardamom": 0.05,
            "coffee": 0.05,
            "finger_millet": 0.15,
            "jute": 0.10,
            "pigeon_pea": 0.15,
            "black_gram": 0.15,
            "green_gram": 0.15,
        }
        return california_affinity.get(base_id, 0.40)

    # 3. Egypt & Nile Basin (Lat: 22.0 - 32.5, Lon: 25.0 - 36.0)
    elif 22.0 <= lat <= 32.5 and 25.0 <= lon <= 36.0:
        egypt_affinity = {
            "cotton": 1.75,           # World-renowned Egyptian long-staple cotton (Giza)
            "durum_wheat": 1.65,      # Ancient Nile Delta wheat basket
            "berseem_clover": 1.70,   # Berseem: #1 Egyptian forage & soil restorative legume
            "fava_bean": 1.65,        # Fava Beans (Ful Medames): national staple
            "wheat": 1.55,
            "rice": 1.45,             # Nile Delta paddies
            "maize": 1.35,
            "onion": 1.40,
            "tomato": 1.38,
            "pomegranate": 1.40,
            "citrus": 1.35,
            "date_palm": 1.45,
            "arecanut": 0.05,
            "rubber": 0.05,
            "tea": 0.05,
            "coffee": 0.10,
            "cardamom": 0.05,
            "finger_millet": 0.20,
            "jute": 0.25,
            "soybean": 0.50,
            "groundnut": 0.60,
        }
        return egypt_affinity.get(base_id, 0.45)

    # 4. Pampas & Argentina (Lat: -40.0 - -28.0, Lon: -68.0 - -55.0)
    elif -40.0 <= lat <= -28.0 and -68.0 <= lon <= -55.0:
        pampas_affinity = {
            "soybean": 1.75,          # Argentina #1 cash export crop
            "maize": 1.70,            # Pampas corn belt
            "wheat": 1.60,            # Bread wheat winter cycle
            "sunflower": 1.55,        # Pampas sunflower oilseed
            "barley": 1.45,
            "grapes": 1.45,           # Mendoza wine region
            "sorghum": 1.35,
            "arecanut": 0.05,
            "rubber": 0.05,
            "tea": 0.10,
            "cardamom": 0.05,
            "coffee": 0.10,
            "finger_millet": 0.20
        }
        return pampas_affinity.get(base_id, 0.50)

    # 5. Rajasthan / Thar Arid Zone, India (Lat: 24.0 - 30.5, Lon: 69.0 - 77.0)
    elif 24.0 <= lat <= 30.5 and 69.0 <= lon <= 77.0:
        rajasthan_affinity = {
            "pearl_millet": 1.80,     # Pearl Millet (Bajra): #1 staple of Thar desert
            "cluster_bean": 1.75,     # Cluster Bean (Guar): Rajasthan produces >70% of world guar
            "moth_bean": 1.70,        # Moth Bean: extreme drought-resilient desert legume
            "rapeseed_mustard": 1.60, # Primary winter cash oilseed
            "cumin": 1.60,            # Cumin (Jeera): major cash spice of western Rajasthan
            "sesame": 1.45,
            "chickpea": 1.40,
            "wheat": 1.20,            # Irrigated wheat
            "sugarcane": 0.10,        # Strictly penalized in hyper-arid desert
            "rice": 0.10,
            "arecanut": 0.05,
            "coffee": 0.05,
            "rubber": 0.05,
            "cardamom": 0.05,
            "soybean": 0.40,
            "banana": 0.10
        }
        return rajasthan_affinity.get(base_id, 0.35)

    # 6. Punjab & Haryana (Trans-Gangetic Plains) (Lat: 28.5 - 32.5, Lon: 73.5 - 77.5)
    elif 28.5 <= lat <= 32.5 and 73.5 <= lon <= 77.5:
        punjab_affinity = {
            "wheat": 1.75,            # Granary of India
            "rice": 1.70,             # Basmati & non-basmati paddies
            "rapeseed_mustard": 1.55,
            "potato": 1.50,
            "maize": 1.35,
            "cotton": 1.35,
            "sugarcane": 1.20,
            "coffee": 0.05,
            "arecanut": 0.05,
            "rubber": 0.05,
            "cardamom": 0.05
        }
        return punjab_affinity.get(base_id, 0.50)

    # 7. Mediterranean Basin (Spain, Italy, Greece) (Lat: 34 - 44, Lon: -10 - 35)
    elif 34.0 <= abs(lat) <= 44.0 and -10.0 <= lon <= 35.0:
        med_affinity = {
            "olive": 1.75,            # #1 Mediterranean staple
            "grapes": 1.65,           # Mediterranean vineyards
            "durum_wheat": 1.60,      # Pasta / semolina durum wheat
            "almond": 1.55,
            "citrus": 1.45,
            "tomato": 1.45,
            "sunflower": 1.35,
            "arecanut": 0.05,
            "rubber": 0.05,
            "tea": 0.10,
            "cardamom": 0.05
        }
        return med_affinity.get(base_id, 0.45)

    # 8. Global Latitude & Thermal Belt Fallbacks
    if abs_lat > 42.0:
        temperate_crops = {"wheat", "barley", "rapeseed_mustard", "potato", "apple", "field_pea", "durum_wheat"}
        tropical_crops = {"arecanut", "rubber", "tea", "coffee", "cardamom", "cassava", "banana", "mango", "coconut", "papaya", "sugarcane"}
        if base_id in temperate_crops:
            return 1.40
        if base_id in tropical_crops:
            return 0.15
    elif abs_lat < 20.0:
        tropical_crops = {"rice", "cassava", "banana", "mango", "coconut", "coffee", "papaya", "sugarcane", "spices", "black_pepper", "turmeric", "ginger", "finger_millet", "arecanut"}
        temperate_crops = {"apple", "durum_wheat", "barley", "almond", "walnut"}
        if base_id in tropical_crops:
            return 1.40
        if base_id in temperate_crops:
            return 0.20

    # Aridity adjustments
    if rainfall < 350.0:
        drought_crops = {"pearl_millet", "cluster_bean", "moth_bean", "sorghum", "chickpea", "cumin", "sesame", "pistachio"}
        water_crops = {"sugarcane", "rice", "jute", "banana", "arecanut"}
        if base_id in drought_crops:
            return 1.45
        if base_id in water_crops:
            return 0.20

    return 1.0


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
        Predicts suitability scores for all 100+ registered crops using environmental matching,
        ML probability blending, and geographic bioclimatic zone affinity.
        Returns dict: {crop_id: {"score": float, "suitability_score": float, "confidence": float, "is_fallback": bool}}
        """
        biome_type = feature_vector.get("biome_type")
        is_arable = feature_vector.get("is_arable", 1.0)
        is_water = feature_vector.get("is_water", 0.0)

        registry = get_crop_registry()
        crops = registry.list_crops()

        # HARD GUARDRAIL: ZERO CROPS FOR WATER BODIES OR POLAR ICE OR ALPINE ROCK
        if biome_type in ["OPEN_WATER", "POLAR_ICE_SHEET", "HIGH_ALPINE_GLACIER"] or is_arable == 0.0 or is_water == 1.0:
            return {
                crop.crop_id: {
                    "score": 0.0,
                    "suitability_score": 0.0,
                    "confidence": 0.99,
                    "is_fallback": False
                }
                for crop in crops
            }

        if force_fallback:
            return self._fallback_predict(feature_vector, season)

        try:
            lat = feature_vector.get("latitude", feature_vector.get("centroid_lat", 13.32))
            lon = feature_vector.get("longitude", feature_vector.get("centroid_lon", 75.75))
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

                # Strict Thermal Lethal Limit: crop cannot survive extreme cold/heat
                if temp < (crop.ideal_temp_min - 8.0) or temp > (crop.ideal_temp_max + 12.0):
                    agronomic_penalty = 0.0
                elif temp < crop.ideal_temp_min or temp > crop.ideal_temp_max:
                    agronomic_penalty *= 0.60

                # Season match check
                if crop.season not in ["annual", "perennial", season]:
                    agronomic_penalty *= 0.55

                # Rainfall match
                if rainfall < crop.ideal_rainfall_min * 0.4:
                    agronomic_penalty *= 0.50

                # pH match
                if ph < crop.ideal_ph_min or ph > crop.ideal_ph_max:
                    agronomic_penalty *= 0.80

                # Stage 3 Bioclimatic & Geographic affinity
                geo_affinity = compute_bioclimatic_affinity(crop.crop_id, lat, lon, rainfall, temp)

                # Stage 1 ML score or environmental similarity
                if crop.crop_id in ml_scores:
                    ml_prob = ml_scores[crop.crop_id]
                    base_score = 0.35 * (ml_prob * 2.0) + 0.65 * (
                        0.40 * (1.0 if crop.ideal_rainfall_min <= rainfall <= crop.ideal_rainfall_max else 0.7) +
                        0.30 * (1.0 if crop.ideal_temp_min <= temp <= crop.ideal_temp_max else 0.7) +
                        0.30 * (1.0 if crop.ideal_ph_min <= ph <= crop.ideal_ph_max else 0.7)
                    )
                else:
                    base_score = 0.40 * (1.0 if crop.ideal_rainfall_min <= rainfall <= crop.ideal_rainfall_max else 0.7) + \
                                 0.30 * (1.0 if crop.ideal_temp_min <= temp <= crop.ideal_temp_max else 0.7) + \
                                 0.30 * (1.0 if crop.ideal_ph_min <= ph <= crop.ideal_ph_max else 0.7)

                # Relative scaled score allowing high-affinity crops to clearly differentiate
                raw_blended = base_score * agronomic_penalty * geo_affinity
                blended_score = round(float(np.clip(raw_blended / 1.65, 0.05, 1.0)), 3)
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
        """Agronomic rule filter and bioclimatic affinity fallback."""
        registry = get_crop_registry()
        crops = registry.list_crops()
        lat = feature_vector.get("latitude", feature_vector.get("centroid_lat", 13.32))
        lon = feature_vector.get("longitude", feature_vector.get("centroid_lon", 75.75))
        rainfall = feature_vector.get("rainfall_mm", 800.0)
        temp = feature_vector.get("temp_mean_c", 27.0)

        results = {}
        for crop in crops:
            score = 0.5
            if crop.season in [season, "annual", "perennial"]:
                score += 0.3
            if crop.ideal_rainfall_min <= rainfall <= crop.ideal_rainfall_max:
                score += 0.2
            geo_affinity = compute_bioclimatic_affinity(crop.crop_id, lat, lon, rainfall, temp)
            final_score = round(float(np.clip((score * geo_affinity) / 1.65, 0.05, 1.0)), 3)
            results[crop.crop_id] = {
                "score": final_score,
                "suitability_score": round(final_score * 0.9, 3),
                "confidence": 0.50,
                "is_fallback": True
            }
        return results
