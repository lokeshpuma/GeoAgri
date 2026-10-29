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

def test_health_sources_endpoint():
    """PRD v3.4 §5.3, AC-11: GET /api/v1/health/sources reports source readiness without secrets."""
    response = client.get("/api/v1/health/sources")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "sources" in data
    sources = data["sources"]
    assert "earth_engine" in sources
    assert "nasa_power" in sources
    assert "soilgrids" in sources
    assert "rules" in sources
    assert "registry" in sources
    assert "models" in sources

    # Ensure no credentials or keys are exposed
    raw_text = str(data).lower()
    for secret_keyword in ["private_key", "client_email", "bearer", "password", "service_account_token"]:
        assert secret_keyword not in raw_text

def test_no_personal_user_paths():
    """PRD v3.4 §5.2, AC-11: No personal user paths exist in backend, scripts, or github configs."""
    import subprocess
    from pathlib import Path

    # Locate repo root reliably whether run from repo root or from backend/
    here = Path(__file__).resolve().parent
    repo_root = here.parent.parent if here.parent.name == "backend" else here.parent
    if not (repo_root / "backend").exists():
        repo_root = Path.cwd()
        if (repo_root.parent / "backend").exists():
            repo_root = repo_root.parent

    target_dirs = []
    for d in ["backend", "scripts", ".github"]:
        p = repo_root / d
        if p.exists():
            target_dirs.append(f'"{p}"')

    targets = " ".join(target_dirs)
    pat = "/Us" + "ers/" + "\\|C:\\\\" + "Users"
    cmd = f'grep -rn --exclude-dir="venv" --exclude-dir=".pytest_cache" --exclude-dir="__pycache__" --exclude=".env" --exclude=".env.*" --exclude="*.env" --exclude="*.json" --exclude="test_phase7_api.py" "{pat}" {targets}'
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    assert res.returncode == 1, f"Found hardcoded user paths in backend:\n{res.stdout}"

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
    from app.services.weather.climatology import MonthlyClimatologyResult
    fixture_climatology = MonthlyClimatologyResult(
        available=True,
        monthly_temp_c=[24.0, 26.0, 28.0, 30.0, 29.0, 26.0, 25.0, 25.0, 25.5, 26.0, 25.0, 24.0],
        monthly_rain_mm=[5.0, 8.0, 15.0, 45.0, 85.0, 150.0, 220.0, 180.0, 140.0, 110.0, 35.0, 10.0],
        status_message="ok",
        source="TEST_FIXTURE"
    )

    with patch("app.api.v1.predict.build_environmental_profile", new_callable=AsyncMock, return_value=agri_profile), \
         patch("app.api.v1.predict.fetch_monthly_climatology", return_value=fixture_climatology):
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
