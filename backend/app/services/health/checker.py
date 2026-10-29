"""
Comprehensive dependency and layer health check service (PRD v1.0 FR-26).
Performs live status checks without mocking:
- Google Earth Engine
- NASA POWER API
- Open-Meteo API
- PostgreSQL / PostGIS Spatial Database
- Local geospatial and label layers
"""
from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings
from app.services.geo.gee_test import test_gee_connection


async def check_gee_status() -> dict[str, Any]:
    """Inspects live GEE connectivity."""
    t0 = time.perf_counter()
    res = test_gee_connection()
    latency_ms = round((time.perf_counter() - t0) * 1000, 1)
    res["latency_ms"] = latency_ms
    return res


async def check_nasa_power_status() -> dict[str, Any]:
    """Performs lightweight live probe to NASA POWER daily point API."""
    settings = get_settings()
    url = settings.NASA_POWER_API_URL
    headers = {"User-Agent": settings.HTTP_USER_AGENT}
    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            # Minimal single-day probe at Karnataka centroid
            resp = await client.get(
                url,
                params={
                    "parameters": "T2M",
                    "community": "AG",
                    "longitude": "76.0",
                    "latitude": "14.5",
                    "start": "20230601",
                    "end": "20230601",
                    "format": "JSON",
                },
                headers=headers,
            )
            latency_ms = round((time.perf_counter() - t0) * 1000, 1)
            if resp.status_code == 200:
                return {"status": "reachable", "latency_ms": latency_ms, "http_code": 200}
            return {
                "status": "degraded",
                "latency_ms": latency_ms,
                "http_code": resp.status_code,
                "message": f"Unexpected response code {resp.status_code}",
            }
    except Exception as e:
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        return {"status": "unreachable", "latency_ms": latency_ms, "error": str(e)}


async def check_open_meteo_status() -> dict[str, Any]:
    """Pings Open-Meteo forecast API (fallback weather service)."""
    settings = get_settings()
    if not settings.OPEN_METEO_ENABLED:
        return {"status": "disabled", "message": "Open-Meteo fallback is disabled in settings"}

    headers = {"User-Agent": settings.HTTP_USER_AGENT}
    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={"latitude": 14.5, "longitude": 76.0, "current_weather": "true"},
                headers=headers,
            )
            latency_ms = round((time.perf_counter() - t0) * 1000, 1)
            if resp.status_code == 200:
                return {"status": "reachable", "latency_ms": latency_ms, "http_code": 200}
            return {
                "status": "degraded",
                "latency_ms": latency_ms,
                "http_code": resp.status_code,
            }
    except Exception as e:
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        return {"status": "unreachable", "latency_ms": latency_ms, "error": str(e)}


def check_db_status() -> dict[str, Any]:
    """Checks PostGIS database connectivity synchronously via SQLAlchemy."""
    settings = get_settings()
    db_url = settings.DATABASE_URL
    if not db_url:
        return {"status": "unconfigured", "message": "DATABASE_URL is not set."}

    from sqlalchemy import create_engine
    t0 = time.perf_counter()
    try:
        engine = create_engine(db_url, connect_args={"connect_timeout": 3})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            postgis_ver = None
            try:
                res = conn.execute(text("SELECT PostGIS_Version()")).scalar()
                postgis_ver = str(res)
            except Exception:
                pass
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        return {
            "status": "connected",
            "latency_ms": latency_ms,
            "postgis_version": postgis_ver or "not_installed",
        }
    except Exception as e:
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        return {"status": "unreachable", "latency_ms": latency_ms, "error": str(e)}


def check_local_layers_status() -> dict[str, Any]:
    """Inspects filesystem status of raw/external layers."""
    backend_dir = Path(__file__).resolve().parents[3]
    ext_dir = backend_dir / "ml" / "data" / "raw" / "external"

    layers = {
        "hydrorivers": ext_dir / "geo" / "hydrorivers",
        "hydrolakes": ext_dir / "geo" / "hydrolakes",
        "ftw_india_labels": ext_dir / "labels" / "ftw_india",
        "worldcover_2021": ext_dir / "geo" / "worldcover_2021",
        "ms_buildings": ext_dir / "geo" / "buildings_ms",
        "soilgrids": backend_dir / get_settings().SOILGRIDS_LOCAL_DIR if not Path(get_settings().SOILGRIDS_LOCAL_DIR).is_absolute() else Path(get_settings().SOILGRIDS_LOCAL_DIR),
    }

    report = {}
    for name, path in layers.items():
        if path.exists():
            files = [f.name for f in path.iterdir() if not f.name.startswith(".")]
            has_source_md = (path / "SOURCE.md").exists()
            data_files = [f for f in files if f != "SOURCE.md"]
            report[name] = {
                "available": len(data_files) > 0,
                "source_md_present": has_source_md,
                "file_count": len(data_files),
            }
        else:
            report[name] = {
                "available": False,
                "source_md_present": False,
                "file_count": 0,
            }
    return report


async def get_full_health_report() -> dict[str, Any]:
    """Aggregates all dependency and layer status checks."""
    settings = get_settings()
    gee = await check_gee_status()
    nasa = await check_nasa_power_status()
    meteo = await check_open_meteo_status()
    db = check_db_status()
    layers = check_local_layers_status()

    # Determine overall service status
    # Core requirement: at least one weather provider and GEE/layers
    all_ok = (
        gee["status"] == "connected"
        and (nasa["status"] == "reachable" or meteo["status"] == "reachable")
    )

    status = "healthy" if all_ok else "degraded"

    return {
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "environment": settings.ENV,
        "allow_synthetic_data": settings.is_synthetic_allowed(),
        "services": {
            "google_earth_engine": gee,
            "nasa_power": nasa,
            "open_meteo": meteo,
            "database": db,
        },
        "layers": layers,
    }


async def get_sources_health_report() -> dict[str, Any]:
    """PRD v3.4 §5.3: Check readiness of all external and local sources with zero leaked secrets."""
    settings = get_settings()

    # 1. Earth Engine
    gee_res = await check_gee_status()
    has_sa = bool(settings.GEE_SERVICE_ACCOUNT)
    has_key = bool(settings.GEE_PRIVATE_KEY_PATH and os.path.exists(settings.GEE_PRIVATE_KEY_PATH))
    gee_source = {
        "status": "ok" if gee_res.get("status") == "connected" else ("degraded" if gee_res.get("status") == "mock_fallback" else "unconfigured"),
        "credentials_present": bool(has_sa and has_key),
        "initialized": gee_res.get("status") == "connected",
        "message": gee_res.get("message", ""),
    }

    # 2. NASA POWER
    nasa_res = await check_nasa_power_status()
    nasa_source = {
        "status": "ok" if nasa_res.get("status") == "reachable" else "unreachable",
        "latency_ms": nasa_res.get("latency_ms"),
    }

    # 3. SoilGrids
    soil_dir = Path(settings.SOILGRIDS_LOCAL_DIR) if settings.SOILGRIDS_LOCAL_DIR else None
    soil_local = bool(soil_dir and soil_dir.exists())
    soilgrids_source = {
        "status": "ok",
        "mode": "local_rasters" if soil_local else "gee_openlandmap",
        "local_cache_present": soil_local,
    }

    # 4. Rule Files
    backend_root = Path(__file__).resolve().parents[3]
    rule_paths = {
        "land_class_rules": backend_root / "backend" / "app" / "rules" / "land_class_rules.yaml",
        "irrigability_rules": backend_root / "backend" / "app" / "rules" / "irrigability_rules.yaml",
        "yield_ceilings": backend_root / "backend" / "app" / "rules" / "yield_ceilings.yaml",
    }
    rules_loaded = {}
    all_rules_ok = True
    for name, path in rule_paths.items():
        exists = path.exists() or (Path("backend/app/rules") / path.name).exists()
        rules_loaded[name] = exists
        if not exists:
            all_rules_ok = False
    rules_source = {
        "status": "ok" if all_rules_ok else "missing",
        "files": rules_loaded,
    }

    # 5. Crop Registry
    try:
        from app.services.crops.registry import get_global_registry
        reg = get_global_registry()
        reg_count = len(reg)
        reg_ok = reg_count > 0
    except Exception:
        reg_count = 0
        reg_ok = False
    registry_source = {
        "status": "ok" if reg_ok else "missing",
        "total_crops": reg_count,
        "calibrated": (backend_root / "backend" / "ml" / "data" / "processed" / "registry_calibrated.json").exists(),
    }

    # 6. Model Files
    model_paths = {
        "crop_recommendation": backend_root / "backend" / "ml" / "models" / "crop_recommendation_model.joblib",
        "crop_yield_quantile": backend_root / "backend" / "ml" / "models" / "crop_yield_quantile_models.joblib",
        "legacy_crosswalk": backend_root / "backend" / "ml" / "data" / "processed" / "legacy_crosswalk.json",
        "model_card": backend_root / "backend" / "ml" / "models" / "model_card.json",
    }
    models_status = {}
    for mname, mpath in model_paths.items():
        cand1 = mpath.exists()
        cand2 = Path(str(mpath).replace(str(backend_root) + "/", "")).exists()
        models_status[mname] = cand1 or cand2
    models_source = {
        "status": "ok" if all(models_status.values()) else "partial",
        "models": models_status,
    }

    return {
        "status": "ok" if (gee_source["status"] == "ok" and rules_source["status"] == "ok" and registry_source["status"] == "ok") else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sources": {
            "earth_engine": gee_source,
            "nasa_power": nasa_source,
            "soilgrids": soilgrids_source,
            "rules": rules_source,
            "registry": registry_source,
            "models": models_source,
        }
    }
