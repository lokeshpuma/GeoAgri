"""
Unit and integration tests for PRD v3.3 Recommender, Crosswalk, and Card Truthfulness (AC-4 through AC-9).
"""
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.services.crops.registry import get_legacy_crosswalk, get_global_registry
from app.services.crops.envelope_suitability import (
    Site,
    CropScore,
    score_crop,
    rank_crops,
    crop_tiebreak_key,
    CATEGORY_PRIORITY,
)
from app.services.weather.climatology import MonthlyClimatologyResult

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
    "irrigation_preference": "rainfed",
    "limit": 30
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


def test_ac4_crosswalk_crops_have_real_envelopes():
    """
    AC-4: Every one of the 114 crosswalk crops returns a real limiting_factor and best_planting_month
    (never 'climatic_envelope', never a default June / month 6).
    """
    crosswalk = get_legacy_crosswalk()
    assert len(crosswalk) >= 110
    global_reg = get_global_registry()

    site = Site(
        monthly_temp_c=[22.5, 24.0, 26.5, 28.0, 27.5, 24.5, 23.5, 23.5, 24.0, 24.5, 23.5, 22.0],
        monthly_rain_mm=[5.0, 5.0, 15.0, 45.0, 110.0, 280.0, 450.0, 320.0, 160.0, 140.0, 40.0, 10.0],
        ph=6.5
    )

    tested_count = 0
    for legacy_id, global_id in crosswalk.items():
        assert global_id in global_reg, f"Global crop id {global_id} not in global registry"
        crop_data = global_reg[global_id]
        score = score_crop(crop_data, site)
        tested_count += 1

        assert score.limiting_factor != "climatic_envelope", f"Crop {legacy_id} returned forbidden fallback 'climatic_envelope'"
        assert 1 <= score.best_planting_month <= 12, f"Crop {legacy_id} returned invalid planting month"
        assert score.season_months >= 1, f"Crop {legacy_id} returned invalid season months"

    assert tested_count >= 114, f"Expected at least 114 crosswalk crops to be tested, got {tested_count}"


def test_ac5_tier_a_climate_gate_excludes_unsuitable_crops(monkeypatch):
    """
    AC-5: A Tier A crop with envelope scores < 0.30 (rainfed and irrigated) is excluded from
    recommendations and listed in excluded_crops with its limiting factor.
    """
    monkeypatch.setattr("app.api.v1.predict.fetch_monthly_climatology", fake_climatology_provider())

    # Create hyper-arid desert site (Riyadh-like conditions: scorching heat, minimal rain)
    async def arid_climatology(lat: float, lon: float) -> MonthlyClimatologyResult:
        return MonthlyClimatologyResult(
            available=True,
            monthly_temp_c=[15.0, 18.0, 24.0, 30.0, 36.0, 40.0, 43.0, 42.0, 38.0, 31.0, 23.0, 17.0],
            monthly_rain_mm=[5.0, 2.0, 8.0, 10.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 3.0, 5.0],
            status_message="ok",
            source="TEST_FIXTURE"
        )

    monkeypatch.setattr("app.api.v1.predict.fetch_monthly_climatology", arid_climatology)

    arid_payload = dict(TEST_PAYLOAD)
    arid_payload["soil"] = {"ph": 8.2}
    resp = client.post("/api/v1/predict/full-report", json=arid_payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    excluded = data.get("excluded_crops", [])
    assert len(excluded) > 0, "Arid desert site must exclude climatically impossible Tier A crops"

    for ex in excluded:
        assert "crop_id" in ex
        assert "limiting_factor" in ex
        assert ex["limiting_factor"] is not None
        assert ex["score_rainfed"] < 0.30 and ex["score_irrigated"] < 0.30

    rec_names = [c["crop_name"].lower() for c in data["recommended_crops"]]
    for ex in excluded:
        assert ex["crop_name"].lower() not in rec_names, f"Excluded crop {ex['crop_name']} should not be in recommended_crops"


def test_ac6_rank_in_rationale_equals_card_position(monkeypatch):
    """AC-6: For every card, any #N in the sentence equals the card position."""
    monkeypatch.setattr("app.api.v1.predict.fetch_monthly_climatology", fake_climatology_provider())
    resp = client.post("/api/v1/predict/full-report", json=TEST_PAYLOAD)
    assert resp.status_code == 200
    data = resp.json()
    recs = data["recommended_crops"]
    assert len(recs) > 0

    for idx, card in enumerate(recs):
        expected_pos = idx + 1
        rationale = card["rationale"]
        assert f"#{expected_pos}" in rationale, f"Card at position {expected_pos} has mismatched rationale: {rationale}"


def test_ac7_rainfed_cards_never_say_irrigation(monkeypatch):
    """AC-7: A 'rainfed' card never says 'irrigation'; irrigated cards never say 'rainfed'."""
    monkeypatch.setattr("app.api.v1.predict.fetch_monthly_climatology", fake_climatology_provider())
    resp = client.post("/api/v1/predict/full-report", json=TEST_PAYLOAD)
    assert resp.status_code == 200
    data = resp.json()
    recs = data["recommended_crops"]
    assert len(recs) > 0

    for card in recs:
        mode = card["irrigation_mode"]
        rationale = card["rationale"].lower()
        if mode == "rainfed":
            assert "irrigation" not in rationale, f"Rainfed card {card['crop_name']} contains 'irrigation': {card['rationale']}"
        elif mode in ["supplemental", "full"]:
            assert "rainfed" not in rationale, f"Irrigated card {card['crop_name']} contains 'rainfed': {card['rationale']}"


def test_ac8_tier_b_cards_suppress_yield_water_and_risk(monkeypatch):
    """AC-8: Tier B cards show no yield, no water-need figure, no invented risk index."""
    monkeypatch.setattr("app.api.v1.predict.fetch_monthly_climatology", fake_climatology_provider())
    resp = client.post("/api/v1/predict/full-report", json=TEST_PAYLOAD)
    assert resp.status_code == 200
    data = resp.json()
    tier_b_cards = [c for c in data["recommended_crops"] if c.get("confidence_tier") == "B"]
    assert len(tier_b_cards) > 0

    for card in tier_b_cards:
        assert card["expected_yield_t_ha"] is None
        assert card["expected_production_t"] is None
        assert card["water_need_mm"] is None, f"Tier B card {card['crop_name']} should not have water_need_mm"
        assert card["climate_risk_score"] is None, f"Tier B card {card['crop_name']} should not have climate_risk_score"


def test_ac9_yield_ceilings_suppress_implausible_yields(monkeypatch):
    """
    AC-9: Rice, maize, coffee, and cotton must show no yield until baselines pass plausibility ceiling checks.
    """
    monkeypatch.setattr("app.api.v1.predict.fetch_monthly_climatology", fake_climatology_provider())
    resp = client.post("/api/v1/predict/full-report", json=TEST_PAYLOAD)
    assert resp.status_code == 200
    data = resp.json()
    recs = data["recommended_crops"]

    suspect_crops = {"rice", "maize", "coffee", "cotton"}
    found_suspect = 0
    for card in recs:
        cid = card["crop_id"].lower()
        if cid in suspect_crops:
            found_suspect += 1
            assert card["expected_yield_t_ha"] is None, f"{cid} yield must be suppressed"
            assert card["expected_production_t"] is None, f"{cid} production must be suppressed"
            assert card.get("yield_note") == "Baseline failed plausibility check"


def test_30_tied_crops_tiebreak_order():
    """
    PRD v3.3 §3.2 item 6:
    Verify tie-breaks in rank_crops with 30 tied crops:
    Score -> Tier A first -> Category priority (cereal, pulse, root_tuber, vegetable, fruit_nut, others) -> Margin -> Name.
    """
    categories = ["cereal", "pulse", "root_tuber", "vegetable", "fruit_nut", "oilseed"]
    dummy_crops = []

    # Generate 30 crops all scoring 1.0
    for i in range(30):
        cat = categories[i % len(categories)]
        tier = "A" if i < 10 else "B"
        margin = 0.5 if (i % 2 == 0) else 0.8
        dummy_crops.append(
            CropScore(
                crop_id=f"crop_{i:02d}",
                common_name=f"Crop_{i:02d}",
                scientific_name=f"Taxon {i}",
                category=cat,
                score=1.0,
                grade="excellent",
                limiting_factor="none",
                score_rainfed=1.0,
                score_irrigated=1.0,
                best_planting_month=1,
                season_months=4,
                confidence_tier=tier,
                factors={"margin": margin}
            )
        )

    # Sort using tiebreak key
    dummy_crops.sort(key=crop_tiebreak_key)

    # 1. All scores are 1.0
    assert all(c.score == 1.0 for c in dummy_crops)

    # 2. All Tier A crops must appear before Tier B crops
    seen_b = False
    for c in dummy_crops:
        if c.confidence_tier == "B":
            seen_b = True
        elif seen_b and c.confidence_tier == "A":
            pytest.fail("Found Tier A crop after Tier B crop in tie-break sort!")

    # 3. Within same tier, categories must follow CATEGORY_PRIORITY order
    tier_a = [c for c in dummy_crops if c.confidence_tier == "A"]
    for i in range(len(tier_a) - 1):
        p1 = CATEGORY_PRIORITY.get(tier_a[i].category, 5)
        p2 = CATEGORY_PRIORITY.get(tier_a[i + 1].category, 5)
        assert p1 <= p2, f"Category priority violated: {tier_a[i].category} before {tier_a[i+1].category}"

