"""
Model C: Irrigation Feasibility Engine.
Calculates water balance: crop water requirement (ET0 x Kc) vs effective rainfall & soil water contribution.
Outputs mode ("rainfed", "supplemental", "full"), water need mm, effective rainfall mm, and deficit mm.
Includes fallback path.
"""

from typing import Literal
from app.services.crops.registry import get_crop_registry

class ModelCIrrigation:
    def predict(self, feature_vector: dict, force_fallback: bool = False) -> dict:
        """
        Predicts irrigation feasibility per crop.
        Returns dict: {crop_id: {"mode": str, "water_need_mm": float, "effective_rainfall_mm": float, "deficit_mm": float, "is_fallback": bool}}
        """
        if force_fallback:
            return self._fallback_predict(feature_vector)

        try:
            registry = get_crop_registry()
            crops = registry.list_crops()
            
            seasonal_rainfall = feature_vector.get("rainfall_mm", 800.0)
            # Effective rainfall ~ 75% of seasonal rainfall
            effective_rainfall = round(seasonal_rainfall * 0.75, 1)
            soil_moisture_contrib = 50.0  # mm from root zone

            results = {}
            for crop in crops:
                water_need = crop.water_need_mm
                available_water = effective_rainfall + soil_moisture_contrib
                deficit = round(max(0.0, water_need - available_water), 1)

                if deficit <= 50.0:
                    mode = "rainfed"
                elif deficit <= 250.0:
                    mode = "supplemental"
                else:
                    mode = "full"

                results[crop.crop_id] = {
                    "mode": mode,
                    "water_need_mm": round(water_need, 1),
                    "effective_rainfall_mm": effective_rainfall,
                    "deficit_mm": deficit,
                    "is_fallback": False
                }
            return results
        except Exception:
            return self._fallback_predict(feature_vector)

    def _fallback_predict(self, feature_vector: dict) -> dict:
        """Fallback water requirement thresholding."""
        registry = get_crop_registry()
        crops = registry.list_crops()
        rainfall = feature_vector.get("rainfall_mm", 800.0)

        results = {}
        for crop in crops:
            mode = "rainfed" if rainfall >= crop.water_need_mm else ("supplemental" if rainfall >= crop.water_need_mm * 0.6 else "full")
            results[crop.crop_id] = {
                "mode": mode,
                "water_need_mm": crop.water_need_mm,
                "effective_rainfall_mm": round(rainfall * 0.7, 1),
                "deficit_mm": max(0.0, crop.water_need_mm - rainfall),
                "is_fallback": True
            }
        return results
