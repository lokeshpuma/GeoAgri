"""
Unified Environmental Profile Service (PRD v3.4 §3.3).
Combines geospatial area, satellite features (GEE), weather metrics (NASA POWER), and soil properties (SoilGrids)
with per-source error containment, explicit failure tracking, and evidence metadata.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from app.services.geo.area import compute_polygon_area_ha
from app.services.geo.gee_client import fetch_satellite_features
from app.services.weather.nasa_power import fetch_weather_data
from app.services.soil.soilgrids import fetch_soil_data
from app.core.config import get_settings

logger = logging.getLogger(__name__)


async def build_environmental_profile(
    polygon_pts: list[tuple[float, float]] | None,
    point_pt: tuple[float, float] | None,
    season: str = "kharif",
    manual_soil: dict | None = None
) -> dict:
    """
    Builds and aggregates environmental profile with graceful degradation and source tracking.
    Never invents silent zeros for unretrieved data layers.
    """
    settings = get_settings()
    now_iso = datetime.now(timezone.utc).isoformat()
    sources = []
    data_mode = "demo_synthetic" if (settings.ALLOW_SYNTHETIC_DATA or settings.GEE_MOCK_FALLBACK) else "live"

    # 1. Geodesic Boundary / Centroid
    field_summary = compute_polygon_area_ha(polygon_pts, point_pt)
    centroid = (field_summary["centroid_lon"], field_summary["centroid_lat"])
    sources.append({
        "name": "geodesic_boundary",
        "state": "ok",
        "reason": None,
        "fetched_at": now_iso
    })

    # 2. Satellite & Terrain (Google Earth Engine)
    sat_features = None
    try:
        sat_features = fetch_satellite_features(polygon_pts, centroid, season)
        sources.append({
            "name": "google_earth_engine",
            "state": "ok",
            "reason": None,
            "fetched_at": now_iso
        })
    except Exception as e:
        logger.warning("Google Earth Engine fetch error: %s", e)
        sources.append({
            "name": "google_earth_engine",
            "state": "failed",
            "reason": str(e),
            "fetched_at": now_iso
        })

    # 3. Weather (NASA POWER)
    weather_features = None
    try:
        weather_features = await fetch_weather_data(centroid, season)
        sources.append({
            "name": "nasa_power",
            "state": "ok",
            "reason": None,
            "fetched_at": now_iso
        })
    except Exception as e:
        logger.warning("NASA POWER weather fetch error: %s", e)
        sources.append({
            "name": "nasa_power",
            "state": "failed",
            "reason": str(e),
            "fetched_at": now_iso
        })

    # 4. Soil (SoilGrids + manual blending)
    soil_features = None
    try:
        soil_features = await fetch_soil_data(centroid, manual_soil)
        sources.append({
            "name": "soilgrids",
            "state": "ok",
            "reason": None,
            "fetched_at": now_iso
        })
    except Exception as e:
        logger.warning("SoilGrids fetch error: %s", e)
        sources.append({
            "name": "soilgrids",
            "state": "failed",
            "reason": str(e),
            "fetched_at": now_iso
        })

    return {
        "field_summary": field_summary,
        "centroid": centroid,
        "season": season,
        "satellite": sat_features,
        "weather": weather_features,
        "soil": soil_features,
        "sources": sources,
        "data_mode": data_mode
    }
