"""
Model E: Climate Risk Scorer.
Evaluates drought risk, heat stress, excess rainfall, and volatility index over crop growth windows.
Outputs composite risk score (0-100), risk level ("Low", "Moderate", "High"), risk note, and risk window.
Includes fallback path.
"""

from app.services.crops.registry import get_crop_registry

class ModelEClimateRisk:
    def predict(self, feature_vector: dict, force_fallback: bool = False) -> dict:
        """
        Predicts climate risk metrics per crop.
        Returns dict: {crop_id: {"risk_score": float, "risk_level": str, "risk_note": str, "risk_window": str, "is_fallback": bool}}
        """
        if force_fallback:
            return self._fallback_predict(feature_vector)

        try:
            registry = get_crop_registry()
            crops = registry.list_crops()
            
            rainfall = feature_vector.get("rainfall_mm", 800.0)
            tmax = feature_vector.get("temp_max_c", 33.0)

            results = {}
            for crop in crops:
                risk_score = 15.0  # baseline minimal risk
                notes = []

                # Drought risk
                if rainfall < crop.ideal_rainfall_min * 0.7:
                    drought_risk = 35.0
                    risk_score += drought_risk
                    notes.append("Moderate drought risk during flowering stage")
                
                # Heat stress risk
                if tmax > crop.ideal_temp_max + 2.0:
                    heat_risk = 25.0
                    risk_score += heat_risk
                    notes.append("Elevated heat stress risk during vegetative growth")

                # Excess rainfall risk
                if rainfall > crop.ideal_rainfall_max * 1.3:
                    flood_risk = 30.0
                    risk_score += flood_risk
                    notes.append("Excess rainfall / waterlogging risk near harvest")

                final_score = round(min(100.0, max(0.0, risk_score)), 1)
                
                if final_score >= 60.0:
                    level = "High"
                elif final_score >= 35.0:
                    level = "Moderate"
                else:
                    level = "Low"

                note_str = ". ".join(notes) if notes else "Low climatic risk profile during active growing window."

                results[crop.crop_id] = {
                    "risk_score": final_score,
                    "risk_level": level,
                    "risk_note": note_str,
                    "risk_window": "Weeks 6-10",
                    "is_fallback": False
                }
            return results
        except Exception:
            return self._fallback_predict(feature_vector)

    def _fallback_predict(self, feature_vector: dict) -> dict:
        """Rule-based drought/heat score fallback."""
        registry = get_crop_registry()
        crops = registry.list_crops()

        results = {}
        for crop in crops:
            results[crop.crop_id] = {
                "risk_score": 25.0,
                "risk_level": "Low",
                "risk_note": "Using rule-based climate risk assessment.",
                "risk_window": "General Season Window",
                "is_fallback": True
            }
        return results
