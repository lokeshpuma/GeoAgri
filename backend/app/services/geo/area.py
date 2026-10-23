"""
Geodesic Polygon Area Service (PRD v2.0 §3 M1, §9.1 FR-4).
Computes field area in hectares on WGS84 ellipsoid strictly from valid polygons.
Bare points never produce an area (area_ha is None).
"""
from __future__ import annotations

from typing import List, Tuple
from shapely.geometry import Polygon, Point
from shapely.validation import make_valid
from pyproj import Geod

geod = Geod(ellps="WGS84")


def compute_polygon_area_ha(
    polygon_pts: List[Tuple[float, float]] | None,
    point_pt: Tuple[float, float] | None = None
) -> dict:
    """
    Computes polygon area in hectares, centroid coordinates, and validity status.
    - Valid polygon: returns geodesic area_ha, centroid, polygon_valid=True.
    - Bare point: returns area_ha=None, centroid=(lon, lat), polygon_valid=False.
    - No geometry: raises ValueError.
    """
    if polygon_pts and len(polygon_pts) >= 3:
        ring = list(polygon_pts)
        if ring[0] != ring[-1]:
            ring.append(ring[0])

        try:
            poly_obj = Polygon(ring)
            if not poly_obj.is_valid:
                poly_obj = make_valid(poly_obj)
        except Exception:
            poly_obj = None

        if poly_obj is not None and not poly_obj.is_empty and poly_obj.area > 0:
            # Handle MultiPolygon if make_valid returns it
            if poly_obj.geom_type == "MultiPolygon":
                # Take largest component polygon
                poly_obj = max(poly_obj.geoms, key=lambda p: p.area)

            lons, lats = poly_obj.exterior.xy
            area_m2, _ = geod.geometry_area_perimeter(Polygon(zip(lons, lats)))
            area_ha = abs(area_m2) / 10000.0

            centroid = poly_obj.centroid
            return {
                "area_ha": round(area_ha, 4),
                "centroid_lon": round(centroid.x, 6),
                "centroid_lat": round(centroid.y, 6),
                "polygon_valid": True,
                "boundary_source": "user_drawn"
            }

    if point_pt is not None:
        lon, lat = point_pt
        return {
            "area_ha": None,
            "centroid_lon": round(lon, 6),
            "centroid_lat": round(lat, 6),
            "polygon_valid": False,
            "boundary_source": "point_only"
        }

    raise ValueError("Either a valid polygon or point coordinates must be provided.")
