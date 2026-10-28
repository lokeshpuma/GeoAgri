"""
NASA POWER Monthly Climatology Service (PRD v3.2 §3, PRD v3.3 §3.1).
Fetches 12-month long-term temperature and precipitation climatology from NASA POWER API.
Includes 0.1-degree spatial caching, 7-day TTL for successful results, 30-day TTL for ocean cells,
LRU cap of 5,000 cells, file-backed persistence to backend/.cache/climatology.json, and strict validation.
No hardcoded cells. No invented data.
"""
from __future__ import annotations

import os
import json
import time
import httpx
from datetime import datetime, timezone
from collections import OrderedDict
from typing import Optional, Any
from dataclasses import dataclass, asdict
from pathlib import Path

DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
MONTH_KEYS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

SUCCESS_TTL_SECONDS = 7 * 86400      # 7 days
OCEAN_TTL_SECONDS = 30 * 86400       # 30 days
MAX_CACHE_CELLS = 5000

CACHE_FILE_PATH = Path(__file__).resolve().parents[3] / ".cache" / "climatology.json"

@dataclass
class MonthlyClimatologyResult:
    available: bool
    monthly_temp_c: list[float] | None = None
    monthly_rain_mm: list[float] | None = None
    status_message: str = "ok"
    source: str = "NASA_POWER_CLIMATOLOGY"

@dataclass
class CacheEntry:
    result: MonthlyClimatologyResult
    fetched_at: str
    expires_at: float

# In-memory LRU cache mapping cache_key -> CacheEntry
_CLIMATOLOGY_CACHE: OrderedDict[str, CacheEntry] = OrderedDict()

def get_cache_key(lat: float, lon: float) -> str:
    return f"{round(lat, 1):.1f}_{round(lon, 1):.1f}"

def clear_climatology_cache() -> None:
    _CLIMATOLOGY_CACHE.clear()
    if CACHE_FILE_PATH.exists():
        try:
            CACHE_FILE_PATH.unlink()
        except OSError:
            pass

def _load_disk_cache() -> None:
    if not CACHE_FILE_PATH.exists():
        return
    try:
        with open(CACHE_FILE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        now = time.time()
        for key, item in data.items():
            exp = float(item.get("expires_at", 0))
            if exp > now:
                res = MonthlyClimatologyResult(
                    available=item.get("available", False),
                    monthly_temp_c=item.get("monthly_temp_c"),
                    monthly_rain_mm=item.get("monthly_rain_mm"),
                    status_message=item.get("status_message", "ok"),
                    source=item.get("source", "NASA_POWER_CLIMATOLOGY")
                )
                _CLIMATOLOGY_CACHE[key] = CacheEntry(
                    result=res,
                    fetched_at=item.get("fetched_at", ""),
                    expires_at=exp
                )
        while len(_CLIMATOLOGY_CACHE) > MAX_CACHE_CELLS:
            _CLIMATOLOGY_CACHE.popitem(last=False)
    except Exception:
        pass

def _save_disk_cache() -> None:
    try:
        CACHE_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
        now = time.time()
        out_data = {}
        for k, v in _CLIMATOLOGY_CACHE.items():
            if v.expires_at > now:
                out_data[k] = {
                    "fetched_at": v.fetched_at,
                    "expires_at": v.expires_at,
                    "available": v.result.available,
                    "monthly_temp_c": v.result.monthly_temp_c,
                    "monthly_rain_mm": v.result.monthly_rain_mm,
                    "status_message": v.result.status_message,
                    "source": v.result.source,
                }
        with open(CACHE_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(out_data, f, indent=2)
    except Exception:
        pass

def _set_cache_entry(key: str, result: MonthlyClimatologyResult, ttl_seconds: float) -> None:
    now = time.time()
    now_iso = datetime.now(timezone.utc).isoformat()
    if key in _CLIMATOLOGY_CACHE:
        _CLIMATOLOGY_CACHE.move_to_end(key)
    _CLIMATOLOGY_CACHE[key] = CacheEntry(
        result=result,
        fetched_at=now_iso,
        expires_at=now + ttl_seconds
    )
    while len(_CLIMATOLOGY_CACHE) > MAX_CACHE_CELLS:
        _CLIMATOLOGY_CACHE.popitem(last=False)
    _save_disk_cache()

# Load persisted entries on startup
_load_disk_cache()

async def fetch_monthly_climatology(lat: float, lon: float) -> MonthlyClimatologyResult:
    """
    Fetches 12-month temperature (°C) and precipitation (mm) climatology from NASA POWER.
    Returns status: unavailable for open ocean coordinates or network failures.
    Never invents temperature or rainfall numbers.
    Never caches transient 429/500/503 errors or timeouts.
    """
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        return MonthlyClimatologyResult(
            available=False,
            status_message=f"Coordinates ({lat}, {lon}) exceed standard WGS84 range."
        )

    cache_key = get_cache_key(lat, lon)
    now = time.time()
    if cache_key in _CLIMATOLOGY_CACHE:
        entry = _CLIMATOLOGY_CACHE[cache_key]
        if entry.expires_at > now:
            _CLIMATOLOGY_CACHE.move_to_end(cache_key)
            return entry.result
        else:
            del _CLIMATOLOGY_CACHE[cache_key]

    url = "https://power.larc.nasa.gov/api/temporal/climatology/point"
    params = {
        "parameters": "T2M,PRECTOTCORR",
        "community": "AG",
        "longitude": f"{lon:.4f}",
        "latitude": f"{lat:.4f}",
        "format": "JSON",
    }

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(url, params=params)
            # AC-3: Transient HTTP errors (429, 500, 503, etc.) must NEVER be cached
            if resp.status_code != 200:
                return MonthlyClimatologyResult(
                    available=False,
                    status_message=f"NASA POWER climatology service returned HTTP {resp.status_code}."
                )

            data = resp.json()
            param = data.get("properties", {}).get("parameter", {})
            t2m = param.get("T2M", {})
            precip_rate = param.get("PRECTOTCORR", {})

            temps: list[float] = []
            rains: list[float] = []

            for idx, m_key in enumerate(MONTH_KEYS):
                t_val = t2m.get(m_key)
                r_rate = precip_rate.get(m_key)

                # NASA POWER uses -999 or -999.0 for missing/fill values (e.g. over open water)
                if t_val is None or r_rate is None or float(t_val) <= -900.0 or float(r_rate) <= -900.0:
                    result = MonthlyClimatologyResult(
                        available=False,
                        status_message="Site is over open water or lacks valid land climatology in NASA POWER."
                    )
                    # Cache real ocean / no land data for 30 days
                    _set_cache_entry(cache_key, result, OCEAN_TTL_SECONDS)
                    return result

                temps.append(float(t_val))
                # PRECTOTCORR is daily rate in mm/day; multiply by days in each month
                monthly_rain = round(float(r_rate) * DAYS_IN_MONTH[idx], 1)
                rains.append(max(0.0, monthly_rain))

            result = MonthlyClimatologyResult(
                available=True,
                monthly_temp_c=temps,
                monthly_rain_mm=rains,
                status_message="ok",
                source="NASA_POWER_CLIMATOLOGY"
            )
            # Cache successful results for 7 days
            _set_cache_entry(cache_key, result, SUCCESS_TTL_SECONDS)
            return result

    except Exception as exc:
        # Never cache transient network connection/timeout/socket exceptions
        return MonthlyClimatologyResult(
            available=False,
            status_message=f"NASA POWER climatology service unreachable: {str(exc)}"
        )
