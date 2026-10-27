"""
Field Router Endpoint (PRD v3.0 §7).
`POST /api/v1/field/area`
Validates polygon boundary geometry using shapely & pyproj WGS84 geodesic math.
Returns HTTP 422 with {code, message} on invalid geometries.
"""
from __future__ import annotations

from typing import Optional, List, Tuple
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from shapely.geometry import Polygon
from pyproj import Geod

router = APIRouter()
geod = Geod(ellps="WGS84")

FIELD_MIN_HA = 0.01   # 100 m²
FIELD_MAX_HA = 1000.0 # 1,000 ha


class FieldAreaRequest(BaseModel):
    polygon: Optional[List[Tuple[float, float]]] = None
    point: Optional[Tuple[float, float]] = None


@router.post("/field/area")
async def calculate_field_area(req: FieldAreaRequest):
    # 1. Bare point path
    if req.polygon is None or len(req.polygon) == 0:
        if req.point is not None:
            lon, lat = req.point
            return {
                "area_ha": None,
                "perimeter_m": 0.0,
                "centroid": [round(lon, 6), round(lat, 6)],
                "centroid_lon": round(lon, 6),
                "centroid_lat": round(lat, 6),
                "polygon_valid": False,
                "boundary_source": "point_only",
                "area_method": "point_none"
            }
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "TOO_FEW_VERTICES", "message": "Either a polygon or point must be provided."}
        )

    pts = req.polygon

    # 2. Vertex count check (must be at least 3 distinct + 1 closing = 4 pts)
    if len(pts) < 4 and (len(pts) < 3 or pts[0] != pts[-1]):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "TOO_FEW_VERTICES", "message": "Polygon must have at least 3 distinct vertices."}
        )

    # 3. Closed ring check
    if pts[0] != pts[-1]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "NOT_CLOSED", "message": "Polygon ring is not closed (first vertex != last vertex)."}
        )

    # 4. Coordinate range check
    for lon, lat in pts:
        if not (-180.0 <= lon <= 180.0 and -90.0 <= lat <= 90.0):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={"code": "OUT_OF_RANGE", "message": f"Coordinates ({lon}, {lat}) exceed WGS84 bounds."}
            )

    # 5. Shapely validity & self-intersection
    try:
        poly_obj = Polygon(pts)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "SELF_INTERSECTION", "message": f"Invalid polygon geometry: {str(e)}"}
        )

    if not poly_obj.is_valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "SELF_INTERSECTION", "message": "Polygon edges self-intersect (bow-tie shape)."}
        )

    # 6. Geodesic area & perimeter calculation
    lons, lats = poly_obj.exterior.xy
    area_m2, perimeter_m = geod.geometry_area_perimeter(Polygon(zip(lons, lats)))
    area_ha = abs(area_m2) / 10000.0

    if area_ha < FIELD_MIN_HA:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "TOO_SMALL",
                "message": f"Area ({round(area_ha, 4)} ha) is below minimum of {FIELD_MIN_HA} ha."
            }
        )

    if area_ha > FIELD_MAX_HA:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "TOO_LARGE",
                "message": f"Area ({round(area_ha, 1)} ha) exceeds maximum limit of {FIELD_MAX_HA} ha."
            }
        )

    centroid = poly_obj.centroid
    return {
        "area_ha": round(area_ha, 4),
        "perimeter_m": round(abs(perimeter_m), 2),
        "centroid": [round(centroid.x, 6), round(centroid.y, 6)],
        "centroid_lon": round(centroid.x, 6),
        "centroid_lat": round(centroid.y, 6),
        "polygon_valid": True,
        "boundary_source": "user_drawn",
        "area_method": "geodesic"
    }
