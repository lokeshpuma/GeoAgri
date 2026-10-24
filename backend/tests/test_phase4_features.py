"""
Unit tests for Phase 4: 78-Layer Feature Pipeline & Manifest.
"""

import os
import json
import pytest
from app.services.features.pipeline import get_feature_pipeline, FeaturePipeline
from app.services.features.profile import build_environmental_profile

def test_feature_manifest_exists_and_valid():
    manifest_path = "backend/ml/models/feature_manifest.json" if os.path.exists("backend/ml/models/feature_manifest.json") else "ml/models/feature_manifest.json"
    assert os.path.exists(manifest_path)
    with open(manifest_path, "r") as f:
        data = json.load(f)
    assert data["feature_count"] == 78
    assert len(data["feature_names"]) == 78

@pytest.mark.asyncio
async def test_feature_vector_extraction():
    polygon = [
        (77.5850, 12.9650),
        (77.5870, 12.9650),
        (77.5870, 12.9670),
        (77.5850, 12.9670),
        (77.5850, 12.9650)
    ]
    manual_soil = {"ph": 6.8, "organic_carbon": 12.0}
    profile = await build_environmental_profile(polygon, None, season="kharif", manual_soil=manual_soil)
    pipeline = get_feature_pipeline()
    vector = pipeline.extract_feature_vector(profile)

    assert len(pipeline.feature_names) == 78
    assert all(f_name in vector for f_name in pipeline.feature_names)
    # Honest observation checks: soil and coordinates are preserved
    assert 6.5 <= vector["ph"] <= 7.0
    assert vector["latitude"] is not None
    assert vector["longitude"] is not None

    # Model input layer test: imputes missing features into dense numeric array
    clean_vector, imputed_names = pipeline.impute_for_model(vector)
    for f_name in pipeline.feature_names:
        val = clean_vector[f_name]
        assert val is not None
        assert isinstance(val, (int, float))
        assert not (val != val)  # NaN check
