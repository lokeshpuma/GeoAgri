"""
Preprocessing Pipeline for GeoAgri AI Datasets.
Reads raw datasets from backend/ml/data/raw, runs normalization, updates intercrop mappings,
computes empirical crop yield quantiles from real historical yield data, and compiles:
- ml/data/processed/crop_registry.json
- ml/data/processed/intercrop_matrix.json
"""

import os
import json
import pandas as pd
import numpy as np
from app.services.crops.registry import CropRegistry, IntercropOption, QuantileValue
from app.services.crops.loader import load_csv_dataset, EmptyDatasetError
from app.services.crops.normalization import normalize_crop_name

def preprocess_and_compile(raw_dir: str, processed_dir: str):
    os.makedirs(processed_dir, exist_ok=True)
    registry = CropRegistry()

    # 1. Check raw dataset files & verify empty guard
    prod_path = os.path.join(raw_dir, "crop_production.csv")
    if os.path.exists(prod_path):
        try:
            load_csv_dataset(prod_path)
            print("Warning: Expected crop_production.csv to trigger EmptyDatasetError.")
        except EmptyDatasetError as e:
            print(f"Verified EmptyDatasetError guard successfully: {e}")

    # 2. Process historical Crop_yield.csv to compute real P10, P50, P90 baseline yields
    yield_files = ["Crop_yield.csv", "crop_yield.csv", "Crop_yeild.csv"]
    yield_path = None
    for yf in yield_files:
        p = os.path.join(raw_dir, yf)
        if os.path.exists(p) and os.path.getsize(p) > 100:
            yield_path = p
            break
            
    if yield_path and os.path.exists(yield_path):
        try:
            df_yield = pd.read_csv(yield_path)
            
            crop_col = None
            yield_col = None
            for col in df_yield.columns:
                c_low = col.strip().lower()
                if c_low in ["crop", "crop_name"]:
                    crop_col = col
                elif "yield" in c_low:
                    yield_col = col
                    
            if crop_col and yield_col:
                df_yield = df_yield.dropna(subset=[crop_col, yield_col])
                df_yield = df_yield[df_yield[yield_col] > 0]
                
                for raw_crop, group in df_yield.groupby(crop_col):
                    slug, _ = normalize_crop_name(str(raw_crop))
                    crop_profile = registry.get_crop(slug)
                    if crop_profile and len(group) >= 5:
                        p10 = round(float(np.percentile(group[yield_col], 10)), 2)
                        p50 = round(float(np.percentile(group[yield_col], 50)), 2)
                        p90 = round(float(np.percentile(group[yield_col], 90)), 2)
                        
                        # Sanity lower bounds
                        p10 = max(0.1, p10)
                        p50 = max(p10 * 1.05, p50)
                        p90 = max(p50 * 1.05, p90)
                        
                        crop_profile.baseline_yield_t_ha = QuantileValue(p10=p10, p50=p50, p90=p90)
                        crop_profile.data_confidence = "high"
                print(f"Updated baseline yield quantiles from {len(df_yield)} historical records.")
        except Exception as ex:
            print(f"Yield data processing notice: {ex}")

    # 3. Process intercrops matrix from Crop_recommendation_with_intercrops.csv
    intercrop_path = os.path.join(raw_dir, "Crop_recommendation_with_intercrops.csv")
    intercrop_map = {}
    if os.path.exists(intercrop_path):
        df_inter = pd.read_csv(intercrop_path)
        
        # Deduplicate pairs
        seen_pairs = set()
        
        for _, row in df_inter.iterrows():
            main_raw = row.get("main_crop", "")
            comp_raw = row.get("interm_crop", row.get("intercrop", ""))
            if not main_raw or not comp_raw:
                continue
                
            main_slug, main_display = normalize_crop_name(str(main_raw))
            comp_slug, comp_name = normalize_crop_name(str(comp_raw))
            
            pair_key = (main_slug, comp_slug)
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)
            
            # Boost and share calculation
            if "land_sustainability(%)" in row:
                boost = round(float(row["land_sustainability(%)"]) / 100.0, 3)
            else:
                boost = float(row.get("yield_boost_pct", 0.15))
                
            if "inter_land_cover(%)" in row:
                share = round(float(row["inter_land_cover(%)"]) / 100.0, 3)
            else:
                share = float(row.get("companion_share", 0.25))

            opt = IntercropOption(
                companion_crop_id=comp_slug,
                companion_crop_name=comp_name,
                yield_boost_pct=boost if boost > 0 else 0.15,
                companion_share_factor=share if share > 0 else 0.25,
                rationale=f"Combining {main_display} with {comp_name} optimizes nitrogen fixation, canopy ground-cover, and land equivalent ratio."
            )
            if main_slug not in intercrop_map:
                intercrop_map[main_slug] = []
            intercrop_map[main_slug].append(opt)

        # Attach intercrop options to registry
        for main_slug, options in intercrop_map.items():
            crop = registry.get_crop(main_slug)
            if crop:
                crop.intercrop_options = options

    # 4. Save compiled crop registry
    json_path = os.path.join(processed_dir, "crop_registry.json")
    registry.save_to_json(json_path)

    # 5. Save compiled intercrop matrix
    matrix_path = os.path.join(processed_dir, "intercrop_matrix.json")
    with open(matrix_path, "w") as f:
        json_data = {k: [opt.model_dump() for opt in v] for k, v in intercrop_map.items()}
        json.dump(json_data, f, indent=2)

    print(f"Preprocessing complete. Registered {len(registry.list_crops())} crops.")
    print(f"Compiled output saved to {processed_dir}")

if __name__ == "__main__":
    preprocess_and_compile("backend/ml/data/raw", "backend/ml/data/processed")
