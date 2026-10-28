"""Global crop registry + envelope suitability. Offline, no network."""
import math
import pytest

from app.services.crops.envelope_suitability import (
    Site, load_registry, rank_crops, score_crop, season_length_months, trapezoid,
)

# Rounded textbook monthly climates, used only as test inputs (not product data).
KISUMU = Site([23, 23.5, 23.2, 22.5, 22.2, 21.8, 21.3, 21.5, 22.3, 22.8, 22.5, 22.7],
              [60, 80, 150, 230, 170, 70, 60, 90, 90, 100, 150, 100], ph=5.8, altitude_m=1150)
CUSCO = Site([13, 12.8, 12.8, 12.3, 11, 10, 9.5, 10.8, 12.3, 13.4, 13.6, 13.3],
             [155, 140, 110, 40, 10, 3, 5, 10, 30, 60, 70, 115], ph=6.2, altitude_m=3400)
IOWA = Site([-6, -4, 3, 10, 16, 22, 24, 23, 18, 11, 3, -4],
            [25, 30, 60, 95, 115, 120, 110, 105, 80, 65, 50, 35], ph=6.5, altitude_m=300)
RIYADH = Site([15, 17, 21, 27, 33, 36, 37, 37, 34, 29, 22, 17],
              [12, 8, 15, 25, 5, 0, 0, 0, 0, 1, 10, 10], ph=8.0, altitude_m=600)


@pytest.fixture(scope="module")
def reg():
    return load_registry()


def find(reg, sci):
    return next(c for c in reg if c["scientific_name"] == sci)


def test_registry_is_global_sized(reg):
    assert len(reg) >= 2000
    assert sum(c["recommendable"] for c in reg) >= 1500


def test_registry_rows_are_valid(reg):
    ids = set()
    for c in reg:
        assert c["crop_id"] not in ids
        ids.add(c["crop_id"])
        assert c["confidence_tier"] in {"A", "B"}
        for key in ("temp_c", "rainfall_mm", "ph"):
            e = c[key]
            assert e["min"] <= e["opt_min"] <= e["opt_max"] <= e["max"], (c["crop_id"], key)
            assert all(isinstance(v, (int, float)) and not math.isnan(v) for v in e.values())
        assert "FAO EcoCrop" in c["data_sources"]


def test_trapezoid_shape():
    assert trapezoid(5, 10, 20, 30, 40) == 0
    assert trapezoid(15, 10, 20, 30, 40) == pytest.approx(0.5)
    assert trapezoid(25, 10, 20, 30, 40) == 1
    assert trapezoid(35, 10, 20, 30, 40) == pytest.approx(0.5)
    assert trapezoid(45, 10, 20, 30, 40) == 0


def test_robust_agronomic_cases(reg):
    assert score_crop(find(reg, "Manihot esculenta"), KISUMU).score >= 0.8       # cassava, humid tropics
    assert score_crop(find(reg, "Chenopodium quinoa"), CUSCO).score >= 0.6       # quinoa, Andes
    assert score_crop(find(reg, "Zea mays"), IOWA).score >= 0.8                  # maize, US Corn Belt
    assert score_crop(find(reg, "Oryza sativa"), RIYADH).score < 0.3             # rainfed rice in desert


def test_irrigation_never_scores_lower(reg):
    for sci in ("Triticum aestivum", "Oryza sativa", "Coffea arabica", "Zea mays"):
        r = score_crop(find(reg, sci), RIYADH)
        assert r.score_irrigated >= r.score_rainfed


def test_different_climates_give_different_rankings():
    tops = [tuple(c.crop_id for c in rank_crops(s, top_n=8)) for s in (KISUMU, CUSCO, IOWA)]
    assert len(set(tops)) == 3


def test_desert_returns_few_crops_not_a_padded_list():
    assert len(rank_crops(RIYADH, top_n=50)) < 10


def test_scores_are_bounded_and_deterministic():
    a = rank_crops(KISUMU, top_n=20)
    b = rank_crops(KISUMU, top_n=20)
    assert [x.crop_id for x in a] == [x.crop_id for x in b]
    assert all(0.0 <= x.score <= 1.0 for x in a)


def test_bad_site_input_is_rejected():
    with pytest.raises(ValueError):
        score_crop(find(load_registry(), "Zea mays"), Site([1] * 11, [1] * 12))
    with pytest.raises(ValueError):
        score_crop(find(load_registry(), "Zea mays"), Site([float("nan")] + [1] * 11, [1] * 12))


def test_season_length_rule():
    assert season_length_months({"growth_cycle_days": [100, 100], "life_span": "annual"}) == 4
    assert season_length_months({"growth_cycle_days": [90, 250], "life_span": "annual"}) == 4
    assert season_length_months({"growth_cycle_days": [200, 300], "life_span": "perennial"}) == 12
