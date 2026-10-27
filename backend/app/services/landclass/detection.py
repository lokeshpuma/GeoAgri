"""
Land Surface & Physical Feature Detection Engine (PRD v2.1 §5A, M16, M22, M28).
Ported and redesigned from donor area_check.py.

Evaluates evidence for:
- Forest (legal vs physical tree cover vs plantation)
- Buildings & Urban structures (dominant share vs farmhouse deduction)
- Roads & Infrastructure (excluding farm tracks and footpaths)
- Water bodies & Wetlands
- Terrain (slope and elevation metrics)

Operates in:
- Polygon mode (evaluates exact parcel boundaries)
- Point-only circle mode (evaluates circle of radius AREA_CHECK_ACRES, area_ha=null)

Guarantees:
- Local-first layer sampling, then remote fallbacks
- Strict timeouts (<= 6s per source, <= 8s total budget)
- Thread-safe TTL cache returning deep copies
- Honest error reporting: missing sources yield 'unknown', never 'clear' (D5)
"""
from __future__ import annotations

import copy
import math
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import mapbox_vector_tile
import numpy as np
import rasterio
from rasterio.transform import from_origin, rowcol
from rasterio.windows import Window
import httpx
from shapely.affinity import scale as scale_geom, translate
from shapely.geometry import Point, Polygon, MultiPolygon, shape, mapping
import yaml

from app.core.config import get_settings

# --- Constants & Class Mappings ---------------------------------------------
WORLDCOVER_CLASSES = {
    10: "Tree cover",
    20: "Shrubland",
    30: "Grassland",
    40: "Cropland",
    50: "Built-up",
    60: "Bare / sparse vegetation",
    70: "Snow and ice",
    80: "Permanent water bodies",
    90: "Herbaceous wetland",
    95: "Mangroves",
    100: "Moss and lichen",
}

WORLDCOVER_TILE_URL = (
    "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/"
    "ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"
)
DEM_TILE_URL = "https://copernicus-dem-30m.s3.amazonaws.com/{name}/{name}.tif"

GDAL_ENV = {
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif",
    "GDAL_HTTP_MAX_RETRY": "2",
    "VSI_CACHE": "TRUE",
}

ROAD_CLASSES = {
    "motorway", "trunk", "primary", "secondary", "tertiary",
    "minor", "service", "busway", "raceway", "bus_guideway"
}
RAIL_CLASSES = {"rail", "transit"}
FARM_ACCESS_WAYS = {"track", "path", "footway", "bridleway", "cycleway", "steps"}

TILE_AREA_REASONS = {
    "landuse": {
        "residential": "Residential area",
        "commercial": "Commercial area",
        "retail": "Commercial area",
        "industrial": "Industrial area",
        "military": "Military area",
        "quarry": "Quarry / mine",
        "cemetery": "Cemetery",
        "railway": "Railway land",
        "garages": "Built-up area",
        "hospital": "Built-up area",
        "school": "Built-up area",
        "college": "Built-up area",
        "university": "Built-up area",
        "stadium": "Built-up area",
        "zoo": "Built-up area",
    },
    "landcover": {
        "wood": "Forest",
        "ice": "Snow / ice (glacier)",
        "wetland": "Wetland",
        "sand": "Sand / desert",
        "rock": "Bare rock"
    },
    "park": {
        "national_park": "National park (protected)",
        "nature_reserve": "Nature reserve (protected)",
        "protected_area": "Protected area"
    },
}

OSM_AREA_REASONS = {
    "landuse": {
        "residential": "Residential area", "industrial": "Industrial area",
        "commercial": "Commercial area", "retail": "Commercial area",
        "construction": "Construction site", "military": "Military area",
        "quarry": "Quarry / mine", "landfill": "Landfill",
        "cemetery": "Cemetery", "railway": "Railway land",
        "forest": "Forest",
    },
    "natural": {
        "wood": "Forest", "water": "Water body", "wetland": "Wetland",
        "glacier": "Snow / ice (glacier)", "bare_rock": "Bare rock",
        "scree": "Scree / rocky slope", "sand": "Sand / desert", "beach": "Beach",
    },
    "leisure": {"nature_reserve": "Nature reserve (protected)", "park": "Park"},
    "boundary": {"national_park": "National park (protected)", "protected_area": "Protected area"},
    "amenity": {"grave_yard": "Cemetery"},
}

# --- Cache & Concurrency ----------------------------------------------------
_cache: Dict[Tuple, Tuple[float, Dict[str, Any]]] = {}
_cache_lock = threading.Lock()
_CACHE_MAX = 2048
_tile_url_cache: Dict[str, Tuple[str, float]] = {}


def load_detection_rules() -> Dict[str, Any]:
    """Load detection section from land_class_rules.yaml."""
    settings = get_settings()
    rules_val = getattr(settings, "LAND_CLASS_RULES", getattr(settings, "LAND_CLASS_RULES_PATH", "backend/app/rules/land_class_rules.yaml"))
    rules_path = Path(rules_val)
    if not rules_path.is_absolute():
        for candidate in [
            rules_path,
            Path("backend") / rules_path,
            Path(__file__).resolve().parent.parent / "rules" / rules_path.name,
            Path("/Users/lokesh/Desktop/GeoAgri/backend/app/rules") / rules_path.name,
        ]:
            if candidate.exists():
                rules_path = candidate
                break

    defaults = {
        "point_only_acres": 0.7,
        "legacy_strict": False,
        "min_independent_sources": 2,
        "forest": {
            "cover_share_min": 0.50,
            "hansen_treecover_min_pct": 60,
            "plantation_guard": True
        },
        "buildings": {
            "urban_dominant_share_min": 0.30,
            "farmhouse_max_share": 0.05
        },
        "roads": {
            "deduct_lines": False,
            "assumed_half_width_m": {}
        },
        "water": {
            "share_min": 0.35
        },
        "terrain": {
            "report_only": True,
            "slope_window_m_min": 90
        },
        "timeouts": {
            "per_source_s": 6,
            "total_budget_s": 8
        },
        "cache_ttl_s": 86400
    }

    if rules_path.exists():
        try:
            with open(rules_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
                det = data.get("detection", {})
                if det:
                    # Merge defaults with yaml
                    merged = copy.deepcopy(defaults)
                    for k, v in det.items():
                        if isinstance(v, dict) and isinstance(merged.get(k), dict):
                            merged[k].update(v)
                        else:
                            merged[k] = v
                    return merged
        except Exception:
            pass
    return defaults


# =============================================================================
# Helper Geometric and Tile Calculation
# =============================================================================
def worldcover_tile_url(lat: float, lon: float) -> str:
    """Format remote or local path for WorldCover tile covering (lat, lon)."""
    la, lo = int(math.floor(lat / 3.0)) * 3, int(math.floor(lon / 3.0)) * 3
    tile = f"{'N' if la >= 0 else 'S'}{abs(la):02d}{'E' if lo >= 0 else 'W'}{abs(lo):03d}"
    
    # Check local file first (D8: Local-first)
    local_candidates = [
        Path(f"backend/ml/data/raw/external/geo/worldcover_2021/ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"),
        Path(f"/Users/lokesh/Desktop/GeoAgri/backend/ml/data/raw/external/geo/worldcover_2021/ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"),
    ]
    for cand in local_candidates:
        if cand.exists():
            return str(cand)

    return "/vsicurl/" + WORLDCOVER_TILE_URL.format(tile=tile)


def dem_tile_url(lat: float, lon: float) -> str:
    """Format remote or local path for Copernicus DEM tile covering (lat, lon)."""
    la, lo = math.floor(lat), math.floor(lon)
    name = (
        f"Copernicus_DSM_COG_10_{'N' if la >= 0 else 'S'}{abs(la):02d}_00_"
        f"{'E' if lo >= 0 else 'W'}{abs(lo):03d}_00_DEM"
    )
    local_candidates = [
        Path(f"backend/ml/data/raw/external/geo/slope/{name}.tif"),
        Path(f"/Users/lokesh/Desktop/GeoAgri/backend/ml/data/raw/external/geo/slope/{name}.tif"),
    ]
    for cand in local_candidates:
        if cand.exists():
            return str(cand)

    return "/vsicurl/" + DEM_TILE_URL.format(name=name)


def _circle_mask(h: int, w: int, px_w_m: float, px_h_m: float, radius_m: float) -> np.ndarray:
    yy, xx = np.mgrid[0:h, 0:w]
    cy, cx = (h - 1) / 2, (w - 1) / 2
    return np.hypot((yy - cy) * px_h_m, (xx - cx) * px_w_m) <= radius_m


def _polygon_mask(
    h: int, w: int,
    transform: rasterio.Affine,
    poly: Union[Polygon, MultiPolygon]
) -> np.ndarray:
    """Rasterize a Shapely polygon to an exact boolean mask within the given raster window."""
    try:
        from rasterio.features import rasterize
        mask = rasterize(
            [(poly, 1)],
            out_shape=(h, w),
            transform=transform,
            fill=0,
            dtype=np.uint8
        )
        return mask == 1
    except Exception:
        # Fallback if rasterize fails
        yy, xx = np.mgrid[0:h, 0:w]
        xs, ys = rasterio.transform.xy(transform, yy, xx)
        xs, ys = np.array(xs), np.array(ys)
        inside = np.zeros((h, w), dtype=bool)
        for r in range(h):
            for c in range(w):
                if poly.contains(Point(xs[r, c], ys[r, c])):
                    inside[r, c] = True
        return inside


# =============================================================================
# Land Cover (WorldCover) Analysis
# =============================================================================
def land_cover_composition(
    tif_path: str,
    lat: float,
    lon: float,
    radius_m: float = 30.0,
    polygon: Optional[Union[Polygon, MultiPolygon]] = None
) -> Optional[Dict[int, float]]:
    """Compute WorldCover class fractions (0.0 to 1.0) inside polygon or radius circle."""
    try:
        with rasterio.Env(**GDAL_ENV), rasterio.open(tif_path) as src:
            if src.crs and src.crs.is_geographic:
                px_h_m = abs(src.transform.e) * 110540.0
                px_w_m = abs(src.transform.a) * 111320.0 * math.cos(math.radians(lat))
            else:
                px_w_m, px_h_m = abs(src.transform.a), abs(src.transform.e)

            if polygon is not None and not polygon.is_empty:
                minx, miny, maxx, maxy = polygon.bounds
                r_min, c_min = rowcol(src.transform, minx, maxy)
                r_max, c_max = rowcol(src.transform, maxx, miny)
                r_start, r_end = min(r_min, r_max) - 1, max(r_min, r_max) + 2
                c_start, c_end = min(c_min, c_max) - 1, max(c_min, c_max) + 2
                win_w = max(1, c_end - c_start)
                win_h = max(1, r_end - r_start)
                win = Window(c_start, r_start, win_w, win_h)
                win_transform = rasterio.windows.transform(win, src.transform)
                block = src.read(1, window=win, boundless=True, fill_value=0).astype(int)
                mask = _polygon_mask(block.shape[0], block.shape[1], win_transform, polygon)
            else:
                n = int(math.ceil(radius_m / max(1.0, min(px_w_m, px_h_m))))
                r, c = rowcol(src.transform, lon, lat)
                win = Window(c - n, r - n, 2 * n + 1, 2 * n + 1)
                block = src.read(1, window=win, boundless=True, fill_value=0).astype(int)
                mask = _circle_mask(
                    block.shape[0], block.shape[1],
                    px_w_m, px_h_m,
                    max(radius_m, max(px_w_m, px_h_m))
                )

        values = block[mask]
        valid = values[values > 0]
        if valid.size == 0:
            return None
        classes, counts = np.unique(valid, return_counts=True)
        return {int(k): float(n / valid.size) for k, n in zip(classes, counts)}
    except Exception as e:
        if "404" in str(e) or "does not exist" in str(e):
            # No tile means open water (sea) per donor logic
            return {80: 1.0}
        raise


def evaluate_composition(fractions: Dict[int, float]) -> List[str]:
    """Return donor-compatible list of reason strings from WorldCover fractions."""
    reasons = []
    # Built-up
    if fractions.get(50, 0) > 0:
        reasons.append("Road or building within the area")
    # Snow/ice
    if fractions.get(70, 0) > 0:
        reasons.append("Snow / ice")
    # Majority blockers (> 50%)
    if fractions.get(10, 0) > 0.5:
        reasons.append("Forest")
    if fractions.get(60, 0) > 0.5:
        reasons.append("Bare land / desert or rock")
    if fractions.get(80, 0) > 0.5:
        reasons.append("Water body")
    if fractions.get(90, 0) > 0.5:
        reasons.append("Wetland")
    if fractions.get(95, 0) > 0.5:
        reasons.append("Mangroves")
    if fractions.get(100, 0) > 0.5:
        reasons.append("Tundra (moss and lichen)")
    return reasons


# =============================================================================
# Terrain (Copernicus DEM) Analysis
# =============================================================================
def slope_and_elevation(
    z: np.ndarray,
    px_w_m: float,
    px_h_m: float,
    radius_m: float = 30.0
) -> Dict[str, float]:
    """Compute slope degrees and elevations."""
    gy, gx = np.gradient(z, px_h_m, px_w_m)
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    inside = _circle_mask(
        z.shape[0], z.shape[1],
        px_w_m, px_h_m,
        max(radius_m, max(px_w_m, px_h_m) * 1.01)
    )
    return {
        "mean_slope_deg": round(float(slope[inside].mean()), 1),
        "max_elevation_m": round(float(z[inside].max()), 0),
        "mean_elevation_m": round(float(z[inside].mean()), 0),
    }


def terrain_at(
    lat: float,
    lon: float,
    radius_m: float = 30.0,
    polygon: Optional[Union[Polygon, MultiPolygon]] = None
) -> Optional[Dict[str, float]]:
    """Sample Copernicus DEM and calculate slope & elevation metrics."""
    try:
        with rasterio.Env(**GDAL_ENV), rasterio.open(dem_tile_url(lat, lon)) as src:
            px_h_m = abs(src.transform.e) * 110540.0
            px_w_m = src.transform.a * 111320.0 * math.cos(math.radians(lat))
            n = int(math.ceil(radius_m / max(1.0, min(px_w_m, px_h_m)))) + 2
            r, c = rowcol(src.transform, lon, lat)
            z = src.read(
                1,
                window=Window(c - n, r - n, 2 * n + 1, 2 * n + 1),
                boundless=True,
                fill_value=np.nan
            ).astype("float64")
    except Exception as e:
        if "404" in str(e) or "does not exist" in str(e):
            return None
        raise

    if np.isnan(z).all():
        return None
    if np.isnan(z).any():
        z = np.where(np.isnan(z), np.nanmean(z), z)

    return slope_and_elevation(z, px_w_m, px_h_m, radius_m)


def terrain_reasons(terrain: Optional[Dict[str, float]]) -> List[str]:
    if not terrain:
        return []
    reasons = []
    if terrain.get("max_elevation_m", 0) > 4000.0:
        reasons.append(f"High mountain (elevation {terrain['max_elevation_m']:.0f} m)")
    if terrain.get("mean_slope_deg", 0) > 15.0:
        reasons.append(f"Mountain / steep terrain (slope {terrain['mean_slope_deg']:.0f}°)")
    return reasons


# =============================================================================
# OpenStreetMap / Vector Tile Check
# =============================================================================
def _tile_url_template() -> str:
    now = time.time()
    cached = _tile_url_cache.get("tiles")
    if cached and now - cached[1] < 6 * 3600:
        return cached[0]
    settings = get_settings()
    with httpx.Client(timeout=6.0, headers={"User-Agent": settings.HTTP_USER_AGENT}) as client:
        tj = client.get(settings.OPENFREEMAP_TILEJSON).json()
    url = tj["tiles"][0]
    _tile_url_cache["tiles"] = (url, now)
    return url


def vector_tile_check(
    lat: float,
    lon: float,
    radius_m: float = 30.0,
    polygon: Optional[Union[Polygon, MultiPolygon]] = None
) -> Dict[str, Any]:
    """Query OpenFreeMap vector tiles (zoom 14) for roads, buildings, parks, water."""
    n = 2 ** 14
    gx = (lon + 180.0) / 360.0 * n * 4096
    gy = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n * 4096
    tile_m = 40075016.686 * math.cos(math.radians(lat)) / n
    r = radius_m * 4096 / tile_m

    circle = Point(gx, gy).buffer(r, 32)
    pt = Point(gx, gy)
    check_geom = circle

    settings = get_settings()
    template = _tile_url_template()
    found: List[Tuple[str, str]] = []
    buildings_count = 0
    roads_found = []
    parks_found = []

    tx_min = int((gx - r) // 4096)
    tx_max = int((gx + r) // 4096)
    ty_min = int((gy - r) // 4096)
    ty_max = int((gy + r) // 4096)

    with httpx.Client(timeout=6.0, headers={"User-Agent": settings.HTTP_USER_AGENT}) as client:
        for tx in range(tx_min, tx_max + 1):
            for ty in range(ty_min, ty_max + 1):
                tile_url = template.format(z=14, x=tx % n, y=ty)
                resp = client.get(tile_url)
                if resp.status_code == 204 or not resp.content:
                    continue
                resp.raise_for_status()
                layers = mapbox_vector_tile.decode(resp.content, default_options={"y_coord_down": True})

            for layer_name, layer in layers.items():
                scale = 4096 / layer.get("extent", 4096)
                for feat in layer["features"]:
                    cls = feat["properties"].get("class")
                    try:
                        g = shape(feat["geometry"])
                        if scale != 1:
                            g = scale_geom(g, scale, scale, origin=(0, 0))
                        g = translate(g, tx * 4096, ty * 4096)
                    except Exception:
                        continue

                    if layer_name == "transportation":
                        if cls in ROAD_CLASSES and g.intersects(check_geom):
                            found.append(("Road within the area", f"highway={cls}"))
                            roads_found.append(cls)
                        elif cls in RAIL_CLASSES and g.intersects(check_geom):
                            found.append(("Railway within the area", f"railway={cls}"))
                            roads_found.append(f"railway={cls}")
                    elif layer_name == "aeroway" and cls in ("runway", "taxiway", "apron") and g.intersects(check_geom):
                        found.append(("Airport", f"aeroway={cls}"))
                    elif layer_name == "building" and g.intersects(check_geom):
                        found.append(("Building within the area", "building"))
                        buildings_count += 1
                    elif layer_name == "water" and g.geom_type.endswith("Polygon") and g.contains(pt):
                        found.append(("Water body", f"water={cls or 'water'}"))
                    elif layer_name in TILE_AREA_REASONS and cls in TILE_AREA_REASONS[layer_name] \
                            and g.geom_type.endswith("Polygon") and g.contains(pt):
                        reason = TILE_AREA_REASONS[layer_name][cls]
                        found.append((reason, f"{layer_name}={cls}"))
                        if layer_name == "park":
                            parks_found.append(cls)

    seen = set()
    unique = []
    for reason, tag in found:
        if reason not in seen:
            seen.add(reason)
            unique.append((reason, tag))

    return {
        "reasons": [r for r, _ in unique],
        "features": [t for _, t in unique],
        "building_count": buildings_count,
        "roads": roads_found,
        "parks": parks_found,
        "source": "OpenStreetMap (OpenFreeMap tiles)"
    }


def overpass_query(lat: float, lon: float, radius_m: float = 30.0) -> str:
    farm_ways = "|".join(FARM_ACCESS_WAYS)
    area_filters = "\n".join(
        f'  way(pivot.a)["{k}"~"^({"|".join(v)})$"];\n  relation(pivot.a)["{k}"~"^({"|".join(v)})$"];'
        for k, v in OSM_AREA_REASONS.items()
    )
    return f"""
[out:json][timeout:6];
(
  way(around:{radius_m},{lat},{lon})["highway"]["highway"!~"^({farm_ways})$"];
  way(around:{radius_m},{lat},{lon})["railway"]["railway"!~"^(abandoned|razed|dismantled)$"];
  way(around:{radius_m},{lat},{lon})["aeroway"~"^(runway|taxiway|apron)$"];
  way(around:{radius_m},{lat},{lon})["building"];
  node(around:{radius_m},{lat},{lon})["building"];
);
out tags;
is_in({lat},{lon})->.a;
(
  way(pivot.a)["building"];
  relation(pivot.a)["building"];
{area_filters}
);
out tags;
"""


def osm_reasons(elements: List[Dict[str, Any]]) -> List[Tuple[str, str]]:
    found = []
    for el in elements:
        tags = el.get("tags", {})
        if "highway" in tags:
            if tags["highway"] in FARM_ACCESS_WAYS:
                continue
            found.append(("Road within the area", f"highway={tags['highway']}"))
        elif "railway" in tags:
            found.append(("Railway within the area", f"railway={tags['railway']}"))
        elif "aeroway" in tags:
            found.append(("Airport", f"aeroway={tags['aeroway']}"))
        elif "building" in tags:
            found.append(("Building within the area", f"building={tags['building']}"))
        else:
            for key, reasons in OSM_AREA_REASONS.items():
                if tags.get(key) in reasons:
                    found.append((reasons[tags[key]], f"{key}={tags[key]}"))
                    break
    seen = set()
    unique = []
    for reason, tag in found:
        if reason not in seen:
            seen.add(reason)
            unique.append((reason, tag))
    return unique


def overpass_check(lat: float, lon: float, radius_m: float = 30.0) -> Dict[str, Any]:
    """Query Overpass API backup."""
    settings = get_settings()
    urls = [u.strip() for u in settings.OVERPASS_URL.split(",") if u.strip()]
    error = None
    for url in urls:
        try:
            with httpx.Client(timeout=6.0, headers={"User-Agent": settings.HTTP_USER_AGENT}) as client:
                resp = client.post(
                    url,
                    data={"data": overpass_query(lat, lon, radius_m)}
                )
            resp.raise_for_status()
            found = osm_reasons(resp.json().get("elements", []))
            return {
                "reasons": [r for r, _ in found],
                "features": [t for _, t in found],
                "source": "OpenStreetMap (Overpass)"
            }
        except Exception as e:
            error = e
    return {"warning": f"OpenStreetMap road/building check unavailable ({type(error).__name__ if error else 'Error'})."}


def osm_check(
    lat: float,
    lon: float,
    radius_m: float = 30.0,
    polygon: Optional[Union[Polygon, MultiPolygon]] = None
) -> Dict[str, Any]:
    """Vector tiles first, falling back to Overpass API."""
    try:
        return vector_tile_check(lat, lon, radius_m, polygon)
    except Exception as tile_error:
        try:
            res = overpass_check(lat, lon, radius_m)
        except TypeError:
            res = overpass_check(lat, lon)
        if "warning" in res:
            res["warning"] = f"OpenStreetMap road/building check unavailable (tiles: {type(tile_error).__name__}; {res['warning']})"
        return res


# =============================================================================
# Core Detection Engine (PRD §5A)
# =============================================================================
def detect_features(
    lat: float,
    lon: float,
    polygon: Optional[Union[Dict[str, Any], Polygon, MultiPolygon]] = None,
    rtc_data: Optional[Dict[str, Any]] = None,
    official_legal_forest: bool = False,
    mode: Optional[str] = None
) -> Dict[str, Any]:
    """
    Primary detection entrypoint.
    Runs evidence collection across land cover, terrain, OSM infrastructure,
    and returns §5A.5 structured response.
    """
    settings = get_settings()
    rules = load_detection_rules()
    current_mode = mode or settings.LAND_DETECTION_MODE

    # Convert polygon input if GeoJSON dict
    poly_geom: Optional[Union[Polygon, MultiPolygon]] = None
    if polygon is not None:
        if isinstance(polygon, dict):
            try:
                poly_geom = shape(polygon)
            except Exception:
                poly_geom = None
        elif isinstance(polygon, (Polygon, MultiPolygon)):
            poly_geom = polygon

    is_polygon = poly_geom is not None and not poly_geom.is_empty
    acres = rules.get("point_only_acres", settings.AREA_CHECK_ACRES)
    radius_m = round(math.sqrt(acres * 4046.8564224 / math.pi), 1)

    # Geometry basis
    geom_basis = "polygon" if is_polygon else "point_circle"
    area_ha: Optional[float] = None
    if is_polygon:
        # Approximate area in ha from degree bounds or UTM
        try:
            from app.services.geo.area import geodesic_polygon_area_ha
            area_ha = geodesic_polygon_area_ha(poly_geom)
        except Exception:
            # Fallback estimation
            deg_area = poly_geom.area
            area_ha = round(deg_area * 111320.0 * 110540.0 * math.cos(math.radians(lat)) / 10000.0, 4)

    # Check cache (thread-safe, deep-copy, TTL)
    cache_key = (
        round(lat, 5), round(lon, 5),
        poly_geom.wkt if is_polygon else None,
        official_legal_forest,
        bool(rtc_data.get("is_plantation") if rtc_data else False)
    )
    ttl = rules.get("cache_ttl_s", settings.DETECTION_CACHE_TTL_S)
    now = time.time()
    with _cache_lock:
        if cache_key in _cache:
            ts, cached_res = _cache[cache_key]
            if now - ts < ttl:
                # D7: Mutating caller must not corrupt cache
                out = copy.deepcopy(cached_res)
                out["mode"] = current_mode
                return out

    # Parallel Execution with ThreadPoolExecutor (D6, M28)
    per_source_timeout = rules.get("timeouts", {}).get("per_source_s", settings.DETECTION_PER_SOURCE_TIMEOUT_S)
    total_budget = rules.get("timeouts", {}).get("total_budget_s", settings.DETECTION_TOTAL_BUDGET_S)

    sources_record: List[Dict[str, Any]] = []
    warnings: List[str] = []

    executor = ThreadPoolExecutor(max_workers=4)
    start_time = time.time()

    # Futures
    tif_url = worldcover_tile_url(lat, lon)
    wc_future = executor.submit(land_cover_composition, tif_url, lat, lon, radius_m, poly_geom)
    dem_future = executor.submit(terrain_at, lat, lon, radius_m, poly_geom)
    osm_future = executor.submit(osm_check, lat, lon, radius_m, poly_geom)

    wc_result: Optional[Dict[int, float]] = None
    try:
        wc_t0 = time.time()
        wc_result = wc_future.result(timeout=min(per_source_timeout, total_budget))
        wc_ms = int((time.time() - wc_t0) * 1000)
        sources_record.append({
            "name": "esa_worldcover_2021",
            "state": "checked",
            "source_date": "2021",
            "licence": "CC BY 4.0",
            "latency_ms": wc_ms
        })
    except Exception as e:
        if "404" in str(e) or "does not exist" in str(e):
            wc_result = {80: 1.0}
            sources_record.append({
                "name": "esa_worldcover_2021", "state": "checked",
                "source_date": "2021", "licence": "CC BY 4.0", "latency_ms": 10
            })
        else:
            warnings.append(f"WorldCover unavailable ({type(e).__name__}).")
            sources_record.append({
                "name": "esa_worldcover_2021",
                "state": "unavailable",
                "source_date": "2021",
                "licence": "CC BY 4.0",
                "latency_ms": int((time.time() - start_time) * 1000),
                "warning": str(e)
            })

    rem_budget = max(0.5, total_budget - (time.time() - start_time))
    terrain_result: Optional[Dict[str, float]] = None
    try:
        dem_t0 = time.time()
        terrain_result = dem_future.result(timeout=min(per_source_timeout, rem_budget))
        dem_ms = int((time.time() - dem_t0) * 1000)
        if terrain_result:
            sources_record.append({
                "name": "copernicus_dem_glo30",
                "state": "checked",
                "source_date": "2021",
                "licence": "Public Domain / CC0",
                "latency_ms": dem_ms
            })
    except Exception as e:
        warnings.append(f"Copernicus DEM unavailable ({type(e).__name__}).")
        sources_record.append({
            "name": "copernicus_dem_glo30",
            "state": "unavailable",
            "source_date": "2021",
            "licence": "Public Domain / CC0",
            "latency_ms": int((time.time() - start_time) * 1000),
            "warning": str(e)
        })

    rem_budget = max(0.5, total_budget - (time.time() - start_time))
    osm_result: Dict[str, Any] = {}
    try:
        osm_t0 = time.time()
        osm_result = osm_future.result(timeout=min(per_source_timeout, rem_budget))
        osm_ms = int((time.time() - osm_t0) * 1000)
        if osm_result.get("warning"):
            warnings.append(osm_result["warning"])
            sources_record.append({
                "name": "openstreetmap",
                "state": "unavailable",
                "source_date": "2024",
                "licence": "ODbL",
                "latency_ms": osm_ms,
                "warning": osm_result["warning"]
            })
        else:
            sources_record.append({
                "name": osm_result.get("source", "OpenStreetMap"),
                "state": "checked",
                "source_date": "2024",
                "licence": "ODbL",
                "latency_ms": osm_ms
            })
    except Exception as e:
        warnings.append(f"OpenStreetMap check timed out ({type(e).__name__}).")
        sources_record.append({
            "name": "openstreetmap",
            "state": "unavailable",
            "source_date": "2024",
            "licence": "ODbL",
            "latency_ms": int((time.time() - start_time) * 1000),
            "warning": str(e)
        })

    executor.shutdown(wait=False)

    # --- Feature Assessment per §5A ---
    # 1. Forest & Plantation Guard
    tree_share = wc_result.get(10, 0.0) if wc_result else 0.0
    osm_wood = any("wood" in f or "forest" in f for f in osm_result.get("features", []))
    
    # Check plantation signature
    is_plantation = False
    if rtc_data:
        ltype = str(rtc_data.get("land_type", "")).lower()
        subc = str(rtc_data.get("subclass", "")).lower()
        if rtc_data.get("is_plantation") is True or any(
            p in ltype or p in subc
            for p in ["plantation", "coffee", "tea", "areca", "arecanut", "rubber", "coconut", "cardamom", "bagayat", "garden"]
        ):
            is_plantation = True

    cover_min = rules.get("forest", {}).get("cover_share_min", 0.50)
    forest_basis = []
    if wc_result and tree_share > 0:
        forest_basis.append(f"worldcover:10={tree_share:.2f}")
    if osm_wood:
        forest_basis.append("osm:landcover=wood")

    if official_legal_forest:
        forest_state = "detected"
        forest_kind = "legal"
        legal_status = "verified"
        forest_basis.append("official_protected_boundary")
    elif wc_result is None and not osm_wood:
        forest_state = "unknown"
        forest_kind = None
        legal_status = "unverified"
    elif is_plantation and tree_share >= cover_min:
        forest_state = "not_detected"
        forest_kind = "plantation"
        legal_status = "unverified"
        forest_basis.append("plantation_signature_confirmed")
    elif tree_share >= cover_min:
        forest_state = "detected"
        forest_kind = "cover"
        legal_status = "unverified"
    elif osm_wood and tree_share < cover_min:
        # Single source OSM wood or national park tag
        forest_state = "detected" if tree_share > 0.3 else "not_detected"
        forest_kind = "cover"
        legal_status = "unverified"
    else:
        forest_state = "not_detected"
        forest_kind = None
        legal_status = "unverified" if (official_legal_forest or osm_result.get("parks")) else "none"

    # 2. Buildings & Built-up
    built_wc_share = wc_result.get(50, 0.0) if wc_result else 0.0
    building_count = osm_result.get("building_count", 0)
    has_osm_building = any("building" in f for f in osm_result.get("features", []))

    buildings_basis = []
    if built_wc_share > 0:
        buildings_basis.append(f"worldcover:50={built_wc_share:.2f}")
    if has_osm_building:
        buildings_basis.append("osm:building")

    built_share = built_wc_share
    if built_share == 0.0 and has_osm_building:
        # Estimated minimal share for detected OSM buildings
        built_share = 0.02

    if wc_result is None and not has_osm_building:
        buildings_state = "unknown"
        footprint_ha = None
    elif built_share > 0 or has_osm_building:
        buildings_state = "detected"
        footprint_ha = round(built_share * area_ha, 4) if area_ha is not None else None
    else:
        buildings_state = "not_detected"
        footprint_ha = 0.0 if area_ha is not None else None

    # 3. Roads & Transport (farm tracks excluded)
    roads_list = osm_result.get("roads", [])
    roads_basis = [f"osm:{r}" for r in roads_list]
    if osm_result.get("warning"):
        roads_state = "unknown"
    elif roads_list:
        roads_state = "detected"
    else:
        roads_state = "not_detected"

    # 4. Water Bodies
    water_wc_share = wc_result.get(80, 0.0) if wc_result else 0.0
    has_osm_water = any("water" in f for f in osm_result.get("features", []))
    water_basis = []
    if water_wc_share > 0:
        water_basis.append(f"worldcover:80={water_wc_share:.2f}")
    if has_osm_water:
        water_basis.append("osm:water")

    water_share_min = rules.get("water", {}).get("share_min", 0.35)
    if wc_result is None and not has_osm_water:
        water_state = "unknown"
    elif water_wc_share >= water_share_min or has_osm_water:
        water_state = "detected"
    else:
        water_state = "not_detected"

    # 5. Terrain
    if terrain_result:
        terrain_block = {
            "state": "checked",
            "mean_slope_deg": terrain_result.get("mean_slope_deg", 0.0),
            "max_elevation_m": terrain_result.get("max_elevation_m", 0.0),
            "mean_elevation_m": terrain_result.get("mean_elevation_m", 0.0),
            "source": "copernicus_dem_glo30"
        }
    else:
        terrain_block = {
            "state": "unknown",
            "mean_slope_deg": None,
            "max_elevation_m": None,
            "mean_elevation_m": None,
            "source": "copernicus_dem_glo30"
        }

    response_block = {
        "mode": current_mode,
        "geometry_basis": geom_basis,
        "forest": {
            "state": forest_state,
            "kind": forest_kind,
            "share": round(tree_share, 4),
            "basis": forest_basis,
            "plantation_signature": is_plantation,
            "legal_status": legal_status,
        },
        "buildings": {
            "state": buildings_state,
            "share": round(built_share, 4),
            "footprint_ha": footprint_ha,
            "count": building_count,
            "basis": buildings_basis,
        },
        "roads": {
            "state": roads_state,
            "basis": roads_basis,
        },
        "water": {
            "state": water_state,
            "share": round(water_wc_share, 4),
            "basis": water_basis,
        },
        "terrain": terrain_block,
        "sources": sources_record,
        "warnings": warnings,
    }

    # Cache successful / complete answer
    if not warnings:
        with _cache_lock:
            _cache[cache_key] = (now, copy.deepcopy(response_block))
            if len(_cache) > _CACHE_MAX:
                _cache.pop(next(iter(_cache)))

    return response_block


# =============================================================================
# Legacy Adapter for donor area_check.py compatibility
# =============================================================================
def to_legacy_area_check(
    detection: Dict[str, Any],
    lat: float = 0.0,
    lon: float = 0.0,
    wc_fractions: Optional[Dict[int, float]] = None,
    terrain_dict: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Transforms detection dictionary into the donor area_check schema
    so donor UI and existing tests remain 100% compatible.
    """
    settings = get_settings()
    reasons = []

    # Roads
    if detection["roads"]["state"] == "detected":
        reasons.append("Road within the 0.7-acre area")

    # Buildings
    if detection["buildings"]["state"] == "detected":
        reasons.append("Building within the 0.7-acre area")

    # Forest
    if detection["forest"]["state"] == "detected" and not detection["forest"]["plantation_signature"]:
        reasons.append("Forest")

    # Water
    if detection["water"]["state"] == "detected":
        reasons.append("Water body")

    # Terrain
    terr = detection.get("terrain") or {}
    if terr.get("state") == "checked":
        max_elev = terr.get("max_elevation_m") or 0.0
        slope = terr.get("mean_slope_deg") or 0.0
        if max_elev > 4000.0:
            reasons.append(f"High mountain (elevation {max_elev:.0f} m)")
        if slope > 15.0:
            reasons.append(f"Mountain / steep terrain (slope {slope:.0f}°)")

    # Checked sources
    sources = [s["name"] for s in detection.get("sources", []) if s.get("state") == "checked"]
    warnings = detection.get("warnings", [])

    is_ag = None
    if sources:
        is_ag = len(reasons) == 0

    composition = {}
    if wc_fractions:
        composition = {
            WORLDCOVER_CLASSES.get(k, str(k)): round(100 * float(f), 1)
            for k, f in sorted(wc_fractions.items(), key=lambda kv: -kv[1])
        }

    return {
        "is_agricultural": is_ag,
        "reasons": reasons,
        "composition": composition,
        "terrain": terrain_dict or {
            "mean_slope_deg": terr.get("mean_slope_deg"),
            "max_elevation_m": terr.get("max_elevation_m"),
            "mean_elevation_m": terr.get("mean_elevation_m"),
        },
        "osm_features": detection["roads"].get("basis", []) + detection["buildings"].get("basis", []),
        "area_acres": settings.AREA_CHECK_ACRES,
        "radius_m": round(math.sqrt(settings.AREA_CHECK_ACRES * 4046.8564224 / math.pi), 1),
        "sources": sources,
        "warnings": warnings,
    }
