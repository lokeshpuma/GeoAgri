"""
Tests for Evidence Contract and Truthful Data (PRD v3.4 W2, AC-4, AC-7, H-5, K-3).
"""
import os
import re
from pathlib import Path
from unittest.mock import patch, AsyncMock
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.weather.climatology import MonthlyClimatologyResult

client = TestClient(app)

SAMPLE_POLYGON = [
    [77.50, 12.90],
    [77.51, 12.90],
    [77.51, 12.91],
    [77.50, 12.91],
    [77.50, 12.90],
]


def test_scan_no_invented_literals_in_api():
    """
    PRD v3.4 AC-4 / Section 3.3:
    A scan test fails on the literals ph=7.0, ndvi=0.0, rainfall_mm=0.0 inside app/api.
    """
    api_dir = Path(__file__).resolve().parent.parent / "app" / "api"
    assert api_dir.exists(), f"API dir {api_dir} not found"

    forbidden_patterns = [
        re.compile(r"ph\s*=\s*7\.0"),
        re.compile(r"ndvi\s*=\s*0\.0"),
        re.compile(r"rainfall_mm\s*=\s*0\.0"),
    ]

    violations = []
    for py_file in api_dir.rglob("*.py"):
        text = py_file.read_text(encoding="utf-8")
        for pat in forbidden_patterns:
            matches = pat.findall(text)
            if matches:
                violations.append(f"{py_file.name}: found forbidden literal '{matches[0]}'")

    assert not violations, f"Forbidden default literals found in API layer:\n" + "\n".join(violations)


def test_all_external_sources_fail_returns_503_evidence_unavailable():
    """
    PRD v3.4 AC-4 / Section 3.3:
    If satellite, weather, and soil retrieval all fail:
    Returns HTTP 503 with {"code":"EVIDENCE_UNAVAILABLE","missing_sources":[...],"setup_hint":"..."}
    where setup_hint for Earth Engine names the environment variables to set.
    """
    with patch("app.services.features.profile.fetch_satellite_features",
               side_effect=RuntimeError("GEE not configured")), \
         patch("app.services.features.profile.fetch_weather_data",
               new_callable=AsyncMock, side_effect=RuntimeError("Weather unreachable")), \
         patch("app.services.features.profile.fetch_soil_data",
               new_callable=AsyncMock, side_effect=RuntimeError("Soil unreachable")), \
         patch("app.api.v1.predict.fetch_monthly_climatology",
               new_callable=AsyncMock, side_effect=RuntimeError("POWER unreachable")):

        resp = client.post("/api/v1/predict/full-report", json={
            "polygon": SAMPLE_POLYGON,
            "season": "kharif"
        })

        assert resp.status_code == 503, f"Expected 503, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "detail" in data
        detail = data["detail"]
        assert detail.get("code") == "EVIDENCE_UNAVAILABLE"
        assert "setup_hint" in detail
        hint = detail["setup_hint"]
        assert "GEE_SERVICE_ACCOUNT_EMAIL" in hint or "ALLOW_SYNTHETIC_DATA" in hint
        assert "missing_sources" in detail
        assert len(detail["missing_sources"]) > 0


def test_partial_evidence_returns_200_with_nulls(monkeypatch):
    """
    PRD v3.4 AC-4 / Section 3.3:
    If Earth Engine is unavailable but weather/soil/climatology succeeds:
    HTTP 200 is returned with analysis_status='partial', nulls for missing satellite features,
    and no invented 0.0 values.
    """
    from app.core.config import get_settings
    monkeypatch.setenv("GEE_MOCK_FALLBACK", "false")
    monkeypatch.setenv("ALLOW_SYNTHETIC_DATA", "false")
    get_settings.cache_clear()

    fake_climatology = MonthlyClimatologyResult(
        available=True,
        monthly_temp_c=[20.0] * 12,
        monthly_rain_mm=[80.0] * 12,
        source="TEST_FIXTURE",
        status_message="ok"
    )
    fake_weather = {
        "annual_rainfall_mm": 950.0,
        "growing_season_rainfall_mm": 500.0,
        "mean_temp_c": 24.5,
        "max_temp_c": 32.0,
        "min_temp_c": 18.0,
    }
    fake_soil = {
        "ph": 6.8,
        "clay_fraction": 0.25,
        "sand_fraction": 0.40,
        "organic_carbon_g_kg": 12.0,
        "bulk_density_kg_dm3": 1.35,
    }

    with patch("app.services.features.profile.fetch_satellite_features",
               side_effect=RuntimeError("GEE credentials missing")), \
         patch("app.services.features.profile.fetch_weather_data",
               new_callable=AsyncMock, return_value=fake_weather), \
         patch("app.services.features.profile.fetch_soil_data",
               new_callable=AsyncMock, return_value=fake_soil), \
         patch("app.api.v1.predict.fetch_monthly_climatology",
               new_callable=AsyncMock, return_value=fake_climatology):

        resp = client.post("/api/v1/predict/full-report", json={
            "polygon": SAMPLE_POLYGON,
            "season": "kharif"
        })

        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()

        # Status must be partial
        assert data.get("analysis_status") == "partial"

        # Check sources list
        sources = data.get("sources", [])
        assert len(sources) >= 3
        gee_status = next((s for s in sources if s["name"] == "google_earth_engine"), None)
        assert gee_status is not None
        assert gee_status["state"] == "failed"

        # Satellite feature must be null/None, NOT 0.0
        sat = data.get("satellite_features")
        assert sat is None or sat.get("ndvi_mean") is None

        # Data mode must be live when no synthetic fallback is active
        assert data.get("data_mode") == "live"


def test_data_mode_demo_synthetic_when_flag_enabled(monkeypatch):
    """
    PRD v3.4 AC-6 / Section 3.5:
    When synthetic fallback is active, data_mode must be 'demo_synthetic'.
    """
    from app.core.config import get_settings
    monkeypatch.setenv("ALLOW_SYNTHETIC_DATA", "true")
    get_settings.cache_clear()

    fake_climatology = MonthlyClimatologyResult(
        available=True,
        monthly_temp_c=[20.0] * 12,
        monthly_rain_mm=[80.0] * 12,
        source="TEST_FIXTURE",
        status_message="ok"
    )
    fake_weather = {
        "annual_rainfall_mm": 950.0,
        "growing_season_rainfall_mm": 500.0,
        "mean_temp_c": 24.5,
        "max_temp_c": 32.0,
        "min_temp_c": 18.0,
    }
    fake_soil = {
        "ph": 6.8,
        "clay_fraction": 0.25,
        "sand_fraction": 0.40,
        "organic_carbon_g_kg": 12.0,
        "bulk_density_kg_dm3": 1.35,
    }

    with patch("app.services.features.profile.fetch_satellite_features",
               return_value={"ndvi_mean": 0.55, "elevation_m": 450.0, "slope_deg": 2.0}), \
         patch("app.services.features.profile.fetch_weather_data",
               new_callable=AsyncMock, return_value=fake_weather), \
         patch("app.services.features.profile.fetch_soil_data",
               new_callable=AsyncMock, return_value=fake_soil), \
         patch("app.api.v1.predict.fetch_monthly_climatology",
               new_callable=AsyncMock, return_value=fake_climatology):

        resp = client.post("/api/v1/predict/full-report", json={
            "polygon": SAMPLE_POLYGON,
            "season": "kharif"
        })

        assert resp.status_code == 200
        assert resp.json().get("data_mode") == "demo_synthetic"


def test_partial_evidence_when_gee_and_soil_fail_returns_200(monkeypatch):
    """
    When both GEE and SoilGrids fail, but weather/climatology succeeds:
    HTTP 200 is returned with analysis_status='partial', soil and satellite fields null,
    and no AttributeError or 500 error occurs.
    """
    from app.core.config import get_settings
    monkeypatch.setenv("GEE_MOCK_FALLBACK", "false")
    monkeypatch.setenv("ALLOW_SYNTHETIC_DATA", "false")
    get_settings.cache_clear()

    fake_climatology = MonthlyClimatologyResult(
        available=True,
        monthly_temp_c=[20.0] * 12,
        monthly_rain_mm=[80.0] * 12,
        source="TEST_FIXTURE",
        status_message="ok"
    )
    fake_weather = {
        "rainfall_mm": 500.0,
        "temp_max_c": 32.0,
        "temp_min_c": 18.0,
        "temp_mean_c": 24.5,
        "humidity_pct": 65.0,
        "solar_radiation_mj_m2": 18.0,
    }

    with patch("app.services.features.profile.fetch_satellite_features",
               side_effect=RuntimeError("GEE credentials missing")), \
         patch("app.services.features.profile.fetch_weather_data",
               new_callable=AsyncMock, return_value=fake_weather), \
         patch("app.services.features.profile.fetch_soil_data",
               side_effect=RuntimeError("Soil data unavailable")), \
         patch("app.api.v1.predict.fetch_monthly_climatology",
               new_callable=AsyncMock, return_value=fake_climatology):

        resp = client.post("/api/v1/predict/full-report", json={
            "polygon": SAMPLE_POLYGON,
            "season": "kharif"
        })

        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("analysis_status") == "partial"
        assert data.get("satellite_features") is None
        assert data.get("environment") is not None
        assert data["environment"]["ph"] is None
        assert data["environment"]["rainfall_mm"] == 500.0


