import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.services.weather.climatology import fetch_monthly_climatology, MonthlyClimatologyResult

client = TestClient(app)

# Standard polygon points: [[lon, lat], ...]
TEST_POLYGON = [
    [75.750, 13.320],
    [75.760, 13.320],
    [75.760, 13.330],
    [75.750, 13.330],
    [75.750, 13.320]
]

TEST_PAYLOAD = {
    "polygon": TEST_POLYGON,
    "soil": {"ph": 6.5, "organic_carbon_g_kg": 5.0, "texture_clay_pct": 20.0},
    "season": "kharif",
    "irrigation_preference": "rainfed"
}

@pytest.mark.asyncio
async def test_climatology_cache_and_cell():
    """Verify climatology service retrieves 0.1 deg grid climatology."""
    clim = await fetch_monthly_climatology(13.32, 75.75)
    assert clim.available is True
    assert len(clim.monthly_temp_c) == 12
    assert len(clim.monthly_rain_mm) == 12
    assert "NASA_POWER" in clim.source


def test_ac7_tier_b_crop_contains_no_yield_numbers():
    """AC-7: API response for a Tier B crop contains no yield fields (expected_yield_t_ha and expected_production_t are None)."""
    resp = client.post("/api/v1/predict/full-report", json=TEST_PAYLOAD)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["climatology_status"] == "available"
    crops = data["recommended_crops"]
    assert len(crops) > 0

    tier_b_crops = [c for c in crops if c.get("confidence_tier") == "B"]
    tier_a_crops = [c for c in crops if c.get("confidence_tier") == "A"]

    assert len(tier_b_crops) > 0, "Response must include Tier B crops from global registry"
    assert len(tier_a_crops) > 0, "Response must include Tier A crops"

    for crop in tier_b_crops:
        assert crop.get("expected_yield_t_ha") is None, f"Tier B crop {crop['crop_name']} should have no yield numbers"
        assert crop.get("expected_production_t") is None, f"Tier B crop {crop['crop_name']} should have no production numbers"
        assert "confidence_tier" in crop and crop["confidence_tier"] == "B"
        assert "limiting_factor" in crop
        assert "best_planting_month" in crop
        assert crop.get("suitability_score") is not None


def test_tier_a_crops_have_yield_and_correct_tier():
    """Verify Tier A crops have ML yield quantiles and confidence_tier='A'."""
    resp = client.post("/api/v1/predict/full-report", json=TEST_PAYLOAD)
    assert resp.status_code == 200
    data = resp.json()
    tier_a_crops = [c for c in data["recommended_crops"] if c.get("confidence_tier") == "A"]
    assert len(tier_a_crops) > 0
    for crop in tier_a_crops:
        assert crop.get("expected_yield_t_ha") is not None
        assert "p10" in crop["expected_yield_t_ha"]
        assert "p50" in crop["expected_yield_t_ha"]
        assert "p90" in crop["expected_yield_t_ha"]


def test_ac8_climatology_failure_returns_unavailable_no_ranking():
    """AC-8: Monthly climatology failure -> 'unavailable', no ranking, no fallback numbers."""
    unavail = MonthlyClimatologyResult(available=False, status_message="NASA POWER API connection failed.")
    with patch("app.api.v1.predict.fetch_monthly_climatology", new=AsyncMock(return_value=unavail)):
        resp = client.post("/api/v1/predict/full-report", json=TEST_PAYLOAD)
        assert resp.status_code == 200
        data = resp.json()
        assert data["climatology_status"] == "unavailable"
        assert "failed" in data["climatology_message"].lower() or "unavailable" in data["climatology_message"].lower()
        # Recommended crops MUST be empty - no ranking, no fallback
        assert len(data["recommended_crops"]) == 0
        assert "Unavailable" in data["yield_summary"]["top_recommended_crop"] or data["yield_summary"]["top_recommended_crop"] == "N/A"
        assert data["yield_summary"]["p50_t_ha"] == 0.0


def test_open_ocean_returns_climatology_unavailable():
    """Coordinates in open ocean return climatology unavailable."""
    ocean_payload = {
        "polygon": [
            [-30.00, 0.00],
            [-29.99, 0.00],
            [-29.99, 0.01],
            [-30.00, 0.01],
            [-30.00, 0.00]
        ],
        "season": "kharif"
    }
    resp = client.post("/api/v1/predict/full-report", json=ocean_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["climatology_status"] == "unavailable"
    assert len(data["recommended_crops"]) == 0
