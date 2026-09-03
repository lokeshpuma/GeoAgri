"""
Unified Environmental Profile Service.
Combines geospatial area, satellite features (GEE), weather metrics (NASA POWER), and soil properties (SoilGrids) into a single cohesive profile.
"""

from app.services.geo.area import compute_polygon_area_ha
from app.services.geo.gee_client import fetch_satellite_features
from app.services.weather.nasa_power import fetch_weather_data
from app.services.soil.soilgrids import fetch_soil_data

async def build_environmental_profile(
    polygon_pts: list[tuple[float, float]] | None,
    point_pt: tuple[float, float] | None,
    season: str = "kharif",
    manual_soil: dict | None = None
) -> dict:
    """
    Builds and aggregates complete environmental profile dictionary.
    """
    # 1. Geodesic Area
    field_summary = compute_polygon_area_ha(polygon_pts, point_pt)
    centroid = (field_summary["centroid_lon"], field_summary["centroid_lat"])

    # 2. Satellite & Terrain (GEE)
    sat_features = fetch_satellite_features(polygon_pts, centroid, season)

    # 3. Weather (NASA POWER)
    weather_features = await fetch_weather_data(centroid, season)

    # 4. Soil (SoilGrids + manual blending)
    soil_features = await fetch_soil_data(centroid, manual_soil)

    return {
        "field_summary": field_summary,
        "centroid": centroid,
        "season": season,
        "satellite": sat_features,
        "weather": weather_features,
        "soil": soil_features
    }
