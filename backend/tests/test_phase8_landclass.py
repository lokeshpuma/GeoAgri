"""
Unit tests for Land Classification Engine (PRD v2.0 §5, §14.1).
Validates multi-sensor detection across water, urban, forest, plantation, wasteland, and cropland.
"""
import pytest
from app.services.landclass.classifier import get_land_classifier


def test_classify_water_body():
    classifier = get_land_classifier()
    # High NDWI and HydroLAKES layer hit
    features = {"ndwi": 0.45, "ndvi": -0.15, "slope": 0.5, "elevation": 600.0}
    layer_hits = [{"name": "hydrolakes_polygons"}]
    res = classifier.classify(features, layer_hits=layer_hits)
    assert res.dominant == "WATER_BODY"
    assert res.class_shares["WATER_BODY"] >= 0.80


def test_classify_dense_urban():
    classifier = get_land_classifier()
    features = {"ndwi": -0.20, "ndvi": 0.12, "slope": 1.5, "elevation": 920.0}
    layer_hits = [{"name": "ghsl_built_up"}]
    res = classifier.classify(features, layer_hits=layer_hits)
    assert res.dominant == "URBAN_BUILT"
    assert res.class_shares["URBAN_BUILT"] >= 0.70


def test_classify_protected_legal_forest():
    classifier = get_land_classifier()
    features = {"ndwi": -0.10, "ndvi": 0.75, "slope": 12.0, "elevation": 850.0}
    layer_hits = [{"name": "protected_area_kml"}]
    res = classifier.classify(features, layer_hits=layer_hits)
    assert res.dominant == "FOREST_LEGAL"
    assert res.legal_forest_status == "protected_forest"
    assert res.confidence >= 0.95


def test_classify_dense_tree_cover_without_legal_layer():
    classifier = get_land_classifier()
    features = {"ndwi": -0.10, "ndvi": 0.78, "slope": 15.0, "elevation": 400.0, "vh": -11.0, "latitude": 22.0, "longitude": 80.0}
    res = classifier.classify(features, layer_hits=[])
    assert res.dominant == "FOREST_COVER"
    assert res.legal_forest_status == "unknown"


def test_plantation_not_misclassified_as_forest():
    """Western Ghats coffee/areca plantation must NOT be misclassified as legal forest."""
    classifier = get_land_classifier()
    features = {
        "ndwi": -0.05,
        "ndvi": 0.76,
        "slope": 10.0,
        "elevation": 1050.0,
        "vh": -12.5,
        "latitude": 13.32,  # Chikkamagaluru
        "longitude": 75.75
    }
    res = classifier.classify(features, layer_hits=[])
    assert res.dominant == "AGRICULTURAL"
    assert res.subclass == "agroforestry_plantation"


def test_classify_barren_rocky_wasteland():
    classifier = get_land_classifier()
    features = {"ndwi": -0.30, "ndvi": 0.12, "slope": 26.0, "elevation": 1100.0}
    res = classifier.classify(features, layer_hits=[])
    assert res.dominant == "WASTELAND"
    assert res.subclass == "barren_rocky"


def test_classify_standard_agricultural_cropland():
    classifier = get_land_classifier()
    features = {"ndwi": 0.05, "ndvi": 0.52, "slope": 2.5, "elevation": 650.0}
    res = classifier.classify(features, layer_hits=[])
    assert res.dominant == "AGRICULTURAL"
    assert res.class_shares["AGRICULTURAL"] >= 0.80
