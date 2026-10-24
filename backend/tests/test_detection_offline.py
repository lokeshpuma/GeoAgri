"""
Offline Detection Test Matrix (§5A.6, M16, M22).
All offline: no network calls. Uses local stubs and synthetic GeoTIFFs.
"""
import copy
import math
import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin
from shapely.geometry import Point, Polygon

from app.services.landclass import detection
from app.services.geo import area_check

PIX = 10 / 111320.0
ORIGIN_LON, ORIGIN_LAT = 31.60, 30.80


def make_worldcover(tmp_path, grid, lon=ORIGIN_LON, lat=ORIGIN_LAT):
    path = tmp_path / f"wc_{lon}_{lat}.tif"
    grid = np.asarray(grid, dtype="uint8")
    with rasterio.open(
        path, "w", driver="GTiff", height=grid.shape[0], width=grid.shape[1], count=1,
        dtype="uint8", crs="EPSG:4326",
        transform=from_origin(lon, lat, PIX, PIX), nodata=0
    ) as dst:
        dst.write(grid, 1)
    return str(path)


def centre(row, col, lon=ORIGIN_LON, lat=ORIGIN_LAT):
    return lat - (row + 0.5) * PIX, lon + (col + 0.5) * PIX


# -----------------------------------------------------------------------------
# Donor Unit Tests (Ported & Preserved)
# -----------------------------------------------------------------------------
def test_area_is_about_30m_circle():
    assert area_check.AREA_ACRES == 0.7
    assert area_check.AREA_RADIUS_M == pytest.approx(30.0, abs=0.1)


def test_cropland_area_has_no_blockers(tmp_path):
    lat, lon = centre(4, 4)
    fr = detection.land_cover_composition(make_worldcover(tmp_path, np.full((9, 9), 40)), lat, lon)
    assert fr == {40: 1.0}
    assert detection.evaluate_composition(fr) == []


def test_one_building_pixel_inside_area_blocks(tmp_path):
    grid = np.full((9, 9), 40)
    grid[4, 6] = 50  # ~17 m from the point
    lat, lon = centre(4, 4)
    fr = detection.land_cover_composition(make_worldcover(tmp_path, grid), lat, lon)
    assert any("Road or building" in r for r in detection.evaluate_composition(fr))


def test_building_outside_area_is_ignored(tmp_path):
    grid = np.full((15, 15), 40)
    grid[7, 14] = 50  # ~60 m away
    lat, lon = centre(7, 7)
    fr = detection.land_cover_composition(make_worldcover(tmp_path, grid), lat, lon)
    assert detection.evaluate_composition(fr) == []


@pytest.mark.parametrize("fractions,reason", [
    ({10: 0.8, 40: 0.2}, "Forest"),
    ({70: 0.05, 40: 0.95}, "Snow / ice"),
    ({80: 0.7, 40: 0.3}, "Water body"),
    ({60: 1.0}, "Bare land / desert or rock"),
    ({90: 0.6, 40: 0.4}, "Wetland"),
])
def test_non_farmland_reasons(fractions, reason):
    assert reason in detection.evaluate_composition(fractions)


def test_scattered_trees_are_fine():
    assert detection.evaluate_composition({40: 0.7, 10: 0.3}) == []


def test_terrain_rules():
    flat = detection.slope_and_elevation(np.zeros((7, 7)), 30, 30, 30)
    assert detection.terrain_reasons(flat) == []
    ramp = detection.slope_and_elevation(np.tile(np.arange(7) * 15.0, (7, 1)), 30, 30, 30)
    assert ramp["mean_slope_deg"] == pytest.approx(26.6, abs=0.2)
    assert any("steep" in r for r in detection.terrain_reasons(ramp))
    high = {"mean_slope_deg": 2.0, "max_elevation_m": 4500.0, "mean_elevation_m": 4490.0}
    assert any("High mountain" in r for r in detection.terrain_reasons(high))


def test_osm_reasons_skip_farm_tracks():
    assert detection.osm_reasons([{"tags": {"highway": "track"}}, {"tags": {"highway": "footway"}}]) == []
    els = [
        {"tags": {"highway": "primary"}},
        {"tags": {"building": "house"}},
        {"tags": {"landuse": "forest"}},
        {"tags": {"boundary": "national_park"}},
    ]
    reasons = [r for r, _ in detection.osm_reasons(els)]
    assert "Road within the area" in reasons
    assert "Building within the area" in reasons
    assert "Forest" in reasons
    assert "National park (protected)" in reasons


def test_tile_names():
    assert detection.worldcover_tile_url(30.59, 31.50).endswith("_N30E030_Map.tif")
    assert detection.worldcover_tile_url(-33.9, 18.4).endswith("_S36E018_Map.tif")
    assert "N07_00_E080_00" in detection.dem_tile_url(7.2, 80.36)


def test_unreachable_sources_never_block(monkeypatch):
    detection._cache.clear()

    def down(*a, **k):
        raise OSError("network down")

    monkeypatch.setattr(detection, "land_cover_composition", down)
    monkeypatch.setattr(detection, "terrain_at", down)
    monkeypatch.setattr(detection, "osm_check", lambda *a, **k: {"warning": "OpenStreetMap unavailable"})

    res = detection.detect_features(30.75, 75.50)
    assert res["forest"]["state"] == "unknown"
    assert res["buildings"]["state"] == "unknown"
    assert len(res["warnings"]) >= 2


# -----------------------------------------------------------------------------
# Vector Tile & Overpass Offline Tests
# -----------------------------------------------------------------------------
def _fake_tile_server(monkeypatch, layers_for_tile):
    import mapbox_vector_tile

    class Resp:
        def __init__(self, content):
            self.content, self.status_code = content, 200 if content else 204
        def raise_for_status(self):
            pass

    def fake_get(url, timeout=None, headers=None):
        z, x, y = (int(v) for v in url.rsplit(".", 1)[0].split("/")[-3:])
        layers = layers_for_tile.get((x, y))
        return Resp(mapbox_vector_tile.encode(layers, default_options={"y_coord_down": True}) if layers else b"")

    monkeypatch.setattr(detection, "_tile_url_template", lambda: "https://tiles.test/{z}/{x}/{y}.pbf")
    monkeypatch.setattr(detection.requests, "get", fake_get)


def _tile_and_offset(lat, lon):
    n = 2 ** 14
    gx = (lon + 180.0) / 360.0 * n * 4096
    gy = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n * 4096
    tile_m = 40075016.686 * math.cos(math.radians(lat)) / n
    return int(gx // 4096), int(gy // 4096), gx % 4096, gy % 4096, 4096 / tile_m


@pytest.mark.parametrize("road_offset_m,expect_road", [(10, True), (25, True), (45, False), (80, False)])
def test_road_distance_in_tiles(monkeypatch, road_offset_m, expect_road):
    lat, lon = 30.7522, 75.4989
    tx, ty, px, py, units_per_m = _tile_and_offset(lat, lon)
    x_road = px + road_offset_m * units_per_m
    road = {
        "name": "transportation",
        "features": [{
            "geometry": f"LINESTRING ({x_road} {py - 300}, {x_road} {py + 300})",
            "properties": {"class": "primary"}
        }]
    }
    _fake_tile_server(monkeypatch, {(tx, ty): [road]})
    res = detection.vector_tile_check(lat, lon)
    assert ("Road within the area" in res["reasons"]) is expect_road


def test_farm_track_and_forest_polygon_in_tiles(monkeypatch):
    lat, lon = 30.7522, 75.4989
    tx, ty, px, py, _ = _tile_and_offset(lat, lon)
    track = {
        "name": "transportation",
        "features": [{
            "geometry": f"LINESTRING ({px} {py - 200}, {px} {py + 200})",
            "properties": {"class": "track"}
        }]
    }
    wood = {
        "name": "landcover",
        "features": [{
            "geometry": f"POLYGON (({px-100} {py-100}, {px+100} {py-100}, {px+100} {py+100}, {px-100} {py+100}, {px-100} {py-100}))",
            "properties": {"class": "wood"}
        }]
    }
    _fake_tile_server(monkeypatch, {(tx, ty): [track, wood]})
    res = detection.vector_tile_check(lat, lon)
    assert "Forest" in res["reasons"]
    assert "Road within the area" not in res["reasons"]


def test_tiles_down_falls_back_to_overpass(monkeypatch):
    def boom(*a, **k):
        raise TimeoutError("tiles down")
    monkeypatch.setattr(detection, "vector_tile_check", boom)
    monkeypatch.setattr(
        detection,
        "overpass_check",
        lambda lat, lon, **kw: {"reasons": [], "features": [], "source": "OpenStreetMap (Overpass)"}
    )
    assert detection.osm_check(30.75, 75.50)["source"] == "OpenStreetMap (Overpass)"


# -----------------------------------------------------------------------------
# PRD §5A.6 Detection Test Matrix
# -----------------------------------------------------------------------------
def test_matrix_1_100_percent_cropland(monkeypatch):
    """Case 1: 100% WorldCover 40 -> forest/buildings not_detected."""
    detection._cache.clear()
    monkeypatch.setattr(detection, "land_cover_composition", lambda *a, **k: {40: 1.0})
    monkeypatch.setattr(detection, "terrain_at", lambda *a, **k: {"mean_slope_deg": 2.0, "max_elevation_m": 500.0, "mean_elevation_m": 490.0})
    monkeypatch.setattr(detection, "osm_check", lambda *a, **k: {"reasons": [], "features": [], "building_count": 0, "roads": []})

    res = detection.detect_features(13.32, 75.75)
    assert res["forest"]["state"] == "not_detected"
    assert res["buildings"]["state"] == "not_detected"
    assert res["roads"]["state"] == "not_detected"
    assert res["water"]["state"] == "not_detected"


def test_matrix_2_farmhouse_in_polygon(monkeypatch):
    """Case 2: 1 built pixel (farmhouse) in a 1 ha polygon -> buildings.state=detected, share < 0.05, footprint deducted."""
    detection._cache.clear()
    # 2% built-up, 98% cropland
    monkeypatch.setattr(detection, "land_cover_composition", lambda *a, **k: {40: 0.98, 50: 0.02})
    monkeypatch.setattr(detection, "terrain_at", lambda *a, **k: {"mean_slope_deg": 2.0, "max_elevation_m": 500.0, "mean_elevation_m": 490.0})
    monkeypatch.setattr(detection, "osm_check", lambda *a, **k: {"reasons": [], "features": ["building"], "building_count": 1, "roads": []})

    poly = Polygon([(75.75, 13.32), (75.751, 13.32), (75.751, 13.321), (75.75, 13.321), (75.75, 13.32)])
    res = detection.detect_features(13.32, 75.75, polygon=poly)
    assert res["buildings"]["state"] == "detected"
    assert res["buildings"]["share"] < 0.05
    assert res["buildings"]["footprint_ha"] is not None
    assert res["buildings"]["footprint_ha"] > 0


def test_matrix_3_urban_dominant_built(monkeypatch):
    """Case 3: 40% built -> buildings.share >= 0.30 -> urban dominant."""
    detection._cache.clear()
    monkeypatch.setattr(detection, "land_cover_composition", lambda *a, **k: {50: 0.40, 40: 0.60})
    monkeypatch.setattr(detection, "terrain_at", lambda *a, **k: {"mean_slope_deg": 2.0, "max_elevation_m": 500.0, "mean_elevation_m": 490.0})
    monkeypatch.setattr(detection, "osm_check", lambda *a, **k: {"reasons": ["Building within the area"], "features": ["building"], "building_count": 15, "roads": []})

    res = detection.detect_features(12.97, 77.59)
    assert res["buildings"]["state"] == "detected"
    assert res["buildings"]["share"] >= 0.30


def test_matrix_4_dense_tree_cover_forest_cover(monkeypatch):
    """Case 4: 70% tree, no plantation signature, no legal layer -> FOREST_COVER."""
    detection._cache.clear()
    monkeypatch.setattr(detection, "land_cover_composition", lambda *a, **k: {10: 0.70, 40: 0.30})
    monkeypatch.setattr(detection, "terrain_at", lambda *a, **k: {"mean_slope_deg": 8.0, "max_elevation_m": 800.0, "mean_elevation_m": 780.0})
    monkeypatch.setattr(detection, "osm_check", lambda *a, **k: {"reasons": ["Forest"], "features": ["landcover=wood"], "building_count": 0, "roads": []})

    res = detection.detect_features(13.32, 75.75)
    assert res["forest"]["state"] == "detected"
    assert res["forest"]["kind"] == "cover"
    assert res["forest"]["plantation_signature"] is False
    assert res["forest"]["legal_status"] == "unverified"


def test_matrix_5_plantation_guard(monkeypatch):
    """Case 5: 70% tree + RTC says plantation/areca -> NOT forest (plantation guard)."""
    detection._cache.clear()
    monkeypatch.setattr(detection, "land_cover_composition", lambda *a, **k: {10: 0.70, 40: 0.30})
    monkeypatch.setattr(detection, "terrain_at", lambda *a, **k: {"mean_slope_deg": 8.0, "max_elevation_m": 800.0, "mean_elevation_m": 780.0})
    monkeypatch.setattr(detection, "osm_check", lambda *a, **k: {"reasons": ["Forest"], "features": ["landcover=wood"], "building_count": 0, "roads": []})

    rtc_sample = {"land_type": "Bagayat", "subclass": "arecanut", "is_plantation": True}
    res = detection.detect_features(13.32, 75.75, rtc_data=rtc_sample)
    assert res["forest"]["plantation_signature"] is True
    assert res["forest"]["kind"] == "plantation"


def test_matrix_6_osm_wood_single_source(monkeypatch):
    """Case 6: Tree cover only from OSM landcover=wood (single source) -> unverified."""
    detection._cache.clear()
    monkeypatch.setattr(detection, "land_cover_composition", lambda *a, **k: {40: 1.0})  # WorldCover says crop
    monkeypatch.setattr(detection, "terrain_at", lambda *a, **k: {"mean_slope_deg": 2.0, "max_elevation_m": 500.0, "mean_elevation_m": 490.0})
    monkeypatch.setattr(detection, "osm_check", lambda *a, **k: {"reasons": ["Forest"], "features": ["landcover=wood"], "building_count": 0, "roads": []})

    res = detection.detect_features(13.32, 75.75)
    assert res["forest"]["legal_status"] == "unverified"
    assert res["forest"]["state"] == "not_detected"  # WorldCover tree share is 0


def test_matrix_7_inside_wdpa_official_layer(monkeypatch):
    """Case 7: Polygon inside WDPA polygon -> forest.kind=legal, legal_status=verified."""
    detection._cache.clear()
    monkeypatch.setattr(detection, "land_cover_composition", lambda *a, **k: {10: 0.90, 40: 0.10})
    monkeypatch.setattr(detection, "terrain_at", lambda *a, **k: {"mean_slope_deg": 12.0, "max_elevation_m": 1200.0, "mean_elevation_m": 1180.0})
    monkeypatch.setattr(detection, "osm_check", lambda *a, **k: {"reasons": ["Forest"], "features": ["boundary=national_park"], "building_count": 0, "roads": []})

    res = detection.detect_features(12.5, 76.0, official_legal_forest=True)
    assert res["forest"]["state"] == "detected"
    assert res["forest"]["kind"] == "legal"
    assert res["forest"]["legal_status"] == "verified"


def test_matrix_8_osm_national_park_only(monkeypatch):
    """Case 8: OSM park=national_park only -> forest.legal_status='unverified', not legal."""
    detection._cache.clear()
    monkeypatch.setattr(detection, "land_cover_composition", lambda *a, **k: {40: 1.0})
    monkeypatch.setattr(detection, "terrain_at", lambda *a, **k: {"mean_slope_deg": 2.0, "max_elevation_m": 500.0, "mean_elevation_m": 490.0})
    monkeypatch.setattr(detection, "osm_check", lambda *a, **k: {
        "reasons": ["National park (protected)"],
        "features": ["boundary=national_park"],
        "parks": ["national_park"],
        "building_count": 0,
        "roads": []
    })

    res = detection.detect_features(13.32, 75.75, official_legal_forest=False)
    assert res["forest"]["legal_status"] == "unverified"
    assert res["forest"]["kind"] != "legal"


def test_matrix_9_only_dem_answers(monkeypatch):
    """Case 9: Only DEM answers -> UNVERIFIED (D5), not 'clear'."""
    detection._cache.clear()
    monkeypatch.setattr(detection, "land_cover_composition", lambda *a, **k: None)
    monkeypatch.setattr(detection, "terrain_at", lambda *a, **k: {"mean_slope_deg": 3.0, "max_elevation_m": 600.0, "mean_elevation_m": 590.0})
    monkeypatch.setattr(detection, "osm_check", lambda *a, **k: {"warning": "OSM down"})

    res = detection.detect_features(13.32, 75.75)
    assert res["terrain"]["state"] == "checked"
    assert res["forest"]["state"] == "unknown"
    assert res["buildings"]["state"] == "unknown"
    assert res["water"]["state"] == "unknown"
    assert len(res["warnings"]) >= 1


def test_matrix_10_worldcover_404_open_water(monkeypatch):
    """Case 10: WorldCover 404 tile -> open water (sea), as donor."""
    detection._cache.clear()

    def not_found(*a, **k):
        raise rasterio.errors.RasterioIOError("HTTP 404: Not Found")

    monkeypatch.setattr(detection, "land_cover_composition", not_found)
    monkeypatch.setattr(detection, "terrain_at", lambda *a, **k: None)
    monkeypatch.setattr(detection, "osm_check", lambda *a, **k: {"reasons": [], "features": [], "building_count": 0, "roads": []})

    res = detection.detect_features(0.0, 60.0)  # Open ocean
    assert res["water"]["state"] == "detected"
    assert res["water"]["share"] == 1.0


def test_matrix_11_farm_track_footpath_ignored(monkeypatch):
    """Case 11: Farm track / footpath near plot is ignored."""
    detection._cache.clear()
    monkeypatch.setattr(detection, "land_cover_composition", lambda *a, **k: {40: 1.0})
    monkeypatch.setattr(detection, "terrain_at", lambda *a, **k: {"mean_slope_deg": 2.0, "max_elevation_m": 500.0, "mean_elevation_m": 490.0})
    # Track is in FARM_ACCESS_WAYS so osm_check returns no road
    monkeypatch.setattr(detection, "osm_check", lambda *a, **k: {"reasons": [], "features": ["highway=track"], "building_count": 0, "roads": []})

    res = detection.detect_features(13.32, 75.75)
    assert res["roads"]["state"] == "not_detected"


def test_matrix_12_tiles_and_overpass_both_down(monkeypatch):
    """Case 12: Tiles down -> Overpass fallback; both down: warnings, partial, no crash."""
    detection._cache.clear()
    monkeypatch.setattr(detection, "land_cover_composition", lambda *a, **k: {40: 1.0})
    monkeypatch.setattr(detection, "terrain_at", lambda *a, **k: {"mean_slope_deg": 2.0, "max_elevation_m": 500.0, "mean_elevation_m": 490.0})
    monkeypatch.setattr(detection, "osm_check", lambda *a, **k: {"warning": "Both vector tiles and Overpass API down"})

    res = detection.detect_features(13.32, 75.75)
    assert res["roads"]["state"] == "unknown"
    assert any("Both vector tiles" in w for w in res["warnings"])


def test_matrix_14_cached_result_mutated_by_caller(monkeypatch):
    """Case 14: Cached result mutated by caller -> cache unaffected (deep copy)."""
    detection._cache.clear()
    monkeypatch.setattr(detection, "land_cover_composition", lambda *a, **k: {40: 1.0})
    monkeypatch.setattr(detection, "terrain_at", lambda *a, **k: {"mean_slope_deg": 2.0, "max_elevation_m": 500.0, "mean_elevation_m": 490.0})
    monkeypatch.setattr(detection, "osm_check", lambda *a, **k: {"reasons": [], "features": [], "building_count": 0, "roads": []})

    res1 = detection.detect_features(13.32, 75.75)
    # Mutate res1 directly
    res1["forest"]["state"] = "MUTATED_TEST"
    res1["buildings"]["share"] = 999.0

    res2 = detection.detect_features(13.32, 75.75)
    assert res2["forest"]["state"] == "not_detected"
    assert res2["buildings"]["share"] == 0.0


def test_matrix_15_point_only_circle_no_area(monkeypatch):
    """Case 15: Point-only -> circle AREA_CHECK_ACRES; area_ha=null."""
    detection._cache.clear()
    monkeypatch.setattr(detection, "land_cover_composition", lambda *a, **k: {40: 1.0})
    monkeypatch.setattr(detection, "terrain_at", lambda *a, **k: {"mean_slope_deg": 2.0, "max_elevation_m": 500.0, "mean_elevation_m": 490.0})
    monkeypatch.setattr(detection, "osm_check", lambda *a, **k: {"reasons": [], "features": [], "building_count": 0, "roads": []})

    res = detection.detect_features(13.32, 75.75, polygon=None)
    assert res["geometry_basis"] == "point_circle"
    assert res["buildings"]["footprint_ha"] is None


def test_matrix_16_mosaic_polygon(tmp_path):
    """Case 16: Polygon sampling correctly across a GeoTIFF."""
    grid = np.full((20, 20), 40, dtype="uint8")
    grid[0:10, 0:10] = 10  # 100 pixels of forest
    grid[10:20, 10:20] = 50  # 100 pixels of built
    tif = make_worldcover(tmp_path, grid)

    # Polygon covering upper-left forest section only
    lat_top, lon_left = centre(1, 1)
    lat_bot, lon_right = centre(8, 8)
    poly = Polygon([(lon_left, lat_bot), (lon_right, lat_bot), (lon_right, lat_top), (lon_left, lat_top), (lon_left, lat_bot)])

    fr = detection.land_cover_composition(tif, lat_top, lon_left, polygon=poly)
    assert fr is not None
    assert fr.get(10, 0.0) > 0.8  # dominated by forest in that quadrant
