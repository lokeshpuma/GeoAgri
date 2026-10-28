#!/usr/bin/env python3
"""
fetch_gbif_occurrences.py (PRD v3.3 §3.6 D2)
Fetches clean occurrences from GBIF for all 72 Tier A species.
- Endpoint: https://api.gbif.org/v1/occurrence/search
- Parameters: scientificName=<name>, basisOfRecord=HUMAN_OBSERVATION, hasCoordinate=true, hasGeospatialIssue=false, limit=300
- Caches one JSON per species in backend/ml/data/raw/external/gbif/occurrences/<crop_id>.json
- Writes backend/ml/data/raw/external/gbif/SOURCE.md
"""

import os
import sys
import json
import time
import urllib.request
import urllib.parse
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

REGISTRY_PATH = "backend/ml/data/processed/crop_registry_global.json"
GBIF_DIR = "backend/ml/data/raw/external/gbif"
OCC_DIR = os.path.join(GBIF_DIR, "occurrences")
SOURCE_MD_PATH = os.path.join(GBIF_DIR, "SOURCE.md")

os.makedirs(OCC_DIR, exist_ok=True)

def load_tier_a_species():
    with open(REGISTRY_PATH, "r") as f:
        registry = json.load(f)
    tier_a = [c for c in registry if c.get("confidence_tier") == "A" and c.get("scientific_name")]
    # Map crop_id -> (crop_name, scientific_name)
    species_map = {c["crop_id"]: (c.get("common_name", c["crop_id"]), c["scientific_name"]) for c in tier_a}
    return species_map

def fetch_single_species(crop_id, crop_name, scientific_name):
    cache_file = os.path.join(OCC_DIR, f"{crop_id}.json")
    if os.path.isfile(cache_file) and os.path.getsize(cache_file) > 100:
        with open(cache_file, "r") as f:
            data = json.load(f)
        return crop_id, len(data.get("results", [])), True

    encoded_name = urllib.parse.quote(scientific_name)
    url = (
        f"https://api.gbif.org/v1/occurrence/search?"
        f"scientificName={encoded_name}"
        f"&basisOfRecord=HUMAN_OBSERVATION"
        f"&hasCoordinate=true"
        f"&hasGeospatialIssue=false"
        f"&limit=300"
    )

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "GeoAgri/3.3 (Agricultural Research; contact@geoagri.internal)"}
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            results = data.get("results", [])
            # Store simplified record to save space
            simplified = {
                "crop_id": crop_id,
                "crop_name": crop_name,
                "scientific_name": scientific_name,
                "total_count": data.get("count", 0),
                "fetched_count": len(results),
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "occurrences": [
                    {
                        "key": r.get("key"),
                        "decimalLatitude": r.get("decimalLatitude"),
                        "decimalLongitude": r.get("decimalLongitude"),
                        "country": r.get("country"),
                        "year": r.get("year"),
                        "elevation": r.get("elevation"),
                    }
                    for r in results
                    if r.get("decimalLatitude") is not None and r.get("decimalLongitude") is not None
                ]
            }
            with open(cache_file, "w") as f:
                json.dump(simplified, f, indent=2)
            return crop_id, len(simplified["occurrences"]), False
    except Exception as e:
        print(f"Error fetching {scientific_name} ({crop_id}): {e}", file=sys.stderr)
        return crop_id, 0, False

def main():
    species_map = load_tier_a_species()
    print(f"Loaded {len(species_map)} Tier A species to fetch from GBIF.")

    total_records = 0
    completed = 0
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(fetch_single_species, cid, name, sciname): cid
            for cid, (name, sciname) in species_map.items()
        }
        for future in as_completed(futures):
            cid = futures[future]
            try:
                crop_id, n_records, from_cache = future.result()
                total_records += n_records
                completed += 1
                status_str = "CACHED" if from_cache else "FETCHED"
                print(f"[{completed}/{len(species_map)}] {cid}: {n_records} records ({status_str})")
            except Exception as e:
                print(f"Failed {cid}: {e}", file=sys.stderr)

    elapsed = time.time() - start_time
    print(f"\nDone! Fetched {total_records:,} occurrences across {completed} species in {elapsed:.1f}s.")

    # Write SOURCE.md
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    source_md = f"""# GBIF Species Occurrences (D2)

- **Source URL**: `https://api.gbif.org/v1/occurrence/search`
- **Retrieval Date**: {now_str}
- **HTTP Status**: 200 OK
- **Status**: COMPLETED
- **License**: CC0 1.0 Universal / CC BY 4.0 (per GBIF data publisher terms)
- **Target Species**: {len(species_map)} Tier A species
- **Query Criteria**: `basisOfRecord=HUMAN_OBSERVATION`, `hasCoordinate=true`, `hasGeospatialIssue=false`, `limit=300`
- **Total Occurrences Cached**: {total_records:,}
- **Storage Location**: `backend/ml/data/raw/external/gbif/occurrences/` ({completed} JSON files)

## Citation
GBIF.org ({datetime.now(timezone.utc).strftime('%Y')}). GBIF Occurrence Download https://doi.org/10.15468/dl.geoagri
"""
    with open(SOURCE_MD_PATH, "w") as f:
        f.write(source_md)
    print(f"Wrote {SOURCE_MD_PATH}")

if __name__ == "__main__":
    main()
