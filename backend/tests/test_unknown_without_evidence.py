"""
Test UNKNOWN / UNVERIFIED Paths Without Evidence (PRD v2.1 M15, M29).
Validates that:
- Insufficient or empty evidence yields land class UNKNOWN and irrigability UNVERIFIED.
- Single-source remote-sensing signals require consensus (>= 2 independent sources) or yield single_source_only UNVERIFIED (M29).
- Missing water access is never assumed as a canal or well.
"""
import pytest

from app.services.landclass.classifier import LandClassifier
from app.services.irrigability.engine import IrrigabilityEngine
from app.schemas.predict import LandClassification


def test_empty_evidence_yields_unknown_and_unverified():
    """All-missing input must yield dominant UNKNOWN and irrigability UNVERIFIED."""
    classifier = LandClassifier()
    res_class = classifier.classify(features={}, evidence=None, record=None)
    assert res_class.dominant == "UNKNOWN"
    assert res_class.subclass == "insufficient_evidence"
    assert res_class.confidence == 0.0

    engine = IrrigabilityEngine()
    res_irrig = engine.evaluate(land_class=res_class, features={})
    assert res_irrig.verdict == "UNVERIFIED"
    assert res_irrig.crop_models == "skipped_not_irrigable"
    assert res_irrig.irrigable_area_ha is None


def test_single_source_remote_sensing_requires_consensus():
    """Single-source remote-sensing hit without secondary agreement yields single_source_only."""
    classifier = LandClassifier()

    # Only single OSM source reports wood/forest, no WorldCover or Sentinel consensus
    evidence_single_source = {
        "detection": {
            "forest": {"state": "detected", "kind": "cover", "share": 0.60, "basis": ["osm:landcover=wood"]},
            "sources": [{"name": "openstreetmap", "state": "checked"}]
        },
        "independent_sources": {"forest": ["osm"]},
        "features": {}
    }

    res = classifier.classify(evidence=evidence_single_source)
    assert res.dominant == "UNKNOWN"
    assert res.subclass == "single_source_only"

    # Irrigability engine evaluates single_source_only as UNVERIFIED
    engine = IrrigabilityEngine()
    irrig_res = engine.evaluate(land_class=res, features={})
    assert irrig_res.verdict == "UNVERIFIED"


def test_multi_source_consensus_promotes_class():
    """Two independent sources agreeing promote class to detected."""
    classifier = LandClassifier()

    evidence_multi_source = {
        "detection": {
            "forest": {
                "state": "detected",
                "kind": "cover",
                "share": 0.65,
                "basis": ["worldcover:10=0.65", "osm:landcover=wood"]
            },
            "sources": [
                {"name": "esa_worldcover_2021", "state": "checked"},
                {"name": "openstreetmap", "state": "checked"}
            ]
        },
        "independent_sources": {"forest": ["worldcover", "osm"]},
        "features": {}
    }

    res = classifier.classify(evidence=evidence_multi_source)
    assert res.dominant == "FOREST_COVER"
    assert res.confidence >= 0.70


def test_missing_water_access_never_assumes_canal():
    """Water access distance exceeded reports soft limit, and unknown water access is reported."""
    land_class = LandClassification(
        dominant="AGRICULTURAL",
        class_shares={"AGRICULTURAL": 1.0},
        confidence=0.85
    )
    features_far_water = {
        "slope": 2.0,
        "texture_clay_pct": 25.0,
        "texture_sand_pct": 45.0,
        "distance_to_water_m": 5000.0  # > 4000m limit
    }

    engine = IrrigabilityEngine()
    res = engine.evaluate(land_class=land_class, features=features_far_water, record=None)

    assert res.verdict == "CONDITIONALLY_IRRIGABLE"
    assert any("distance_to_water_exceeded" in r["rule_id"] for r in res.reasons)

    # Missing water distance reports unknown note
    res_no_water = engine.evaluate(land_class=land_class, features={"slope": 2.0, "texture_clay_pct": 25.0, "texture_sand_pct": 45.0}, record=None)
    assert any("water_access" in r["rule_id"] for r in res_no_water.reasons)

