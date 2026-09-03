"""
Unit tests for Phase 5: 5-Model Prediction Stack & Fallback Mechanisms.
"""

import pytest
from app.models.registry import get_model_registry
from app.services.features.pipeline import get_feature_pipeline
from app.services.features.profile import build_environmental_profile

@pytest.mark.asyncio
async def test_parallel_model_execution_baseline():
    polygon = [
        (78.4850, 17.3850),
        (78.4870, 17.3850),
        (78.4870, 17.3870),
        (78.4850, 17.3870),
        (78.4850, 17.3850)
    ]
    profile = await build_environmental_profile(polygon, None, season="kharif")
    vector = get_feature_pipeline().extract_feature_vector(profile)

    registry = get_model_registry()
    outputs = await registry.run_models_parallel(vector, season="kharif")

    assert "model_a" in outputs
    assert "model_b" in outputs
    assert "model_c" in outputs
    assert "model_d" in outputs
    assert "model_e" in outputs
    assert "model_status" in outputs

    assert outputs["model_status"]["model_a"] == "ok"
    assert outputs["model_status"]["model_b"] == "ok"
    assert outputs["model_status"]["model_c"] == "ok"
    assert outputs["model_status"]["model_d"] == "ok"
    assert outputs["model_status"]["model_e"] == "ok"

    assert outputs["model_a"]["grade"] in ["High", "Moderate", "Low", "Not Suitable"]
    assert "rice" in outputs["model_b"]
    assert outputs["model_c"]["rice"]["mode"] in ["rainfed", "supplemental", "full"]
    assert outputs["model_d"]["rice"]["p50"] > 0
    assert 0 <= outputs["model_e"]["rice"]["risk_score"] <= 100

@pytest.mark.asyncio
async def test_forced_fallback_isolation():
    polygon = [
        (78.4850, 17.3850),
        (78.4870, 17.3850),
        (78.4870, 17.3870),
        (78.4850, 17.3870),
        (78.4850, 17.3850)
    ]
    profile = await build_environmental_profile(polygon, None, season="kharif")
    vector = get_feature_pipeline().extract_feature_vector(profile)

    registry = get_model_registry()
    # Force fallback only on Model B and Model D
    outputs = await registry.run_models_parallel(
        vector, season="kharif",
        force_fallbacks={"model_b": True, "model_d": True}
    )

    assert outputs["model_status"]["model_a"] == "ok"
    assert outputs["model_status"]["model_b"] == "fallback"
    assert outputs["model_status"]["model_c"] == "ok"
    assert outputs["model_status"]["model_d"] == "fallback"
    assert outputs["model_status"]["model_e"] == "ok"
