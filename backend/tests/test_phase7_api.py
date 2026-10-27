"""
End-to-End API Integration tests for Phase 7 FastAPI routes.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"

def test_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert "services" in data
    assert "google_earth_engine" in data["services"]
    assert "database" in data["services"]
    assert "layers" in data
    assert "allow_synthetic_data" in data

def test_crops_list_endpoint():
    response = client.get("/api/v1/crops")
    assert response.status_code == 200
    crops = response.json()
    assert len(crops) >= 100

def test_field_area_endpoint():
    payload = {
        "polygon": [
            [77.5850, 12.9650],
            [77.5870, 12.9650],
            [77.5870, 12.9670],
            [77.5850, 12.9670],
            [77.5850, 12.9650]
        ]
    }
    response = client.post("/api/v1/field/area", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["polygon_valid"] is True
    assert data["area_ha"] > 0

def test_predict_full_report_e2e():
    from unittest.mock import patch, AsyncMock
    agri_profile = {
        "field_summary": {
            "area_ha": 2.0,
            "centroid_lon": 75.75,
            "centroid_lat": 13.32,
            "polygon_valid": True,
            "boundary_source": "user_drawn"
        },
        "centroid": (75.75, 13.32),
        "season": "kharif",
        "satellite": {
            "ndwi": -0.05,
            "ndvi": 0.65,
            "evi": 0.50,
            "savi": 0.45,
            "ndmi": 0.30,
            "elevation": 700.0,
            "slope": 2.5,
            "twi": 8.0,
            "vv": -12.0,
            "vh": -18.0
        },
        "weather": {
            "rainfall_mm": 950.0,
            "temp_max_c": 31.0,
            "temp_min_c": 21.0,
            "temp_mean_c": 26.0,
            "humidity_pct": 72.0,
            "solar_radiation_mj_m2": 19.0
        },
        "soil": {
            "ph": 6.8,
            "organic_carbon_g_kg": 14.0,
            "nitrogen_g_kg": 1.1,
            "phosphorus_ppm": 25.0,
            "potassium_ppm": 140.0,
            "texture_clay_pct": 22.0,
            "texture_sand_pct": 45.0,
            "texture_silt_pct": 33.0
        }
    }
    payload = {
        "polygon": [
            [75.750, 13.320],
            [75.752, 13.320],
            [75.752, 13.322],
            [75.750, 13.322],
            [75.750, 13.320]
        ],
        "season": "kharif",
        "limit": 10,
        "irrigation_preference": "rainfed",
        "manual_soil": {
            "ph": 6.8,
            "organic_carbon": 12.0
        }
    }
    with patch("app.api.v1.predict.build_environmental_profile", new_callable=AsyncMock, return_value=agri_profile):
        response = client.post("/api/v1/predict/full-report", json=payload)
    assert response.status_code == 200
    data = response.json()

    # Validate response schema keys
    assert "field_summary" in data
    assert "land_suitability" in data
    assert "environment" in data
    assert "satellite_features" in data
    assert "recommended_crops" in data
    assert "yield_summary" in data
    assert "production_summary" in data
    assert "irrigation_summary" in data
    assert "climate_risk_summary" in data
    assert "intercrop_summary" in data
    assert "model_status" in data

    assert len(data["recommended_crops"]) == 10
    top_crop = data["recommended_crops"][0]
    assert "expected_yield_t_ha" in top_crop
    assert "expected_production_t" in top_crop
    assert top_crop["expected_production_t"]["p50"] > 0
    assert "disclaimer" in data["intercrop_summary"]
