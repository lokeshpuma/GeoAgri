"""
Deprecated compatibility module for donor area_check.py.
Re-exports functionality from app.services.landclass.detection.
Scheduled for removal in v2.2.
"""
from __future__ import annotations

import math
import os
import warnings
from typing import Any, Dict, List, Optional, Tuple

import requests
from app.core.config import get_settings
from app.services.landclass import detection
from app.services.landclass.detection import (
    WORLDCOVER_CLASSES,
    WORLDCOVER_TILE_URL,
    DEM_TILE_URL,
    GDAL_ENV,
    ROAD_CLASSES,
    RAIL_CLASSES,
    FARM_ACCESS_WAYS,
    TILE_AREA_REASONS,
    OSM_AREA_REASONS,
    _cache,
    _cache_lock,
    _tile_url_cache,
    worldcover_tile_url,
    dem_tile_url,
    land_cover_composition,
    evaluate_composition,
    slope_and_elevation,
    terrain_at,
    terrain_reasons,
    vector_tile_check,
    overpass_query,
    osm_reasons,
    overpass_check,
    osm_check,
    _tile_url_template,
    detect_features,
    to_legacy_area_check,
)

AREA_ACRES = float(os.getenv("AREA_CHECK_ACRES", "0.7"))
AREA_RADIUS_M = round(math.sqrt(AREA_ACRES * 4046.8564224 / math.pi), 1)
AREA_LABEL = f"{AREA_ACRES:g}-acre area"
from pathlib import Path
import yaml

def _load_yaml_rules() -> Dict[str, Any]:
    rules_path = Path(__file__).resolve().parents[2] / "rules" / "land_class_rules.yaml"
    if rules_path.exists():
        try:
            with open(rules_path, "r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
        except Exception:
            pass
    return {}

_rules = _load_yaml_rules()
_forest_share = float(_rules.get("thresholds", {}).get("forest_cover", {}).get("min_share_for_dominant", 0.5))
MAJORITY_FRACTION = 0.5

TILE_ZOOM = 14
TILE_TIMEOUT_S = 10
OVERPASS_URLS = [
    u.strip()
    for u in os.getenv("OVERPASS_URL", "https://overpass-api.de/api/interpreter").split(",")
    if u.strip()
]
OVERPASS_TIMEOUT_S = int(os.getenv("OVERPASS_TIMEOUT_S", "10"))
OPENFREEMAP_TILEJSON = os.getenv("OPENFREEMAP_TILEJSON", "https://tiles.openfreemap.org/planet")

ANY_PIXEL_BLOCKERS = {
    50: f"Road or building within the {AREA_LABEL}",
    70: "Snow / ice",
}
MAJORITY_BLOCKERS = {
    10: ("Forest", _forest_share),
    60: ("Bare land / desert or rock", MAJORITY_FRACTION),
    80: ("Water body", MAJORITY_FRACTION),
    90: ("Wetland", MAJORITY_FRACTION),
    95: ("Mangroves", MAJORITY_FRACTION),
    100: ("Tundra (moss and lichen)", MAJORITY_FRACTION),
}


def check_area(lat: float, lon: float) -> Dict[str, Any]:
    """
    Deprecated donor entrypoint.
    Runs detect_features and maps to the legacy area_check dictionary.
    """
    warnings.warn(
        "app.services.geo.area_check is deprecated, use app.services.landclass.detection instead",
        DeprecationWarning,
        stacklevel=2
    )
    # Check if direct composition / terrain are needed
    det = detect_features(lat, lon)
    
    # Run legacy composition extraction if possible for full legacy response
    tif = worldcover_tile_url(lat, lon)
    try:
        wc_fracs = land_cover_composition(tif, lat, lon, AREA_RADIUS_M)
    except Exception:
        wc_fracs = None

    try:
        terr = terrain_at(lat, lon, AREA_RADIUS_M)
    except Exception:
        terr = None

    legacy = to_legacy_area_check(det, lat=lat, lon=lon, wc_fractions=wc_fracs, terrain_dict=terr)
    return legacy
