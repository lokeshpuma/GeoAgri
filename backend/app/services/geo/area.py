"""
Geodesic Polygon Area & Buffer Service.
Computes field area in hectares on WGS84 ellipsoid and handles point fallback buffering.
"""

import math
from typing import Tuple, List
from shapely.geometry import Polygon, Point
from shapely.validation import make_valid
from pyproj import Geod

geod = Geod(ellps="WGS84")

def compute_polygon_area_ha(polygon_pts: List[Tuple[float, float]] | None, point_pt: Tuple[float, float] | None = None, default_buffer_m: float = 100.0) -> dict:
    """
    Computes polygon area in hectares, centroid coordinates, and validity status.
    Returns dictionary matching FieldSummary data contract.
    """
    polygon_valid = True
    used_fallback_buffer = False
    poly_obj = None

    if polygon_pts and len(polygon_pts) >= 3:
        # Ensure closed ring
        ring = list(polygon_pts)
        if ring[0] != ring[-1]:
            ring.append(ring[0])

        try:
            poly_obj = Polygon(ring)
            if not poly_obj.is_valid:
                poly_obj = make_valid(poly_obj)
        except Exception:
            poly_obj = None

    if poly_obj is None or poly_obj.is_empty or poly_obj.area == 0:
        polygon_valid = False
        used_fallback_buffer = True

        if point_pt is not None:
            lon, lat = point_pt
            # Approximate geodesic buffer circle around point
            buffer_deg = default_buffer_m / 111000.0  # ~100 meters in degrees
            pt_geom = Point(lon, lat)
            poly_obj = pt_geom.buffer(buffer_deg)
            centroid_lon, centroid_lat = lon, lat
            # Geodesic circle area = pi * r^2
            area_m2 = math.pi * (default_buffer_m ** 2)
            area_ha = area_m2 / 10000.0
            return {
                "area_ha": round(area_ha, 4),
                "centroid_lon": round(centroid_lon, 6),
                "centroid_lat": round(centroid_lat, 6),
                "polygon_valid": polygon_valid,
                "used_fallback_buffer": used_fallback_buffer
            }
        else:
            # Default fallback 1.0 ha if nothing provided
            return {
                "area_ha": 1.0,
                "centroid_lon": 78.4867,
                "centroid_lat": 17.3850,
                "polygon_valid": False,
                "used_fallback_buffer": True
            }

    # Calculate exact geodesic area on WGS84 ellipsoid using pyproj
    lons, lats = poly_obj.exterior.xy
    area_m2, _ = geod.geometry_area_perimeter(Polygon(zip(lons, lats)))
    area_ha = abs(area_m2) / 10000.0

    centroid = poly_obj.centroid
    centroid_lon, centroid_lat = centroid.x, centroid.y

    return {
        "area_ha": round(area_ha, 4),
        "centroid_lon": round(centroid_lon, 6),
        "centroid_lat": round(centroid_lat, 6),
        "polygon_valid": polygon_valid,
        "used_fallback_buffer": used_fallback_buffer
    }
