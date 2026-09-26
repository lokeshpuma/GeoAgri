"""
Model D: Rule-Based Agronomic Quantile Yield Estimator (P10, P50, P90).
Calculates expected crop yields in tonnes/ha derived from empirical FAO/ICAR baseline
cultivar profiles dynamically modulated across soil organic carbon, thermal regime,
NDVI canopy vigor, soil pH, and precipitation water-balance response curves.
Includes resilient fallback path.
"""

import numpy as np
from app.services.crops.registry import get_crop_registry, QuantileValue


class ModelDYield:
    def __init__(self, model_path: str | None = None):
        # Retained for signature compatibility; estimator uses empirical agronomic curves
        self.model_path = model_path

    def predict(self, feature_vector: dict, force_fallback: bool = False) -> dict:
        """
        Predicts expected yield quantiles (P10, P50, P90) in t/ha per crop.
        Returns dict: {crop_id: {"p10": float, "p50": float, "p90": float, "is_fallback": bool}}
        """
        if force_fallback:
            return self._fallback_predict(feature_vector)

        try:
            registry = get_crop_registry()
            crops = registry.list_crops()

            rainfall = feature_vector.get("rainfall_mm", 800.0)
            soc = feature_vector.get("organic_carbon_g_kg", 10.0)
            ndvi = feature_vector.get("ndvi_mean", feature_vector.get("ndvi", 0.65))
            temp = feature_vector.get("temp_mean_c", feature_vector.get("temperature", 25.0))
            ph = feature_vector.get("ph", 6.5)

            # 1. Soil Organic Carbon (SOC) response curve (reference: 8.0 g/kg)
            # Depleted soils (<3 g/kg) scale down to ~0.60x; rich humus (>18 g/kg) scale up to ~1.45x
            soc_mult = float(np.clip(0.60 + (soc / 8.0) * 0.40, 0.55, 1.45))

            # 2. Canopy Vegetative Vigor (NDVI) response curve
            # Sparse/stressed canopy (<0.35) scales down to ~0.60x; vigorous canopy (>0.75) scales to ~1.35x
            ndvi_mult = float(np.clip(0.45 + ndvi * 0.95, 0.50, 1.40))

            results = {}
            for crop in crops:
                # 3. Moisture / Precipitation water-balance response curve
                if crop.ideal_rainfall_min <= rainfall <= crop.ideal_rainfall_max:
                    rf_mult = 1.15
                elif rainfall < crop.ideal_rainfall_min:
                    deficit_ratio = rainfall / max(50.0, crop.ideal_rainfall_min)
                    rf_mult = float(np.clip(0.50 + 0.55 * deficit_ratio, 0.45, 1.05))
                else:
                    excess_ratio = (rainfall - crop.ideal_rainfall_max) / max(100.0, crop.ideal_rainfall_max)
                    rf_mult = float(np.clip(1.10 - 0.35 * min(1.0, excess_ratio), 0.75, 1.10))

                # 4. Temperature thermal regime response curve
                if crop.ideal_temp_min <= temp <= crop.ideal_temp_max:
                    temp_mult = 1.05
                elif temp < crop.ideal_temp_min:
                    chill_deficit = crop.ideal_temp_min - temp
                    temp_mult = float(np.clip(1.0 - chill_deficit * 0.04, 0.60, 1.0))
                else:
                    heat_excess = temp - crop.ideal_temp_max
                    temp_mult = float(np.clip(1.0 - heat_excess * 0.04, 0.60, 1.0))

                # 5. Soil pH edaphic response curve
                if crop.ideal_ph_min <= ph <= crop.ideal_ph_max:
                    ph_mult = 1.05
                else:
                    ph_dev = min(abs(ph - crop.ideal_ph_min), abs(ph - crop.ideal_ph_max))
                    ph_mult = float(np.clip(1.0 - ph_dev * 0.12, 0.70, 1.0))

                # Total environmental modifier (wide dynamic range ~0.35x to 2.0x)
                combo_mult = float(np.clip(soc_mult * ndvi_mult * rf_mult * temp_mult * ph_mult, 0.35, 2.0))

                # Modulate empirical cultivar baseline quantiles
                base_q = crop.baseline_yield_t_ha
                raw_p10 = base_q.p10
                raw_p50 = base_q.p50
                raw_p90 = base_q.p90

                p10 = round(max(0.1, raw_p10 * combo_mult * 0.90), 2)
                p50 = round(max(p10 * 1.05, raw_p50 * combo_mult), 2)
                p90 = round(max(p50 * 1.05, raw_p90 * combo_mult * 1.10), 2)

                results[crop.crop_id] = {
                    "p10": p10,
                    "p50": p50,
                    "p90": p90,
                    "is_fallback": False
                }
            return results
        except Exception:
            return self._fallback_predict(feature_vector)

    def _fallback_predict(self, feature_vector: dict) -> dict:
        """Historical crop registry median quantiles directly."""
        registry = get_crop_registry()
        crops = registry.list_crops()

        results = {}
        for crop in crops:
            base_q = crop.baseline_yield_t_ha
            results[crop.crop_id] = {
                "p10": base_q.p10,
                "p50": base_q.p50,
                "p90": base_q.p90,
                "is_fallback": True
            }
        return results
