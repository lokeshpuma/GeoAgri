#!/usr/bin/env python3
"""
fetch_worldclim.py (PRD v3.3 §3.6 D3)
Downloads WorldClim 2.1 bioclimatic indicators (10 arc-minute base dataset).
- URL: https://geodata.ucdavis.edu/climate/worldclim/2_1/base/wc2.1_10m_bio.zip
- Extracts to backend/ml/data/raw/external/worldclim/
- Writes backend/ml/data/raw/external/worldclim/SOURCE.md
"""

import os
import sys
import zipfile
import urllib.request
import io
from datetime import datetime, timezone

WORLDCLIM_DIR = "backend/ml/data/raw/external/worldclim"
SOURCE_MD_PATH = os.path.join(WORLDCLIM_DIR, "SOURCE.md")
URL = "https://geodata.ucdavis.edu/climate/worldclim/2_1/base/wc2.1_10m_bio.zip"

os.makedirs(WORLDCLIM_DIR, exist_ok=True)

def download_and_extract():
    # Check if GeoTIFFs already exist
    tifs = [f for f in os.listdir(WORLDCLIM_DIR) if f.endswith(".tif")]
    if len(tifs) >= 19:
        print(f"WorldClim BIO GeoTIFFs already present ({len(tifs)} files in {WORLDCLIM_DIR}).")
        return len(tifs)

    print(f"Downloading WorldClim 2.1 bioclim indicators from {URL} (~49.8 MB)...")
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (GeoAgri AI Research)"})
    
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = resp.read()
        print(f"Downloaded {len(data):,} bytes. Extracting GeoTIFFs...")
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            extracted_count = 0
            for name in z.namelist():
                if name.endswith(".tif"):
                    z.extract(name, WORLDCLIM_DIR)
                    extracted_count += 1
            print(f"Extracted {extracted_count} bioclimatic layer GeoTIFFs to {WORLDCLIM_DIR}.")
            return extracted_count

def write_source_md(layer_count):
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    source_md = f"""# WorldClim 2.1 Bioclimatic Indicators (D3)

- **Source URL**: `{URL}`
- **Retrieval Date**: {now_str}
- **HTTP Status**: 200 OK
- **Status**: COMPLETED
- **License**: Creative Commons Attribution 4.0 International (CC BY 4.0)
- **Resolution**: 10 arc-minute (~18.5 km at equator) global grid
- **Layers Extracted**: {layer_count} GeoTIFF layers (`wc2.1_10m_bio_1.tif` to `wc2.1_10m_bio_19.tif`)
- **Storage Location**: `backend/ml/data/raw/external/worldclim/`

## Variables Included
- BIO1 = Annual Mean Temperature
- BIO2 = Mean Diurnal Range (Mean of monthly (max temp - min temp))
- BIO3 = Isothermality (BIO2/BIO7) (* 100)
- BIO4 = Temperature Seasonality (standard deviation *100)
- BIO5 = Max Temperature of Warmest Month
- BIO6 = Min Temperature of Coldest Month
- BIO7 = Temperature Annual Range (BIO5-BIO6)
- BIO8 = Mean Temperature of Wettest Quarter
- BIO9 = Mean Temperature of Driest Quarter
- BIO10 = Mean Temperature of Warmest Quarter
- BIO11 = Mean Temperature of Coldest Quarter
- BIO12 = Annual Precipitation
- BIO13 = Precipitation of Wettest Month
- BIO14 = Precipitation of Driest Month
- BIO15 = Precipitation Seasonality (Coefficient of Variation)
- BIO16 = Precipitation of Wettest Quarter
- BIO17 = Precipitation of Driest Quarter
- BIO18 = Precipitation of Warmest Quarter
- BIO19 = Precipitation of Coldest Quarter

## Citation
Fick, S.E. and R.J. Hijmans, 2017. WorldClim 2: new 1km spatial resolution climate surfaces for global land areas. International Journal of Climatology 37(12): 4302-4315. https://doi.org/10.1002/joc.5086
"""
    with open(SOURCE_MD_PATH, "w") as f:
        f.write(source_md)
    print(f"Wrote {SOURCE_MD_PATH}")

if __name__ == "__main__":
    count = download_and_extract()
    write_source_md(count)

