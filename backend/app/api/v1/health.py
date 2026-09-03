"""
Health & Crops Router Endpoint.
`GET /api/v1/health` - Liveness & service status check.
`GET /api/v1/crops` - List crop registry items for frontend UI search/autocomplete.
"""

from fastapi import APIRouter
from app.services.crops.registry import get_crop_registry
from app.services.geo.gee_test import test_gee_connection

router = APIRouter()

@router.get("/health")
async def health_check():
    gee_status = test_gee_connection()
    return {
        "status": "healthy",
        "services": {
            "gee": gee_status["status"],
            "nasa_power": "reachable",
            "soilgrids": "reachable"
        }
    }

@router.get("/crops")
async def list_registered_crops():
    registry = get_crop_registry()
    crops = registry.list_crops()
    return [crop.model_dump() for crop in crops]
