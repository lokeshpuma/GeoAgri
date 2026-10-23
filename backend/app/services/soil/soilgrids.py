"""
Soil Data Service (PRD v1.0 §6.1 #22, §10 #2).
Extracts topsoil (0-5cm) physical and chemical properties (pH, Organic Carbon, Nitrogen, Clay %, Sand %, Silt %).
Uses Google Earth Engine (OpenLandMap / SoilGrids 250m) as the primary real data source since ISRIC REST API is paused.
Applies weighted blending when user supplies manual soil health card data (`manual_soil`).
"""
from __future__ import annotations

import os
import numpy as np
from app.core.config import get_settings

CACHE_SOIL: dict[str, dict] = {}


def fetch_soil_from_gee(lon: float, lat: float) -> dict[str, float] | None:
    """Fetches real topsoil (0-5cm) properties via Earth Engine OpenLandMap / SoilGrids layers."""
    try:
        import ee
        if not ee.data.is_initialized():
            from app.services.geo.gee_test import test_gee_connection
            init_res = test_gee_connection()
            if init_res.get("status") != "connected":
                return None

        pt = ee.Geometry.Point([lon, lat])
        layers = {
            "ph": ee.Image("OpenLandMap/SOL/SOL_PH-H2O_USDA-4C1A2A_M/v02").select("b0"),
            "soc": ee.Image("OpenLandMap/SOL/SOL_ORGANIC-CARBON_USDA-6A1C_M/v02").select("b0"),
            "clay": ee.Image("OpenLandMap/SOL/SOL_CLAY-WFRACTION_USDA-3A1A1A_M/v02").select("b0"),
            "sand": ee.Image("OpenLandMap/SOL/SOL_SAND-WFRACTION_USDA-3A1A1A_M/v02").select("b0"),
        }
        stats = {k: img.reduceRegion(ee.Reducer.mean(), pt, 250).get("b0") for k, img in layers.items()}
        res = ee.Dictionary(stats).getInfo()
        if not res or res.get("ph") is None:
            return None

        ph_val = round(float(res["ph"]) / 10.0, 2)
        soc_val = round(float(res.get("soc", 2) or 2) * 5.0, 2)
        clay_val = round(float(res.get("clay", 25) or 25), 1)
        sand_val = round(float(res.get("sand", 45) or 45), 1)
        silt_val = round(max(5.0, 100.0 - clay_val - sand_val), 1)
        n_val = round(soc_val * 0.08, 2)

        return {
            "ph": ph_val,
            "organic_carbon_g_kg": soc_val,
            "nitrogen_g_kg": n_val,
            "phosphorus_ppm": None,
            "potassium_ppm": None,
            "texture_clay_pct": clay_val,
            "texture_sand_pct": sand_val,
            "texture_silt_pct": silt_val,
            "estimated": True
        }
    except Exception:
        return None


async def fetch_soil_data(centroid: tuple[float, float], manual_soil: dict | None = None) -> dict[str, float | None]:
    """
    Fetches topsoil (0-5cm) physical and chemical properties:
    - ph
    - organic_carbon_g_kg
    - nitrogen_g_kg
    - phosphorus_ppm (null if unmeasured; estimated flag set)
    - potassium_ppm (null if unmeasured; estimated flag set)
    - texture_clay_pct
    - texture_sand_pct
    - texture_silt_pct
    """
    lon, lat = centroid
    cache_key = f"{round(lon, 3)}_{round(lat, 3)}"

    soil_base = None
    if cache_key in CACHE_SOIL:
        soil_base = CACHE_SOIL[cache_key].copy()
    else:
        # 1. Primary real source: Google Earth Engine
        soil_base = fetch_soil_from_gee(lon, lat)

    if soil_base is None:
        # 2. If user provided manual soil data, construct profile from user input
        if manual_soil and isinstance(manual_soil, dict):
            p_val = manual_soil.get("phosphorus") or manual_soil.get("phosphorus_ppm")
            k_val = manual_soil.get("potassium") or manual_soil.get("potassium_ppm")
            return {
                "ph": float(manual_soil.get("ph") or 6.5),
                "organic_carbon_g_kg": float(manual_soil.get("organic_carbon") or manual_soil.get("organic_carbon_g_kg") or 12.0),
                "nitrogen_g_kg": float(manual_soil.get("nitrogen") or manual_soil.get("nitrogen_g_kg") or 0.25),
                "phosphorus_ppm": float(p_val) if p_val is not None else None,
                "potassium_ppm": float(k_val) if k_val is not None else None,
                "texture_clay_pct": float(manual_soil.get("texture_clay_pct") or 25.0),
                "texture_sand_pct": float(manual_soil.get("texture_sand_pct") or 45.0),
                "texture_silt_pct": float(manual_soil.get("texture_silt_pct") or 30.0),
                "estimated": p_val is None or k_val is None
            }

        # 3. Fail loudly if live source is unavailable and synthetic data is disabled
        settings = get_settings()
        if not settings.is_synthetic_allowed():
            raise RuntimeError("Live soil data unavailable and ALLOW_SYNTHETIC_DATA is false.")

        # Deterministic fallback soil profile (dev simulation only)
        h = int(abs(lat * 1000 + lon * 100)) % 100
        ph = round(6.0 + (h % 20) * 0.1, 2)
        soc = round(5.0 + (h % 15) * 0.8, 2)
        nitrogen = round(soc * 0.08, 2)
        clay = round(20.0 + (h % 20), 1)
        sand = round(35.0 + (h % 25), 1)
        silt = round(max(5.0, 100.0 - clay - sand), 1)

        soil_base = {
            "ph": ph,
            "organic_carbon_g_kg": soc,
            "nitrogen_g_kg": nitrogen,
            "phosphorus_ppm": None,
            "potassium_ppm": None,
            "texture_clay_pct": clay,
            "texture_sand_pct": sand,
            "texture_silt_pct": silt,
            "estimated": True
        }

    CACHE_SOIL[cache_key] = soil_base.copy()

    # Apply manual soil override / blending if provided
    if manual_soil and isinstance(manual_soil, dict):
        blended = soil_base.copy()
        # 0.8 weight for manual user data, 0.2 weight for remote soil
        for field in ["ph", "organic_carbon", "nitrogen", "phosphorus", "potassium", "texture_clay_pct", "texture_sand_pct", "texture_silt_pct"]:
            val = manual_soil.get(field)
            if val is not None and isinstance(val, (int, float)):
                base_field_name = "organic_carbon_g_kg" if field == "organic_carbon" else ("nitrogen_g_kg" if field == "nitrogen" else (f"{field}_ppm" if field in ["phosphorus", "potassium"] else field))
                existing_val = blended.get(base_field_name)
                if existing_val is not None:
                    blended[base_field_name] = round(0.8 * float(val) + 0.2 * float(existing_val), 2)
                else:
                    blended[base_field_name] = float(val)
        return blended

    return soil_base
