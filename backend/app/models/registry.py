"""
Model Registry & Parallel Async Router.
Invokes Models A, B, C, D, and E in parallel using asyncio.gather.
Enforces fallback table isolation: an exception or timeout in any single model degrades that model to fallback
and sets model_status[model_name] = "fallback" without crashing the pipeline.
"""

import asyncio
from app.models.model_a_suitability.model import ModelASuitability
from app.models.model_b_recommendation.model import ModelBRecommendation
from app.models.model_c_irrigation.model import ModelCIrrigation
from app.models.model_d_yield.model import ModelDYield
from app.models.model_e_climate_risk.model import ModelEClimateRisk

class ModelRegistry:
    def __init__(self):
        self.model_a = ModelASuitability()
        self.model_b = ModelBRecommendation()
        self.model_c = ModelCIrrigation()
        self.model_d = ModelDYield()
        self.model_e = ModelEClimateRisk()

    async def run_models_parallel(
        self,
        feature_vector: dict,
        season: str = "kharif",
        force_fallbacks: dict | None = None
    ) -> dict:
        """
        Runs Models A-E concurrently.
        Returns:
        {
          "model_a": dict,
          "model_b": dict,
          "model_c": dict,
          "model_d": dict,
          "model_e": dict,
          "model_status": {
             "model_a": "ok"|"fallback", ...
          }
        }
        """
        ff = force_fallbacks or {}

        async def _run_a():
            return self.model_a.predict(feature_vector, force_fallback=ff.get("model_a", False))

        async def _run_b():
            return self.model_b.predict(feature_vector, season=season, force_fallback=ff.get("model_b", False))

        async def _run_c():
            return self.model_c.predict(feature_vector, force_fallback=ff.get("model_c", False))

        async def _run_d():
            return self.model_d.predict(feature_vector, force_fallback=ff.get("model_d", False))

        async def _run_e():
            return self.model_e.predict(feature_vector, force_fallback=ff.get("model_e", False))

        # Gather parallel execution safely
        results = await asyncio.gather(
            _run_a(), _run_b(), _run_c(), _run_d(), _run_e(),
            return_exceptions=True
        )

        res_a, res_b, res_c, res_d, res_e = results

        # Process Model A
        if isinstance(res_a, Exception) or not isinstance(res_a, dict):
            res_a = self.model_a._fallback_predict(feature_vector)
            status_a = "fallback"
        else:
            status_a = "fallback" if res_a.get("is_fallback") else "ok"

        # Process Model B
        if isinstance(res_b, Exception) or not isinstance(res_b, dict):
            res_b = self.model_b._fallback_predict(feature_vector, season)
            status_b = "fallback"
        else:
            first_b = next(iter(res_b.values()), {}) if res_b else {}
            status_b = "fallback" if first_b.get("is_fallback") else "ok"

        # Process Model C
        if isinstance(res_c, Exception) or not isinstance(res_c, dict):
            res_c = self.model_c._fallback_predict(feature_vector)
            status_c = "fallback"
        else:
            first_c = next(iter(res_c.values()), {}) if res_c else {}
            status_c = "fallback" if first_c.get("is_fallback") else "ok"

        # Process Model D
        if isinstance(res_d, Exception) or not isinstance(res_d, dict):
            res_d = self.model_d._fallback_predict(feature_vector)
            status_d = "fallback"
        else:
            first_d = next(iter(res_d.values()), {}) if res_d else {}
            status_d = "fallback" if first_d.get("is_fallback") else "ok"

        # Process Model E
        if isinstance(res_e, Exception) or not isinstance(res_e, dict):
            res_e = self.model_e._fallback_predict(feature_vector)
            status_e = "fallback"
        else:
            first_e = next(iter(res_e.values()), {}) if res_e else {}
            status_e = "fallback" if first_e.get("is_fallback") else "ok"

        return {
            "model_a": res_a,
            "model_b": res_b,
            "model_c": res_c,
            "model_d": res_d,
            "model_e": res_e,
            "model_status": {
                "model_a": status_a,
                "model_b": status_b,
                "model_c": status_c,
                "model_d": status_d,
                "model_e": status_e
            }
        }

_model_registry_instance: ModelRegistry | None = None

def get_model_registry() -> ModelRegistry:
    global _model_registry_instance
    if _model_registry_instance is None:
        _model_registry_instance = ModelRegistry()
    return _model_registry_instance
