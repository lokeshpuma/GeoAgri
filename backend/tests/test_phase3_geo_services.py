"""
Unit tests for Phase 3: Geospatial & Data Collection Services (Area, GEE, NASA POWER, SoilGrids, Profile).
"""

import pytest
from app.services.geo.area import compute_polygon_area_ha
from app.services.geo.gee_client import fetch_satellite_features
from app.services.weather.nasa_power import fetch_weather_data
from app.services.soil.soilgrids import fetch_soil_data
from app.services.features.profile import build_environmental_profile

def test_polygon_area_calculation():
    # Karnataka field sample polygon (~2.35 ha)
    polygon = [
        (77.5850, 12.9650),
        (77.5870, 12.9650),
        (77.5870, 12.9670),
        (77.5850, 12.9670),
        (77.5850, 12.9650)
    ]
    res = compute_polygon_area_ha(polygon)
    assert res["polygon_valid"] is True
    assert 2.0 <= res["area_ha"] <= 5.0
    assert res["centroid_lon"] == pytest.approx(77.5860, abs=0.001)

def test_point_only_returns_no_area():
    point = (77.5867, 12.9650)
    res = compute_polygon_area_ha(None, point_pt=point)
    assert res["polygon_valid"] is False
    assert res["area_ha"] is None
    assert res["centroid_lon"] == pytest.approx(77.5867)

def test_satellite_feature_extraction():
    centroid = (77.5867, 12.9650)
    sat = fetch_satellite_features(None, centroid)
    assert "elevation" in sat
    assert "ndvi" in sat
    assert "ndwi" in sat
    assert "vv" in sat
    assert len(sat) == 34

@pytest.mark.asyncio
async def test_weather_data_fetching():
    centroid = (77.5867, 12.9650)
    weather = await fetch_weather_data(centroid, season="kharif")
    assert "rainfall_mm" in weather
    assert weather["rainfall_mm"] > 0
    assert "temp_max_c" in weather

@pytest.mark.asyncio
async def test_soil_data_and_manual_blending():
    centroid = (77.5867, 12.9650)
    soil_remote = await fetch_soil_data(centroid)
    assert "ph" in soil_remote
    assert soil_remote["ph"] > 0

    manual = {"ph": 7.5, "organic_carbon": 15.0}
    soil_blended = await fetch_soil_data(centroid, manual_soil=manual)
    # Blended pH should shift closer to 7.5
    assert soil_blended["ph"] > soil_remote["ph"]

@pytest.mark.asyncio
async def test_unified_profile_builder():
    polygon = [
        (77.5850, 12.9650),
        (77.5870, 12.9650),
        (77.5870, 12.9670),
        (77.5850, 12.9670),
        (77.5850, 12.9650)
    ]
    manual_soil = {"ph": 6.8, "organic_carbon": 12.0}
    profile = await build_environmental_profile(polygon, None, season="kharif", manual_soil=manual_soil)
    assert "field_summary" in profile
    assert "satellite" in profile
    assert "weather" in profile
    assert "soil" in profile


def test_evi_formula_numerical_precision():
    """Validates M3 EVI formula: 2.5 * (NIR - RED) / (NIR + 6*RED - 7.5*BLUE + 1.0)."""
    from app.services.geo.gee_client import compute_evi
    nir = 0.45
    red = 0.08
    blue = 0.04
    expected = 2.5 * (nir - red) / (nir + 6.0 * red - 7.5 * blue + 1.0)
    computed = compute_evi(nir, red, blue)
    assert abs(computed - expected) < 1e-4
    assert -1.0 <= computed <= 1.0
