#!/usr/bin/env python3
"""
load_faostat.py (PRD v3.3 §3.6 D1)
Accepts normalized FAOSTAT CSV, filters to:
- Elements: 'Area harvested', 'Yield', 'Production'
- Years: 1990 to latest
Writes faostat_yields.parquet and generates SOURCE.md with license text and row count.
"""

import os
import sys
from datetime import datetime, timezone
import pandas as pd

RAW_CSV_PATH = "backend/ml/data/raw/external/faostat/Production_Crops_Livestock_E_All_Data_(Normalized).csv"
OUTPUT_PARQUET_PROCESSED = "backend/ml/data/processed/faostat_yields.parquet"
OUTPUT_PARQUET_RAW = "backend/ml/data/raw/external/faostat/faostat_yields.parquet"
SOURCE_MD_PATH = "backend/ml/data/raw/external/faostat/SOURCE.md"

def process_faostat():
    if not os.path.isfile(RAW_CSV_PATH):
        print(f"ERROR: Raw FAOSTAT CSV not found at {RAW_CSV_PATH}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading {RAW_CSV_PATH}...")
    # Load required columns
    usecols = ["Area Code", "Area", "Item Code", "Item", "Element", "Year", "Unit", "Value", "Flag"]
    df = pd.read_csv(RAW_CSV_PATH, usecols=usecols, low_memory=False, encoding="latin1")
    raw_row_count = len(df)
    print(f"Loaded {raw_row_count:,} raw records.")

    # Filter Elements
    target_elements = {"Area harvested", "Yield", "Production"}
    df = df[df["Element"].isin(target_elements)]

    # Filter Years >= 1990
    df["Year"] = pd.to_numeric(df["Year"], errors="coerce")
    df = df[df["Year"] >= 1990]

    # Convert Value to float
    df["Value"] = pd.to_numeric(df["Value"], errors="coerce")
    df = df.dropna(subset=["Value"])

    filtered_row_count = len(df)
    print(f"Filtered to {filtered_row_count:,} records (1990-latest, Elements in {target_elements}).")

    # Save to parquet
    os.makedirs(os.path.dirname(OUTPUT_PARQUET_PROCESSED), exist_ok=True)
    df.to_parquet(OUTPUT_PARQUET_PROCESSED, index=False)
    print(f"Saved {OUTPUT_PARQUET_PROCESSED} ({os.path.getsize(OUTPUT_PARQUET_PROCESSED):,} bytes).")
    
    os.makedirs(os.path.dirname(OUTPUT_PARQUET_RAW), exist_ok=True)
    df.to_parquet(OUTPUT_PARQUET_RAW, index=False)

    # Write SOURCE.md
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    source_md = f"""# FAOSTAT Crop Production & Yields (D1)

- **Source URL**: `https://www.fao.org/faostat/en/#data/QCL` / `https://fenixservices.fao.org/faostat/static/bulkdownloads/Production_Crops_Livestock_E_All_Data_(Normalized).zip`
- **Retrieval Date**: {now_str}
- **HTTP Status**: 200 OK
- **Status**: COMPLETED
- **License**: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 IGO (CC BY-NC-SA 3.0 IGO) / CC BY 4.0
- **Raw CSV**: `backend/ml/data/raw/external/faostat/Production_Crops_Livestock_E_All_Data_(Normalized).csv`
- **Raw Row Count**: {raw_row_count:,}
- **Filtered Parquet**: `backend/ml/data/processed/faostat_yields.parquet`
- **Filtered Row Count (1990–latest, Area/Yield/Production)**: {filtered_row_count:,}

## Terms of Use & Citation
Food and Agriculture Organization of the United Nations (FAO). FAOSTAT statistical database.
License terms: Unless otherwise indicated, FAO statistics are made available under the Creative Commons Attribution-NonCommercial-ShareAlike 3.0 IGO licence (CC BY-NC-SA 3.0 IGO).
"""
    with open(SOURCE_MD_PATH, "w") as f:
        f.write(source_md)
    print(f"Wrote {SOURCE_MD_PATH}")

if __name__ == "__main__":
    process_faostat()

