"""
E2E and Integration Tests for Land Inquiry, Document Upload, and Prediction Gating (PRD v2.0 §7, §9, §10, M6, M7).
"""
import pytest
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
    """When a plot is classified as water body or wasteland, Model A-E execution must be bypassed and crops empty."""
    from unittest.mock import patch
    from app.schemas.predict import LandClassification

    fake_water = LandClassification(
        dominant="WATER_BODY",
        class_shares={"WATER_BODY": 1.0},
        confidence=0.98
    )

    with patch("app.services.landclass.classifier.LandClassifier.classify", return_value=fake_water):
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
        assert data["irrigability"]["verdict"] == "NOT_IRRIGABLE"
        assert data["recommended_crops"] == []
        assert data["model_status"]["model_a"] == "skipped_not_irrigable"
        assert data["model_status"]["model_b"] == "skipped_not_irrigable"
        assert data["model_status"]["model_c"] == "skipped_not_irrigable"
        assert data["model_status"]["model_d"] == "skipped_not_irrigable"
        assert data["model_status"]["model_e"] == "skipped_not_irrigable"
        assert data["land_suitability"]["grade"] == "Not Suitable"
        assert "water" in data["irrigability"]["reasons"][0]["rule_id"].lower()
