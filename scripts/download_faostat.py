#!/usr/bin/env python3
import os
import zipfile
import urllib.request
import io

target_dir = "backend/ml/data/raw/external/faostat"
os.makedirs(target_dir, exist_ok=True)
csv_path = os.path.join(target_dir, "Production_Crops_Livestock_E_All_Data_(Normalized).csv")

if os.path.isfile(csv_path) and os.path.getsize(csv_path) > 1000000:
    print(f"File already exists: {csv_path} ({os.path.getsize(csv_path)} bytes)")
    exit(0)

url = "https://fenixservices.fao.org/faostat/static/bulkdownloads/Production_Crops_Livestock_E_All_Data_(Normalized).zip"
print(f"Downloading FAOSTAT bulk normalized dataset from {url}...")

req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (GeoAgri AI Research)"})
with urllib.request.urlopen(req, timeout=120) as resp:
    data = resp.read()
    print(f"Downloaded {len(data)} bytes. Extracting...")
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for filename in z.namelist():
            print(f"Found archive member: {filename}")
            if "Normalized" in filename and filename.endswith(".csv"):
                with z.open(filename) as src, open(csv_path, "wb") as dst:
                    dst.write(src.read())
                print(f"Extracted to {csv_path} ({os.path.getsize(csv_path)} bytes)")
                break

print("FAOSTAT download and extraction completed successfully!")
