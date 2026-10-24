"""
E2E and Integration Tests for Land Inquiry, Document Upload, and Prediction Gating (PRD v2.0 §7, §9, §10, v2.1 M13, M14, M21).
"""
import glob
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_land_providers_endpoint():
    response = client.get("/api/v1/land/providers")
    assert response.status_code == 200
    providers = response.json()
    assert len(providers) >= 4
    provider_ids = [p["id"] for p in providers]
    assert "user_document" in provider_ids
    assert "ksrsac_official" in provider_ids
    assert "bhuvan_wms" in provider_ids
    assert "open_layers" in provider_ids


def test_land_inquiry_point_post():
    payload = {
        "point": [75.75, 13.32]
    }
    response = client.post("/api/v1/land/inquiry", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["query"]["area_ha"] is None
    assert "land_class" in data
    assert "irrigability" in data
    assert "land_records" in data
    assert data["irrigability"]["verdict"] in [
        "IRRIGABLE", "CONDITIONALLY_IRRIGABLE", "NOT_IRRIGABLE", "NOT_IRRIGABLE_PROVISIONAL", "UNVERIFIED"
    ]


def test_land_inquiry_get():
    response = client.get("/api/v1/land/inquiry?lat=13.32&lon=75.75")
    assert response.status_code == 200
    data = response.json()
    assert "land_class" in data
    assert "assessment_timestamp" in data


def test_land_record_upload_and_pii_strip():
    rtc_text = """
    Karnataka Land Records - Pahani
    Survey No: 88, Hissa: 1A
    Extent: 1.5 Ha
    Land: Khushki
    Owner: Suresh Patel
    Aadhaar: 1111-2222-3333
    """
    response = client.post(
        "/api/v1/land/records/upload",
        files={"file": ("pahani.txt", rtc_text.encode("utf-8"), "text/plain")}
    )
    assert response.status_code == 200
    res = response.json()
    assert res["status"] == "success"
    assert "doc_token" in res
    summary = res["summary"]
    assert summary["survey_number"] == "88"
    assert summary["hissa_number"] == "1A"
    assert summary["verification"] == "user_provided"
    assert "suresh" not in str(summary).lower()
    assert "1111" not in str(summary).lower()


def test_prediction_gating_bypasses_models_for_non_irrigable_plot(monkeypatch):
    """
    When a plot is classified as water body or wasteland, Model A-E execution must be bypassed and crops empty.
    Per M21: Never patches LandClassifier.classify; stubs the raster/environmental input only.
    """
    water_profile = {
        "field_summary": {
            "area_ha": 2.5,
            "centroid_lon": 77.586,
            "centroid_lat": 12.966,
            "polygon_valid": True,
            "boundary_source": "user_drawn"
        },
        "centroid": (77.586, 12.966),
        "season": "kharif",
        "satellite": {
            "ndwi": 0.65,
            "ndvi": -0.20,
            "evi": -0.10,
            "savi": -0.10,
            "ndmi": 0.50,
            "elevation": 800.0,
            "slope": 1.0,
            "twi": 12.0,
            "vv": -15.0,
            "vh": -25.0
        },
        "weather": {
            "rainfall_mm": 800.0,
            "temp_max_c": 30.0,
            "temp_min_c": 20.0,
            "temp_mean_c": 25.0,
            "humidity_pct": 70.0,
            "solar_radiation_mj_m2": 18.0
        },
        "soil": {
            "ph": 7.0,
            "organic_carbon_g_kg": 15.0,
            "nitrogen_g_kg": 1.2,
            "phosphorus_ppm": None,
            "potassium_ppm": None,
            "texture_clay_pct": 20.0,
            "texture_sand_pct": 40.0,
            "texture_silt_pct": 40.0
        }
    }

    with patch("app.api.v1.predict.build_environmental_profile", new_callable=AsyncMock, return_value=water_profile):
        payload = {
            "polygon": [
                [77.5850, 12.9650],
                [77.5870, 12.9650],
                [77.5870, 12.9670],
                [77.5850, 12.9670],
                [77.5850, 12.9650]
            ],
            "season": "kharif",
            "limit": 10,
            "irrigation_preference": "rainfed"
        }
        response = client.post("/api/v1/predict/full-report", json=payload)
        assert response.status_code == 200
        data = response.json()

        # Gate asserts:
        assert data["land_class"]["dominant"] == "WATER_BODY"
        assert data["irrigability"]["verdict"] == "NOT_IRRIGABLE"
        assert data["recommended_crops"] == []
        assert data["model_status"]["model_a"] == "skipped_not_irrigable"
        assert data["model_status"]["model_b"] == "skipped_not_irrigable"
        assert data["model_status"]["model_c"] == "skipped_not_irrigable"
        assert data["model_status"]["model_d"] == "skipped_not_irrigable"
        assert data["model_status"]["model_e"] == "skipped_not_irrigable"
        assert data["land_suitability"]["grade"] == "Not Suitable"
        assert "water" in data["irrigability"]["reasons"][0]["rule_id"].lower()


@pytest.mark.asyncio
async def test_no_coordinate_defaults_to_agricultural():
    """Regression test M21: An unverified/reference coordinate must never return a fake agricultural record."""
    from app.services.landrecords.manager import LandRecordManager
    mgr = LandRecordManager()
    statuses, rec = await mgr.query_record(lon=68.1234, lat=10.5678)
    assert rec is None, f"Expected record=None for unindexed coordinates, got {rec}"


def test_meta_no_tests_patch_classifier():
    """Meta-test M21: CI must reject any test that patches LandClassifier.classify directly."""
    for filepath in glob.glob("tests/**/*.py", recursive=True):
        with open(filepath, "r") as f:
            content = f.read()
            # Check for patch("app.services.landclass.classifier.LandClassifier.classify" or similar
            if "test_meta_no_tests_patch_classifier" not in content:
                assert "LandClassifier.classify" not in content, (
                    f"Test file {filepath} violates M21 by attempting to patch LandClassifier.classify"
                )
