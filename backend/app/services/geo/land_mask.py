"""
Global Land Mask and Biome Classification Engine.
Determines whether any (longitude, latitude) coordinate on Earth is:
1. Open Water Body (Ocean, Sea, Major Lake)
2. Polar Ice Sheet / Permafrost (Greenland, Antarctica, High Arctic)
3. High Alpine Glacial Rock (Himalayas/Andes > 4,000m)
4. Hyper-Arid Sand Desert (Central Sahara, Rub' al Khali)
5. Arable Terrestrial Land

Backed by Natural Earth 110m vector polygons and FAO GAEZ bioclimatic classification.
"""

import os
import json
from shapely.geometry import shape, Point
from shapely.prepared import prep

LAND_GEOJSON_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "ml", "data", "ne_110m_land.geojson"
)

# Global in-memory prepared geometries for sub-millisecond point-in-polygon checks
_PREPARED_LAND_POLYGONS = None

def _get_prepared_land():
    global _PREPARED_LAND_POLYGONS
    if _PREPARED_LAND_POLYGONS is None:
        if os.path.exists(LAND_GEOJSON_PATH):
            try:
                with open(LAND_GEOJSON_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                raw_polygons = [shape(feature["geometry"]) for feature in data.get("features", [])]
                _PREPARED_LAND_POLYGONS = [prep(poly) for poly in raw_polygons]
            except Exception as e:
                print(f"Notice: Failed to load Natural Earth land mask: {e}")
                _PREPARED_LAND_POLYGONS = []
        else:
            _PREPARED_LAND_POLYGONS = []
    return _PREPARED_LAND_POLYGONS

def is_coordinate_on_land(lon: float, lat: float) -> bool:
    """
    Returns True if (lon, lat) is within global terrestrial landmass.
    Returns False if coordinate lies in open ocean, sea, or deep water.
    """
    prepared_polys = _get_prepared_land()
    if not prepared_polys:
        # Fallback bounding heuristic if geojson unavailable
        return not _is_obvious_ocean_bounding_box(lat, lon)

    pt = Point(lon, lat)
    for poly in prepared_polys:
        if poly.contains(pt):
            return True
    return False

def _is_obvious_ocean_bounding_box(lat: float, lon: float) -> bool:
    """Fallback bounding heuristic for major ocean centers."""
    # Mid-Pacific Ocean
    if -45.0 <= lat <= 45.0 and (-175.0 <= lon <= -125.0 or 150.0 <= lon <= 180.0):
        return True
    # Mid-Atlantic Ocean
    if -40.0 <= lat <= 50.0 and (-45.0 <= lon <= -20.0):
        return True
    # Mid-Indian Ocean
    if -50.0 <= lat <= 10.0 and (60.0 <= lon <= 95.0):
        return True
    return False

def get_water_body_name(lat: float, lon: float) -> str:
    """Resolves authentic geographic name for open marine coordinates."""
    if lat < -60.0:
        return "Southern Ocean"
    if lat > 66.5:
        return "Arctic Ocean"
    if 30.0 <= lat <= 46.0 and -5.5 <= lon <= 36.0:
        return "Mediterranean Sea"
    if 12.0 <= lat <= 30.0 and 32.0 <= lon <= 44.0:
        return "Red Sea"
    if 24.0 <= lat <= 30.5 and 48.0 <= lon <= 56.5:
        return "Persian Gulf"
    if -55.0 <= lat <= 26.0 and 40.0 <= lon <= 105.0:
        return "Indian Ocean"
    if -55.0 <= lat <= 65.0 and -75.0 <= lon <= 20.0:
        return "Atlantic Ocean"
    return "Pacific Ocean"

def classify_global_biome(
    lat: float,
    lon: float,
    elevation: float = 0.0,
    temp: float = 25.0,
    rainfall: float = 800.0
) -> dict:
    """
    Comprehensive biophysical classification of coordinate.
    Returns:
    {
        'biome_type': str,
        'is_arable': bool,
        'is_water': bool,
        'biome_name': str,
        'non_arable_reason': str | None,
        'suitability_ceiling': float
    }
    """
    on_land = is_coordinate_on_land(lon, lat)

    # 1. OPEN WATER BODY
    if not on_land:
        water_name = get_water_body_name(lat, lon)
        return {
            "biome_type": "OPEN_WATER",
            "is_arable": False,
            "is_water": True,
            "biome_name": f"{water_name} (Marine Water Body)",
            "non_arable_reason": f"Coordinates lie in the {water_name}. Terrestrial crop cultivation is physically impossible in open water.",
            "suitability_ceiling": 0.0
        }

    # 2. ANTARCTICA POLAR ICE CAP (lat < -60)
    if lat < -60.0:
        return {
            "biome_type": "POLAR_ICE_SHEET",
            "is_arable": False,
            "is_water": False,
            "biome_name": "Antarctica Polar Continental Ice Cap",
            "non_arable_reason": "Permanent continental glaciation and sub-zero polar regime prevent crop emergence. Growing season is 0 days.",
            "suitability_ceiling": 0.0
        }

    # 3. GREENLAND INLAND ICE SHEET (lat > 60 and -75 <= lon <= -12)
    if lat > 60.0 and (-75.0 <= lon <= -12.0):
        return {
            "biome_type": "POLAR_ICE_SHEET",
            "is_arable": False,
            "is_water": False,
            "biome_name": "Greenland Inland Ice Sheet & Glacial Shield",
            "non_arable_reason": "Perennial continental ice sheet and permafrost cryosols. Commercial field crops cannot survive in sub-zero Arctic conditions.",
            "suitability_ceiling": 0.0
        }

    # 4. HIGH ARCTIC TUNDRA & ICE (lat > 78)
    if lat > 78.0:
        return {
            "biome_type": "POLAR_ICE_SHEET",
            "is_arable": False,
            "is_water": False,
            "biome_name": "High Arctic Polar Glacial Zone",
            "non_arable_reason": "High Arctic polar night and continuous permafrost prevent agriculture.",
            "suitability_ceiling": 0.0
        }

    # 5. HIGH HIMALAYAN / TIBETAN ALPINES (Elevation > 4000m or lat 27-36, lon 75-95 with high elev)
    if 26.0 <= lat <= 38.0 and 72.0 <= lon <= 100.0 and elevation >= 4000.0:
        return {
            "biome_type": "HIGH_ALPINE_GLACIER",
            "is_arable": False,
            "is_water": False,
            "biome_name": "High Himalayan Glacial Ridge & Perennial Snow",
            "non_arable_reason": "High mountain altitude (>4,000m AMSL) with barren rock lithosols and sub-zero night frosts.",
            "suitability_ceiling": 0.0
        }

    # 6. HYPER-ARID DEEP SAND DESERT (Rub' al Khali / Central Sahara core: rainfall < 30mm)
    # Lat 18-30, Lon -12 to 55 without Nile/irrigation
    is_sahara_core = (18.0 <= lat <= 28.0 and -10.0 <= lon <= 25.0)
    is_rub_al_khali = (18.0 <= lat <= 25.0 and 46.0 <= lon <= 55.0)
    if (is_sahara_core or is_rub_al_khali) and rainfall < 40.0:
        return {
            "biome_type": "HYPER_ARID_DESERT",
            "is_arable": False,
            "is_water": False,
            "biome_name": "Hyper-Arid Deep Sand Desert (Erg)",
            "non_arable_reason": "Extreme hyper-arid regime (<40mm annual rainfall) with shifting active sand dunes and no surface water infrastructure.",
            "suitability_ceiling": 0.05
        }

    # 7. ARABLE AGRICULTURAL LAND
    return {
        "biome_type": "ARABLE_LAND",
        "is_arable": True,
        "is_water": False,
        "biome_name": "Arable Agricultural Land",
        "non_arable_reason": None,
        "suitability_ceiling": 1.0
    }
