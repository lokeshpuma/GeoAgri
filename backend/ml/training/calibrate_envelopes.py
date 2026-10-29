#!/usr/bin/env python3
"""
calibrate_envelopes.py (PRD v3.4 §3.1, AC-1)
Calibrates crop envelopes using real GBIF occurrences sampled against WorldClim 2.1 BIO1 and BIO12.
- For species with >= 100 clean occurrences:
  Computes 5th, 25th, 75th, 95th percentiles of annual temp and rainfall.
  Calculates share of occurrences outside EcoCrop min-max.
  Adjusts envelopes only where outside share > 15% (envelope_source: 'gbif_adjusted').
- Re-runs the four spot checks dynamically using score_crop and backend/tests/fixtures/spot_climates.json.
- Computes before/after scores and improved flag (after > before + 0.05); never uses hard-coded literals.
- Writes calibration_report.json and registry_calibrated.json.
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime, timezone
import numpy as np
import rasterio

# Ensure backend package imports succeed
REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.crops.envelope_suitability import score_crop, Site

REGISTRY_PATH = BACKEND_DIR / "ml" / "data" / "processed" / "crop_registry_global.json"
GBIF_OCC_DIR = BACKEND_DIR / "ml" / "data" / "raw" / "external" / "gbif" / "occurrences"
WORLDCLIM_DIR = BACKEND_DIR / "ml" / "data" / "raw" / "external" / "worldclim"
OUTPUT_REPORT_PATH = BACKEND_DIR / "ml" / "data" / "processed" / "calibration_report.json"
OUTPUT_CALIBRATED_REGISTRY = BACKEND_DIR / "ml" / "data" / "processed" / "registry_calibrated.json"
SPOT_CLIMATES_FIXTURE = BACKEND_DIR / "tests" / "fixtures" / "spot_climates.json"

BIO1_TIF = WORLDCLIM_DIR / "wc2.1_10m_bio_1.tif"
BIO12_TIF = WORLDCLIM_DIR / "wc2.1_10m_bio_12.tif"

def sample_raster_at_coords(raster_path, coords):
    """coords: list of (lon, lat) tuples"""
    if not os.path.isfile(raster_path):
        return []
    values = []
    with rasterio.open(raster_path) as src:
        for val in src.sample(coords):
            v = float(val[0])
            if v < -9990 or v > 99990:
                values.append(None)
            else:
                values.append(v)
    return values

def run_calibration():
    print("Loading crop registry...")
    with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
        registry = json.load(f)

    reg_by_id = {c["crop_id"]: c for c in registry}
    calibrated_registry = []
    calibration_results = {}

    print("Opening WorldClim rasters...")
    has_bio1 = os.path.isfile(BIO1_TIF)
    has_bio12 = os.path.isfile(BIO12_TIF)
    print(f"WorldClim BIO1 present: {has_bio1}, BIO12 present: {has_bio12}")

    occ_files = [f for f in os.listdir(GBIF_OCC_DIR) if f.endswith(".json")] if os.path.isdir(GBIF_OCC_DIR) else []
    print(f"Found {len(occ_files)} GBIF occurrence caches.")

    adjusted_species_count = 0

    for crop in registry:
        cid = crop["crop_id"]
        cache_file = os.path.join(GBIF_OCC_DIR, f"{cid}.json")
        crop_entry = dict(crop)
        crop_entry["envelope_source"] = "ecocrop"
        crop_entry["n_occurrences"] = 0

        if os.path.isfile(cache_file):
            with open(cache_file, "r", encoding="utf-8") as f:
                occ_data = json.load(f)
            occs = occ_data.get("occurrences", [])
            coords = [
                (o["decimalLongitude"], o["decimalLatitude"])
                for o in occs
                if o.get("decimalLongitude") is not None and o.get("decimalLatitude") is not None
            ]
            crop_entry["n_occurrences"] = len(coords)

            if len(coords) >= 100 and has_bio1 and has_bio12:
                temp_vals = [v for v in sample_raster_at_coords(BIO1_TIF, coords) if v is not None]
                prec_vals = [v for v in sample_raster_at_coords(BIO12_TIF, coords) if v is not None]

                if len(temp_vals) >= 80:
                    t_p5, t_p25, t_p75, t_p95 = np.percentile(temp_vals, [5, 25, 75, 95])
                    curr_temp = crop.get("temp_c") or {}
                    curr_t_min = curr_temp.get("min", t_p5)
                    curr_t_max = curr_temp.get("max", t_p95)

                    t_outside = sum(1 for t in temp_vals if t < curr_t_min or t > curr_t_max) / len(temp_vals)

                    p_p5, p_p25, p_p75, p_p95 = np.percentile(prec_vals, [5, 25, 75, 95]) if len(prec_vals) >= 80 else (0, 0, 0, 0)
                    curr_prec = crop.get("rainfall_mm") or {}
                    curr_p_min = curr_prec.get("min", p_p5)
                    curr_p_max = curr_prec.get("max", p_p95)
                    p_outside = sum(1 for p in prec_vals if p < curr_p_min or p > curr_p_max) / len(prec_vals) if len(prec_vals) >= 80 else 0

                    calibration_results[cid] = {
                        "crop_name": crop.get("common_name", cid),
                        "scientific_name": crop.get("scientific_name"),
                        "clean_occurrences": len(coords),
                        "temp_outside_share": round(float(t_outside), 4),
                        "prec_outside_share": round(float(p_outside), 4),
                        "temp_percentiles": {"p5": round(t_p5, 1), "p25": round(t_p25, 1), "p75": round(t_p75, 1), "p95": round(t_p95, 1)},
                        "rainfall_percentiles": {"p5": round(p_p5, 1), "p25": round(p_p25, 1), "p75": round(p_p75, 1), "p95": round(p_p95, 1)},
                        "adjusted": False
                    }

                    if t_outside > 0.15 or p_outside > 0.15:
                        crop_entry["envelope_source"] = "gbif_adjusted"
                        adjusted_species_count += 1
                        calibration_results[cid]["adjusted"] = True

                        if t_outside > 0.15:
                            new_t_min = min(curr_t_min, t_p5)
                            new_t_max = max(curr_t_max, t_p95)
                            crop_entry["temp_c"] = {
                                "min": round(float(new_t_min), 1),
                                "opt_min": round(float(curr_temp.get("opt_min", t_p25)), 1),
                                "opt_max": round(float(curr_temp.get("opt_max", t_p75)), 1),
                                "max": round(float(new_t_max), 1)
                            }

                        if p_outside > 0.15 and len(prec_vals) >= 80:
                            new_p_min = min(curr_p_min, p_p5)
                            new_p_max = max(curr_p_max, p_p95)
                            crop_entry["rainfall_mm"] = {
                                "min": round(float(new_p_min), 1),
                                "opt_min": round(float(curr_prec.get("opt_min", p_p25)), 1),
                                "opt_max": round(float(curr_prec.get("opt_max", p_p75)), 1),
                                "max": round(float(new_p_max), 1)
                            }

        calibrated_registry.append(crop_entry)

    # Save calibrated registry
    with open(OUTPUT_CALIBRATED_REGISTRY, "w", encoding="utf-8") as f:
        json.dump(calibrated_registry, f, indent=2)
    print(f"Saved {OUTPUT_CALIBRATED_REGISTRY} with {adjusted_species_count} species calibrated from GBIF.")

    # Spot checks evaluation (PRD v3.4 §3.1: dynamic computation via score_crop on spot_climates.json)
    spot_checks = {}
    if os.path.isfile(SPOT_CLIMATES_FIXTURE):
        with open(SPOT_CLIMATES_FIXTURE, "r", encoding="utf-8") as f:
            fixtures_data = json.load(f)

        calib_by_id = {c["crop_id"]: c for c in calibrated_registry}

        for key, spec in fixtures_data.get("spot_checks", {}).items():
            cid = spec["crop_id"]
            site = Site(
                monthly_temp_c=spec["monthly_temp_c"],
                monthly_rain_mm=spec["monthly_rain_mm"],
                ph=spec["ph"],
                irrigated=spec.get("irrigated", False)
            )
            ecocrop_crop = reg_by_id.get(cid)
            calibrated_crop = calib_by_id.get(cid)

            if ecocrop_crop and calibrated_crop:
                score_before = score_crop(ecocrop_crop, site)
                score_after = score_crop(calibrated_crop, site)
                improved = bool(score_after.score > score_before.score + 0.05)
                spot_checks[key] = {
                    "site": spec["site"],
                    "crop": spec["crop_name"],
                    "crop_id": cid,
                    "before": {
                        "score": round(float(score_before.score), 4),
                        "limiting_factor": score_before.limiting_factor,
                        "grade": score_before.grade
                    },
                    "after": {
                        "score": round(float(score_after.score), 4),
                        "limiting_factor": score_after.limiting_factor,
                        "grade": score_after.grade
                    },
                    "improved": improved
                }

    report = {
        "phase": "W1_calibration",
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        "calibration_status": "COMPLETED",
        "method": "GBIF human observations sampled against WorldClim 2.1 BIO1/BIO12 with >= 100 records and > 15% outside share adjustment",
        "total_species_analyzed": len(calibration_results),
        "adjusted_species_count": adjusted_species_count,
        "spot_checks_comparison": spot_checks,
        "species_calibration_metrics": calibration_results
    }

    with open(OUTPUT_REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"Calibration report written to {OUTPUT_REPORT_PATH}.")

if __name__ == "__main__":
    run_calibration()
