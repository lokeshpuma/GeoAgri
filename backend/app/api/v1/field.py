"""
Field Router Endpoint.
`POST /api/v1/field/area`
Calculates instant geodesic polygon area for interactive frontend feedback.
"""

from __future__ import annotations
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.geo.area import compute_polygon_area_ha

router = APIRouter()

class FieldAreaRequest(BaseModel):
    polygon: list[tuple[float, float]] | None = None
    point: tuple[float, float] | None = None

@router.post("/field/area")
async def calculate_field_area(req: FieldAreaRequest):
    return compute_polygon_area_ha(req.polygon, req.point)
