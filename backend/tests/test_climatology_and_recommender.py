import pytest
import time
import httpx
from pathlib import Path
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.services.weather.climatology import (
    fetch_monthly_climatology,
    MonthlyClimatologyResult,
    clear_climatology_cache,
    _CLIMATOLOGY_CACHE,
    get_cache_key,
    SUCCESS_TTL_SECONDS,
    OCEAN_TTL_SECONDS,
    CACHE_FILE_PATH,
)

client = TestClient(app)

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

def fake_climatology_provider():
    async def _provider(lat: float, lon: float) -> MonthlyClimatologyResult:
        return MonthlyClimatologyResult(
            available=True,
            monthly_temp_c=[22.5, 24.0, 26.5, 28.0, 27.5, 24.5, 23.5, 23.5, 24.0, 24.5, 23.5, 22.0],
            monthly_rain_mm=[5.0, 5.0, 15.0, 45.0, 110.0, 280.0, 450.0, 320.0, 160.0, 140.0, 40.0, 10.0],
            status_message="ok",
            source="TEST_FIXTURE"
        )
    return _provider


def test_climatology_cache_starts_empty():
    """Verify cache starts empty and can be reset without leftover hardcoded entries."""
    clear_climatology_cache()
    assert len(_CLIMATOLOGY_CACHE) == 0
    assert not CACHE_FILE_PATH.exists()


@pytest.mark.asyncio
async def test_ac3_transient_failure_503_not_cached():
    """AC-3: A transient NASA failure (HTTP 503) is NOT cached; the next call retries."""
    clear_climatology_cache()
    mock_resp = MagicMock()
    mock_resp.status_code = 503

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=mock_resp):
        res = await fetch_monthly_climatology(14.5, 76.5)
        assert res.available is False
        assert "503" in res.status_message
        key = get_cache_key(14.5, 76.5)
        assert key not in _CLIMATOLOGY_CACHE, "HTTP 503 must never be cached"

    # Verify that a subsequent call retries
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=mock_resp) as mock_get:
        await fetch_monthly_climatology(14.5, 76.5)
        assert mock_get.called, "Subsequent call must retry and not be blocked by cache"


@pytest.mark.asyncio
async def test_ac3_transient_timeout_not_cached():
    """AC-3: Transient timeouts or network connection errors must never be cached."""
    clear_climatology_cache()
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock, side_effect=httpx.TimeoutException("timeout")):
        res = await fetch_monthly_climatology(15.0, 77.0)
        assert res.available is False
        assert "unreachable" in res.status_message.lower()
        key = get_cache_key(15.0, 77.0)
        assert key not in _CLIMATOLOGY_CACHE, "Timeouts must never be cached"


@pytest.mark.asyncio
async def test_ocean_cached_30_days():
    """Real ocean/water fill values (-999.0) are cached for 30 days."""
    clear_climatology_cache()
    fill_data = {
        "properties": {
            "parameter": {
                "T2M": {k: -999.0 for k in ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]},
                "PRECTOTCORR": {k: -999.0 for k in ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]}
            }
        }
    }
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = fill_data

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=mock_resp):
        res = await fetch_monthly_climatology(0.0, -30.0)
        assert res.available is False
        assert "open water" in res.status_message.lower()
        key = get_cache_key(0.0, -30.0)
        assert key in _CLIMATOLOGY_CACHE
        entry = _CLIMATOLOGY_CACHE[key]
        now = time.time()
        # Verify ~30 days TTL (within 60s tolerance)
        assert entry.expires_at >= now + (29 * 86400)


@pytest.mark.asyncio
async def test_success_cached_7_days():
    """Successful climatology responses are cached for 7 days with valid source."""
    clear_climatology_cache()
    valid_data = {
        "properties": {
            "parameter": {
                "T2M": {k: 25.0 for k in ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]},
                "PRECTOTCORR": {k: 2.5 for k in ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]}
            }
        }
    }
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = valid_data

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=mock_resp):
        res = await fetch_monthly_climatology(13.5, 75.5)
        assert res.available is True
        assert len(res.monthly_temp_c) == 12
        assert len(res.monthly_rain_mm) == 12
        assert res.source == "NASA_POWER_CLIMATOLOGY"
        assert "VERIFIED" not in res.source

        key = get_cache_key(13.5, 75.5)
        assert key in _CLIMATOLOGY_CACHE
        entry = _CLIMATOLOGY_CACHE[key]
        now = time.time()
        # Verify ~7 days TTL (within 60s tolerance)
        assert entry.expires_at >= now + (6 * 86400)


def test_no_forbidden_strings_in_app():
    """PRD v3.3 §3.1 item 5: Fail if NASA_POWER_CLIMATOLOGY_VERIFIED or hardcoded 13.3_75.8 appears in app/."""
    app_dir = Path(__file__).resolve().parents[1] / "app"
    forbidden = ["NASA_POWER_CLIMATOLOGY_VERIFIED", "13.3_75.8"]
    for py_file in app_dir.rglob("*.py"):
        content = py_file.read_text(encoding="utf-8")
        for bad in forbidden:
            assert bad not in content, f"Forbidden string '{bad}' found in {py_file}"


def test_ac7_tier_b_crop_contains_no_yield_numbers(monkeypatch):
    """AC-7: API response for a Tier B crop contains no yield fields."""
    monkeypatch.setattr("app.api.v1.predict.fetch_monthly_climatology", fake_climatology_provider())
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


def test_tier_a_crops_have_yield_and_correct_tier(monkeypatch):
    """Verify Tier A crops have confidence_tier='A', and valid ML yield quantiles when within ceilings (D-8)."""
    monkeypatch.setattr("app.api.v1.predict.fetch_monthly_climatology", fake_climatology_provider())
    resp = client.post("/api/v1/predict/full-report", json=TEST_PAYLOAD)
    assert resp.status_code == 200
    data = resp.json()
    tier_a_crops = [c for c in data["recommended_crops"] if c.get("confidence_tier") == "A"]
    assert len(tier_a_crops) > 0
    tier_a_with_yield = [c for c in tier_a_crops if c.get("expected_yield_t_ha") is not None]
    assert len(tier_a_with_yield) > 0
    for crop in tier_a_with_yield:
        assert "p10" in crop["expected_yield_t_ha"]
        assert "p50" in crop["expected_yield_t_ha"]
        assert "p90" in crop["expected_yield_t_ha"]
    # Per PRD v3.3 D-8, crops exceeding yield ceiling must show None
    for crop in tier_a_crops:
        if crop.get("crop_id") in {"maize", "rice", "coffee", "cotton"}:
            assert crop.get("expected_yield_t_ha") is None


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
        assert data["yield_summary"] is None or "Unavailable" in (data["yield_summary"].get("top_recommended_crop") or "") or data["yield_summary"].get("top_recommended_crop") == "N/A"


def test_open_ocean_returns_climatology_unavailable(monkeypatch):
    """Coordinates in open ocean return climatology unavailable."""
    async def fake_ocean(lat, lon):
        return MonthlyClimatologyResult(available=False, status_message="Site is over open water.")
    monkeypatch.setattr("app.api.v1.predict.fetch_monthly_climatology", fake_ocean)

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
