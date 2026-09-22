"""
Model A: Land Suitability Classifier & Scorer.
Evaluates soil pH, organic carbon, slope, elevation, NDVI, NDWI, and TWI.
Includes baseline ML/rule scorer and fallback rule evaluator.
"""

from typing import Literal

class ModelASuitability:
    def predict(self, feature_vector: dict, force_fallback: bool = False) -> dict:
        """
        Predicts Land Suitability grade and score.
        Returns: {grade, score, confidence, limiting_factors, is_fallback}
        """
        biome_type = feature_vector.get("biome_type")
        is_arable = feature_vector.get("is_arable", 1.0)

        # 1. HARD GUARDRAIL: OPEN WATER BODY (Oceans, Seas, Deep Lakes)
        if biome_type == "OPEN_WATER" or is_arable == 0.0 and feature_vector.get("is_water") == 1.0:
            return {
                "grade": "Not Suitable (Water Body)",
                "score": 0.0,
                "confidence": 0.99,
                "limiting_factors": [
                    "Coordinates lie in an open water body (Ocean/Sea/Marine waters)",
                    "Zero terrestrial soil substrate present",
                    "Open-field agricultural cultivation is physically impossible"
                ],
                "is_fallback": False
            }

        # 2. HARD GUARDRAIL: POLAR ICE SHEETS (Greenland, Antarctica, High Arctic)
        if biome_type == "POLAR_ICE_SHEET":
            return {
                "grade": "Not Suitable (Polar Glacial)",
                "score": 0.0,
                "confidence": 0.99,
                "limiting_factors": [
                    "Perennial sub-zero polar thermal regime",
                    "Continental ice sheet and continuous permafrost",
                    "Growing season length is 0 frost-free days"
                ],
                "is_fallback": False
            }

        # 3. HARD GUARDRAIL: HIGH ALPINE GLACIAL ROCK (Himalayan / High Alpine Peaks)
        if biome_type == "HIGH_ALPINE_GLACIER":
            return {
                "grade": "Not Suitable (High Alpine Peak)",
                "score": 0.0,
                "confidence": 0.99,
                "limiting_factors": [
                    "Extreme mountain altitude (>4,000m AMSL)",
                    "Perennial snow, ice, and bare exposed rock lithosols",
                    "Continuous sub-zero freezing hazards prevent crop emergence"
                ],
                "is_fallback": False
            }

        if force_fallback:
            return self._fallback_predict(feature_vector)

        try:
            ph = feature_vector.get("ph", 6.5)
            soc = feature_vector.get("organic_carbon_g_kg", 10.0)
            slope = feature_vector.get("slope_mean", feature_vector.get("slope", 2.0))
            twi = feature_vector.get("twi_mean", feature_vector.get("twi", 5.0))
            ndvi = feature_vector.get("ndvi_mean", feature_vector.get("ndvi", 0.65))

            limiting_factors = []
            score = 1.0

            # pH check
            if ph < 5.5 or ph > 8.2:
                score -= 0.25
                limiting_factors.append(f"Sub-optimal soil pH ({ph})")

            # Organic carbon check
            if soc < 5.0:
                score -= 0.20
                limiting_factors.append(f"Low organic carbon content ({soc} g/kg)")

            # Slope check
            if slope > 15.0:
                score -= 0.35
                limiting_factors.append(f"Steep terrain slope ({slope}°)")

            # TWI check
            if twi < 2.0:
                score -= 0.15
                limiting_factors.append("Low topographic wetness index")

            score = max(0.0, min(1.0, score * (0.5 + 0.5 * ndvi)))

            if score >= 0.75:
                grade = "High"
            elif score >= 0.50:
                grade = "Moderate"
            elif score >= 0.30:
                grade = "Low"
            else:
                grade = "Not Suitable"

            return {
                "grade": grade,
                "score": round(score, 3),
                "confidence": 0.90,
                "limiting_factors": limiting_factors,
                "is_fallback": False
            }
        except Exception:
            return self._fallback_predict(feature_vector)

    def _fallback_predict(self, feature_vector: dict) -> dict:
        """Rule-based fallback: NDVI + slope + pH scoring."""
        ndvi = feature_vector.get("ndvi", 0.60)
        slope = feature_vector.get("slope", 3.0)
        ph = feature_vector.get("ph", 6.5)

        score = 0.5 * ndvi + 0.3 * (1.0 if slope < 10 else 0.5) + 0.2 * (1.0 if 5.5 <= ph <= 8.0 else 0.5)
        grade = "High" if score >= 0.7 else ("Moderate" if score >= 0.4 else "Low")

        return {
            "grade": grade,
            "score": round(score, 3),
            "confidence": 0.60,
            "limiting_factors": ["Using fallback suitability evaluation"],
            "is_fallback": True
        }
