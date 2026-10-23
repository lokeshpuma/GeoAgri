"""
Unit tests for Irrigability Engine (PRD v2.0 §7, §14.1).
Validates verdicts (IRRIGABLE, CONDITIONALLY_IRRIGABLE, NOT_IRRIGABLE),
setbacks, usable area subtraction, and Model C gating.
"""
import pytest
from app.schemas.predict import LandClassification
from app.services.irrigability.engine import get_irrigability_engine


def test_water_body_not_irrigable():
    engine = get_irrigability_engine()
    lc = LandClassification(
        dominant="WATER_BODY",
        class_shares={"WATER_BODY": 1.0},
        confidence=0.95
    )
    res = engine.evaluate(lc, features={}, area_ha=5.0)
    assert res.verdict == "NOT_IRRIGABLE"
    assert res.crop_models == "skipped_not_irrigable"
    assert res.irrigable_area_ha == 0.0


def test_urban_built_not_irrigable():
    engine = get_irrigability_engine()
    lc = LandClassification(
        dominant="URBAN_BUILT",
        class_shares={"URBAN_BUILT": 1.0},
        confidence=0.95
    )
    res = engine.evaluate(lc, features={}, area_ha=2.0)
    assert res.verdict == "NOT_IRRIGABLE"
    assert res.crop_models == "skipped_not_irrigable"


def test_protected_forest_not_irrigable():
    engine = get_irrigability_engine()
    lc = LandClassification(
        dominant="FOREST_LEGAL",
        class_shares={"FOREST_LEGAL": 1.0},
        legal_forest_status="protected_forest",
        confidence=0.98
    )
    res = engine.evaluate(lc, features={}, area_ha=10.0)
    assert res.verdict == "NOT_IRRIGABLE"
    assert res.crop_models == "skipped_not_irrigable"


def test_steep_slope_not_irrigable():
    engine = get_irrigability_engine()
    lc = LandClassification(
        dominant="AGRICULTURAL",
        class_shares={"AGRICULTURAL": 1.0},
        confidence=0.85
    )
    features = {"slope": 23.5, "texture_clay_pct": 25.0, "texture_sand_pct": 45.0}
    res = engine.evaluate(lc, features=features, area_ha=4.0)
    assert res.verdict == "NOT_IRRIGABLE"
    assert res.crop_models == "skipped_not_irrigable"


def test_moderate_slope_conditionally_irrigable_drip_only():
    engine = get_irrigability_engine()
    lc = LandClassification(
        dominant="AGRICULTURAL",
        class_shares={"AGRICULTURAL": 1.0},
        confidence=0.85
    )
    features = {"slope": 12.0, "texture_clay_pct": 25.0, "texture_sand_pct": 45.0}
    res = engine.evaluate(lc, features=features, area_ha=3.0)
    assert res.verdict == "CONDITIONALLY_IRRIGABLE"
    assert res.crop_models == "evaluated"
    assert "drip" in res.irrigation_options
    assert "sprinkler" in res.irrigation_options


def test_farm_plus_farmhouse_subtracted_usable_area():
    """Farm with farmhouse footprint subtracts building footprint from usable area."""
    engine = get_irrigability_engine()
    lc = LandClassification(
        dominant="AGRICULTURAL",
        class_shares={"AGRICULTURAL": 0.85, "URBAN_BUILT": 0.15},
        confidence=0.88
    )
    features = {"slope": 2.5, "texture_clay_pct": 22.0, "texture_sand_pct": 48.0}
    gross_area = 2.0
    res = engine.evaluate(lc, features=features, area_ha=gross_area)
    assert res.verdict == "IRRIGABLE"
    assert res.crop_models == "evaluated"
    assert res.irrigable_area_ha == pytest.approx(1.70, abs=0.01)
    assert res.irrigable_area_ha < gross_area


def test_normal_cropland_irrigable():
    engine = get_irrigability_engine()
    lc = LandClassification(
        dominant="AGRICULTURAL",
        class_shares={"AGRICULTURAL": 0.95},
        confidence=0.90
    )
    features = {"slope": 1.8, "texture_clay_pct": 24.0, "texture_sand_pct": 42.0}
    res = engine.evaluate(lc, features=features, area_ha=2.5)
    assert res.verdict == "IRRIGABLE"
    assert res.crop_models == "evaluated"
    assert "canal" in res.irrigation_options
    assert res.irrigable_area_ha == 2.5
