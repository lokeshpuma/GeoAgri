"""
Test That Rules are Live in YAML (PRD v2.1 M8, M15).
Verifies that changing thresholds in rules YAML alters classification and irrigability verdicts
without modifying any application code.
"""
import copy
import pytest

from app.services.landclass.classifier import LandClassifier
from app.services.irrigability.engine import IrrigabilityEngine
from app.schemas.predict import LandClassification


def test_rules_are_live_classifier(tmp_path):
    """Changing urban threshold in YAML flips verdict from AGRICULTURAL to URBAN_BUILT."""
    base_rules = {
        "confidence_scoring": {
            "single_sensor_rs": 0.70,
            "multi_sensor_consistent": 0.85,
            "verified_official_record": 0.98,
            "user_provided_document": 0.90,
            "conflicting_signals": 0.50
        },
        "thresholds": {
            "urban": {"min_share_for_dominant": 0.30},
            "water": {"min_share_for_dominant": 0.35},
            "forest_cover": {"min_share_for_dominant": 0.50},
            "wasteland": {"min_share_for_dominant": 0.45, "barren_rocky_slope_min_deg": 25.0},
            "cropland": {"min_share_for_dominant": 0.30}
        },
        "detection": {
            "min_independent_sources": 1
        }
    }

    evidence_sample = {
        "detection": {
            "buildings": {"share": 0.25, "basis": ["worldcover:50=0.25", "osm:building"]},
            "sources": [{"name": "esa_worldcover_2021", "state": "checked"}]
        },
        "independent_sources": {"buildings": ["worldcover", "osm"]},
        "features": {}
    }

    # Under 30% threshold, 25% built is not urban dominant
    classifier_default = LandClassifier()
    classifier_default.rules = copy.deepcopy(base_rules)
    res_default = classifier_default.classify(evidence=evidence_sample)
    assert res_default.dominant == "AGRICULTURAL"

    # Now change YAML threshold to 20%
    modified_rules = copy.deepcopy(base_rules)
    modified_rules["thresholds"]["urban"]["min_share_for_dominant"] = 0.20
    classifier_modified = LandClassifier()
    classifier_modified.rules = modified_rules
    res_modified = classifier_modified.classify(evidence=evidence_sample)
    
    # Verdict flipped to URBAN_BUILT purely from YAML rule change!
    assert res_modified.dominant == "URBAN_BUILT"


def test_rules_are_live_irrigability():
    """Changing slope thresholds in irrigability rules flips verdict between IRRIGABLE, CONDITIONAL, and NOT_IRRIGABLE."""
    base_rules = {
        "hard_limits": {"slope_deg_max": 20.0},
        "soft_limits": {
            "slope_deg_drip_only": 8.0,
            "sand_pct_max": 82.0,
            "clay_pct_max": 65.0,
            "distance_to_water_m_max": 4000.0
        }
    }

    land_class = LandClassification(
        dominant="AGRICULTURAL",
        class_shares={"AGRICULTURAL": 1.0},
        confidence=0.85
    )
    features = {
        "slope": 12.0,
        "texture_clay_pct": 25.0,
        "texture_sand_pct": 45.0,
        "distance_to_water_m": 500.0
    }

    # Under default rules: slope 12 > 8.0 -> CONDITIONALLY_IRRIGABLE
    engine = IrrigabilityEngine()
    engine.rules = copy.deepcopy(base_rules)
    res1 = engine.evaluate(land_class=land_class, features=features)
    assert res1.verdict == "CONDITIONALLY_IRRIGABLE"

    # Raise soft limit to 15.0 -> becomes IRRIGABLE
    rules_relaxed = copy.deepcopy(base_rules)
    rules_relaxed["soft_limits"]["slope_deg_drip_only"] = 15.0
    engine.rules = rules_relaxed
    res2 = engine.evaluate(land_class=land_class, features=features)
    assert res2.verdict == "IRRIGABLE"

    # Lower hard limit to 10.0 -> becomes NOT_IRRIGABLE
    rules_strict = copy.deepcopy(base_rules)
    rules_strict["hard_limits"]["slope_deg_max"] = 10.0
    engine.rules = rules_strict
    res3 = engine.evaluate(land_class=land_class, features=features)
    assert res3.verdict == "NOT_IRRIGABLE"
