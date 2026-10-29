"""
Tests for Feature Honesty and Error Handling (PRD v2.1 M18, M26).
Ensures missing data is never filled with silent constants, and error handling produces honest typed outcomes.
"""
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.services.features.pipeline import get_feature_pipeline
from app.services.landclass.classifier import get_land_classifier
from app.services.irrigability.engine import get_irrigability_engine

client = TestClient(app)


def test_all_missing_profile_yields_unknown_and_unverified():
    """M18 Gate: All-missing profile must yield observed_feature_share==0, land class UNKNOWN, irrigability UNVERIFIED."""
    empty_profile = {
        "field_summary": {"area_ha": None, "centroid_lon": None, "centroid_lat": None},
        "centroid": None,
        "satellite": {},
        "weather": {},
        "soil": {}
    }
    pipeline = get_feature_pipeline()
    vector = pipeline.extract_feature_vector(empty_profile)

    import numpy as np
    # Count observed features (must be 0)
    observed = sum(1 for f in pipeline.feature_names if vector.get(f) is not None and not (isinstance(vector.get(f), float) and np.isnan(vector.get(f))))
    assert observed == 0, f"Expected 0 observed features for empty profile, found {observed}"
    observed_feature_share = observed / len(pipeline.feature_names)
    assert observed_feature_share == 0.0

    classifier = get_land_classifier()
    land_class = classifier.classify(vector)
    assert land_class.dominant == "UNKNOWN", f"Expected UNKNOWN dominant class, got {land_class.dominant}"

    engine = get_irrigability_engine()
    irrigability = engine.evaluate(land_class, vector)
    assert irrigability.verdict == "UNVERIFIED", f"Expected UNVERIFIED verdict, got {irrigability.verdict}"
    assert irrigability.crop_models == "skipped_not_irrigable"


def test_invalid_polygon_returns_400():
    """M26 Gate: Invalid geometry (fewer than 3 points or out-of-bound coords) must return HTTP 400."""
    payload_too_few = {
        "polygon": [[77.5, 12.9], [77.6, 12.9]],  # only 2 points
        "season": "kharif"
    }
    resp1 = client.post("/api/v1/predict/full-report", json=payload_too_few)
    assert resp1.status_code == 400
    assert "Invalid polygon geometry" in resp1.json()["detail"]

    payload_out_of_bounds = {
        "polygon": [[200.0, 12.9], [77.6, 12.9], [77.6, 13.0], [200.0, 12.9]],  # lon 200 > 180
        "season": "kharif"
    }
    resp2 = client.post("/api/v1/predict/full-report", json=payload_out_of_bounds)
    assert resp2.status_code == 400
    assert "out of bounds" in resp2.json()["detail"]


def test_forced_evidence_exception_returns_503_unavailable():
    """PRD v3.4 §3.3 (H-5, AC-4): Upstream evidence total failure must return HTTP 503 EVIDENCE_UNAVAILABLE, not 200 with fabricated zeros."""
    with patch(
        "app.api.v1.predict.build_environmental_profile",
        side_effect=RuntimeError("Sentinel-2 API network timeout")
    ):
        payload = {
            "polygon": [
                [77.5850, 12.9650],
                [77.5870, 12.9650],
                [77.5870, 12.9670],
                [77.5850, 12.9670],
                [77.5850, 12.9650]
            ],
            "season": "kharif"
        }
        response = client.post("/api/v1/predict/full-report", json=payload)
        assert response.status_code == 503
        data = response.json()
        assert data["detail"]["code"] == "EVIDENCE_UNAVAILABLE"
        assert "setup_hint" in data["detail"]
