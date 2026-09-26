"""
Crop Data Pipeline Validation Suite for GeoAgri AI.
Enforces strict agronomic integrity, canonical taxonomy resolution, absence of synthetic duplicates,
absence of leaked CSV headers, and validation of empirical statistical profiles.
"""

from __future__ import annotations
import json
import sys
from pathlib import Path
import pandas as pd
import numpy as np

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.services.crops.crop_taxonomy import (
    RAW_TO_CANONICAL_MAP,
    CORE_22_RECOMMENDATION_CROPS,
    normalize_crop_id,
)

DATA_DIR = BASE_DIR.parent / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"


def validate_canonical_taxonomy() -> dict:
    """Asserts that every crop_id referenced anywhere resolves to exactly one canonical crop."""
    print("Checking Rule 1: Canonical Crop Taxonomy...")
    canonical_set = set(RAW_TO_CANONICAL_MAP.values())
    errors = []

    # 1. Crop_recommendation.csv
    df_rec = pd.read_csv(RAW_DIR / "Crop_recommendation.csv")
    unresolved_rec = [c for c in df_rec["label"].unique() if c not in canonical_set]
    if unresolved_rec:
        errors.append(f"Crop_recommendation.csv has uncanonical labels: {unresolved_rec}")

    # 2. Crop_recommendation_with_intercrops.csv
    df_inter = pd.read_csv(RAW_DIR / "Crop_recommendation_with_intercrops.csv")
    unresolved_main = [c for c in df_inter["main_crop"].unique() if c not in canonical_set]
    unresolved_inter = [c for c in df_inter["interm_crop"].unique() if c not in canonical_set]
    if unresolved_main:
        errors.append(f"Crop_recommendation_with_intercrops.csv has uncanonical main_crop: {unresolved_main}")
    if unresolved_inter:
        errors.append(f"Crop_recommendation_with_intercrops.csv has uncanonical interm_crop: {unresolved_inter}")

    # 3. Crop_yield.csv
    df_yield = pd.read_csv(RAW_DIR / "Crop_yield.csv")
    unresolved_yield = [c for c in df_yield["crop"].unique() if c not in canonical_set]
    if unresolved_yield:
        errors.append(f"Crop_yield.csv has uncanonical crops: {unresolved_yield}")

    # 4. crop_profile_best.csv
    df_profile = pd.read_csv(PROCESSED_DIR / "crop_profile_best.csv")
    unresolved_profile = [c for c in df_profile["crop_id"].unique() if c not in canonical_set]
    if unresolved_profile:
        errors.append(f"crop_profile_best.csv has uncanonical crop_id: {unresolved_profile}")

    # 5. crop_registry.json
    with open(PROCESSED_DIR / "crop_registry.json", "r") as f:
        reg_data = json.load(f)
    reg_ids = [r["crop_id"] for r in reg_data]
    unresolved_reg = [c for c in reg_ids if c not in canonical_set]
    if unresolved_reg:
        errors.append(f"crop_registry.json has uncanonical crop_id: {unresolved_reg}")

    # 6. intercrop_matrix.json
    with open(PROCESSED_DIR / "intercrop_matrix.json", "r") as f:
        mat_data = json.load(f)
    unresolved_mat_keys = [c for c in mat_data.keys() if c not in canonical_set]
    unresolved_mat_comps = [
        opt["companion_crop_id"]
        for v in mat_data.values()
        for opt in v
        if opt["companion_crop_id"] not in canonical_set
    ]
    if unresolved_mat_keys:
        errors.append(f"intercrop_matrix.json has uncanonical keys: {unresolved_mat_keys}")
    if unresolved_mat_comps:
        errors.append(f"intercrop_matrix.json has uncanonical companions: {set(unresolved_mat_comps)}")

    # 7. intercrop_pairs_best.csv
    df_pairs = pd.read_csv(PROCESSED_DIR / "intercrop_pairs_best.csv")
    unresolved_pair_prim = [c for c in df_pairs["primary_crop"].unique() if c not in canonical_set]
    unresolved_pair_inter = [c for c in df_pairs["intercrop"].unique() if c not in canonical_set]
    if unresolved_pair_prim:
        errors.append(f"intercrop_pairs_best.csv has uncanonical primary_crop: {unresolved_pair_prim}")
    if unresolved_pair_inter:
        errors.append(f"intercrop_pairs_best.csv has uncanonical intercrop: {unresolved_pair_inter}")

    if errors:
        raise AssertionError("\n".join(errors))
    print("  -> Passed: All crop references resolve to exactly one canonical crop.")
    return {"status": "passed"}


def validate_no_synthetic_duplicates() -> dict:
    """Asserts that zero _var_NN synthetic entries exist in crop_registry.json or any file."""
    print("Checking Rule 2: Zero Synthetic _var_NN Duplicates...")
    with open(PROCESSED_DIR / "crop_registry.json", "r") as f:
        reg_data = json.load(f)

    var_entries = [r["crop_id"] for r in reg_data if "_var_" in r["crop_id"]]
    if var_entries:
        raise AssertionError(
            f"Found {len(var_entries)} synthetic _var_NN duplicate entries in crop_registry.json: {var_entries[:5]}"
        )

    # Check across other files as well
    for f_path in [
        PROCESSED_DIR / "crop_profile_best.csv",
        PROCESSED_DIR / "intercrop_pairs_best.csv",
    ]:
        content = f_path.read_text(encoding="utf-8")
        if "_var_" in content:
            raise AssertionError(f"Found synthetic _var_ in {f_path}")

    print("  -> Passed: Zero synthetic _var_ entries found across all registry and profile files.")
    return {"status": "passed"}


def validate_clean_intercrop_pairs() -> dict:
    """Asserts that no column headers leaked into data rows of intercrop_pairs_best.csv."""
    print("Checking Rule 3: Clean Intercrop Pairs (No Leaked Header Rows)...")
    leaked_header_keywords = {
        "rainfall",
        "humidity",
        "temperature",
        "ph",
        "main_crop",
        "interm_crop",
        "inter_land_cover",
        "land_sustainability",
        "k",
        "n",
        "p",
    }
    df_pairs = pd.read_csv(PROCESSED_DIR / "intercrop_pairs_best.csv")
    for idx, row in df_pairs.iterrows():
        prim = str(row["primary_crop"]).strip().lower()
        comp = str(row["intercrop"]).strip().lower()
        if prim in leaked_header_keywords or comp in leaked_header_keywords:
            raise AssertionError(
                f"Leaked header detected at row {idx}: primary='{prim}', intercrop='{comp}'"
            )

    # Also assert support is positive integer
    if not (df_pairs["support"] > 0).all():
        raise AssertionError("Found non-positive support values in intercrop_pairs_best.csv")

    print(f"  -> Passed: {len(df_pairs)} clean intercrop pairs verified with zero header leakage.")
    return {"status": "passed", "pairs_count": len(df_pairs)}


def validate_statistical_grounding_and_no_duplicate_profiles() -> dict:
    """
    Asserts:
    1. Exactly the 22 core recommendation crops have data_confidence == 'high' with non-null averages.
    2. No two distinct crop_ids have identical avg_N/P/K/temp/hum/ph/rainfall to 2 decimal places.
    """
    print("Checking Rules 4 & 5: Statistical Grounding & No Duplicate Averages...")
    df_profile = pd.read_csv(PROCESSED_DIR / "crop_profile_best.csv")

    stat_cols = [
        "avg_N",
        "avg_P",
        "avg_K",
        "avg_temperature_c",
        "avg_humidity_pct",
        "avg_ph",
        "avg_rainfall_mm",
    ]

    high_conf = df_profile[df_profile["data_confidence"] == "high"]
    high_conf_crops = set(high_conf["crop_id"])

    # Assert exactly 22 high-confidence crops matching core recommendation set
    missing_core = CORE_22_RECOMMENDATION_CROPS - high_conf_crops
    if missing_core:
        raise AssertionError(f"High-confidence crops missing core recommendation crops: {missing_core}")

    if len(high_conf) != len(CORE_22_RECOMMENDATION_CROPS):
        raise AssertionError(
            f"Expected {len(CORE_22_RECOMMENDATION_CROPS)} high-confidence crops, found {len(high_conf)}"
        )

    # Assert none of the high confidence crops have null in stat_cols
    null_counts = high_conf[stat_cols].isna().sum()
    if null_counts.any():
        raise AssertionError(f"High-confidence crops contain null statistical averages:\n{null_counts}")

    # Assert all low confidence crops have NaN in stat_cols (not templated/fabricated identical copies)
    low_conf = df_profile[df_profile["data_confidence"] == "low"]
    non_null_low = low_conf[stat_cols].notna().sum()
    if non_null_low.any():
        raise AssertionError(
            f"Low-confidence crops have templated/fabricated numerical averages when they should be NaN:\n{non_null_low}"
        )

    # Check for identical averages: no two distinct crop_ids should match to 2 decimal places
    profile_rounded = high_conf.copy()
    for col in stat_cols:
        profile_rounded[col] = profile_rounded[col].round(2)

    dups = profile_rounded[profile_rounded.duplicated(subset=stat_cols, keep=False)]
    if not dups.empty:
        raise AssertionError(
            f"Duplicate statistical profiles detected (signal of copy-pasted data):\n{dups[['crop_id'] + stat_cols]}"
        )

    print("  -> Passed: 22 high-confidence crops verified with unique empirical statistics (0 duplicates).")
    return {"status": "passed", "high_confidence_count": len(high_conf)}


def run_full_pipeline_validation():
    print("=" * 60)
    print("GeoAgri AI: Crop Data Pipeline Validation Suite")
    print("=" * 60)
    validate_canonical_taxonomy()
    validate_no_synthetic_duplicates()
    validate_clean_intercrop_pairs()
    validate_statistical_grounding_and_no_duplicate_profiles()
    print("=" * 60)
    print("ALL DATA PIPELINE INTEGRITY RULES PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    run_full_pipeline_validation()
