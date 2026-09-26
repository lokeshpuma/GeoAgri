"""
Intercrop Registry & Profile Service.
Loads processed crop_profile_best.csv and parses companion intercrop partners.
"""

from __future__ import annotations
import os
import json
from pathlib import Path
from functools import lru_cache
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
CROP_PROFILE_PATH = BASE_DIR / "ml" / "data" / "processed" / "crop_profile_best.csv"
INTERCROP_PAIRS_PATH = BASE_DIR / "ml" / "data" / "processed" / "intercrop_pairs_best.csv"
INTERCROP_MATRIX_PATH = BASE_DIR / "ml" / "data" / "processed" / "intercrop_matrix.json"


def normalize_crop_name(value) -> str:
    from app.services.crops.crop_taxonomy import normalize_crop_id
    return normalize_crop_id(value)



@lru_cache(maxsize=1)
def get_all_crops() -> list[dict]:
    """
    Load crop profiles from processed crop_profile_best.csv.
    """
    if CROP_PROFILE_PATH.exists():
        return _load_crop_profile_csv()

    return []


def _load_crop_profile_csv() -> list[dict]:
    df = pd.read_csv(CROP_PROFILE_PATH)
    crops = []

    for _, row in df.iterrows():
        seasons = str(row.get("seasons", "kharif"))

        crops.append(
            {
                "crop_id": str(row.get("crop_id", "unknown")),
                "crop_name": str(row.get("crop_name", "Unknown")),
                "category": str(row.get("category", "general")),
                "seasons": seasons.split("|") if seasons else ["kharif"],
                "temp_min_c": float(row.get("temp_min_c", 15.0)),
                "temp_max_c": float(row.get("temp_max_c", 35.0)),
                "rain_min_mm": float(row.get("rain_min_mm", 400.0)),
                "rain_max_mm": float(row.get("rain_max_mm", 1200.0)),
                "ph_min": float(row.get("ph_min", 6.0)),
                "ph_max": float(row.get("ph_max", 7.5)),
                "water_need_mm": float(row.get("water_need_mm", 600.0)),
                "yield_potential_t_ha": float(
                    row.get("yield_potential_t_ha", 2.0)
                ),
                "data_confidence": str(row.get("data_confidence", "low")),
                "intercrop_partners": str(row.get("intercrop_partners", "")),
            }
        )

    return crops


def get_crop_by_id(crop_id: str) -> dict | None:
    for crop in get_all_crops():
        if crop["crop_id"] == crop_id:
            return crop
    return None


@lru_cache(maxsize=1)
def get_intercrop_pairs_map() -> dict[str, list[str]]:
    """Returns a dict mapping primary crop id -> list of companion crop ids."""
    pairs_map: dict[str, list[str]] = {}
    if INTERCROP_PAIRS_PATH.exists():
        df = pd.read_csv(INTERCROP_PAIRS_PATH)
        for _, row in df.iterrows():
            prim = normalize_crop_name(row["primary_crop"])
            comp = normalize_crop_name(row["intercrop"])
            if prim not in pairs_map:
                pairs_map[prim] = []
            if comp not in pairs_map[prim]:
                pairs_map[prim].append(comp)
    return pairs_map
