# Changelog

All notable changes to the GeoAgri project will be documented in this file in accordance with `PRD.md` §0.

## [Phase 0 - Foundations] - 2026-10-23

### Added
- **`app.core.config`**: Centralized typed application settings using `pydantic-settings` to manage environment flags (`ALLOW_SYNTHETIC_DATA`, `GEE_MOCK_FALLBACK`, `DATABASE_URL`, `NASA_POWER_API_URL`, `OPEN_METEO_ENABLED`, `SOILGRIDS_LOCAL_DIR`, etc.) per PRD §15.
- **PostGIS Container**: Added `postgis/postgis:15-3.4` service in `docker-compose.yml` with health checks, persistent volumes, and wired database connection strings.
- **Geospatial Stack**: Installed and pinned dependencies in `backend/requirements.txt`: `geopandas`, `rasterio`, `pyogrio`, `pyarrow`, `duckdb`, `SQLAlchemy`, `GeoAlchemy2`, `psycopg[binary]`, `pystac-client`, `planetary-computer`, `owslib`, and `cachetools`.
- **Live Health Service (`/api/v1/health`)**: Implemented live dependency checks without mock fallbacks for Google Earth Engine, NASA POWER daily API, Open-Meteo forecast API, PostgreSQL/PostGIS connectivity, and local layer inventory status (PRD §5.5 FR-26).
- **Synthetic Data Containment (`test_no_synthetic_leak.py`)**: Added unit test suite verifying that synthetic satellite, weather, and soil mock data cannot leak into production paths when `ALLOW_SYNTHETIC_DATA=false`.
- **Dataset Provenance & Workflows**:
  - Downloaded zero-key sample datasets (`ftw_india_boundaries` and `hydrorivers`).
  - Added auto-generated `SOURCE.md` files for downloaded layers.
  - Added `backend/ml/data/raw/SOURCE.md` classifying legacy CSV files as baseline/demo data due to unknown provenance and agronomic anomalies.
  - Updated `.gitignore` to prevent tracking large external datasets while keeping all `SOURCE.md` metadata tracked.

### Changed
- **Default Mock Fallbacks**: Set `GEE_MOCK_FALLBACK=false` and introduced `ALLOW_SYNTHETIC_DATA=false` as defaults in `backend/.env`, `backend/.env.example`, `backend/Dockerfile`, and `docker-compose.yml`.
- **GEE Client Service**: Fixed `ee.data.is_initialized()` verification in `backend/app/services/geo/gee_client.py` and prevented silent fall-through to synthetic data upon exception. Verified live SRTM elevation and Sentinel-2 index computations with user's authenticated Google Cloud service account.
- **NASA POWER Service**: Enforced loud failure on network disconnect when `ALLOW_SYNTHETIC_DATA=false`, preventing fake random weather generation.
- **SoilGrids Service**: Replaced the paused ISRIC REST API (`rest.isric.org`) with real Google Earth Engine OpenLandMap / SoilGrids 250m layer queries (`phh2o`, `soc`, `nitrogen`, `clay`, `sand`, `silt`). Prevented silent fallback to synthetic soil and integrated user manual soil blending.

## [PRD v2.0 Implementation] - 2026-10-23
### Added
- **Land Classification Core (`app/services/landclass/`)**: Evaluates land classes (`AGRICULTURAL`, `FOREST_LEGAL`, `FOREST_COVER`, `WASTELAND`, `URBAN_BUILT`, `WATER_BODY`, `UNKNOWN`) based on `land_class_rules.yaml`.
- **Irrigability Engine (`app/services/irrigability/`)**: Implemented irrigability assessment returning `IRRIGABLE`, `CONDITIONALLY_IRRIGABLE`, `NOT_IRRIGABLE`, or `UNVERIFIED` per `irrigability_rules.yaml`.
- **Land Records Layer (`app/services/landrecords/`)**: Provider registry with `user_document`, `ksrsac_official`, `bhuvan_wms`, and `open_layers` adapters with PII stripping.
- **Prediction Gating**: Direct short-circuit in `POST /api/v1/predict/full-report` blocking crop models for `NOT_IRRIGABLE` plots.
- **Frontend Eligibility & Land Records UI**: Added regulatory exclusion banner, evidence table, usable area calculation, and land records panel.

## [PRD v2.1 - Step S0 Baseline] - 2026-10-24
### Recorded
- Baseline branch: `integrate/detection` from `main`
- Git baseline tag: `baseline-v2.0`
- External backup: `/Users/lokesh/Desktop/GeoAgri_BACKUP_v2.0.zip` (323MB, verified with `shasum -a 256`)
- `pytest -v` baseline execution: 54 passed in 59.86s
- `npm run build` baseline execution: 0 errors in 2.21s

## [PRD v2.1 - Step S01 Kill Fabrication] - 2026-10-24
### Fixed & Verified (M13, M14, M17, M20, M21)
- **Killed Fabricated Providers (M13)**: Rewrote `bhuvan_wms.py` and `open_layers.py` to perform real cheap probes and return `None` on unreachable layers instead of hardcoded synthetic agricultural records.
- **Grep Gate M13**: `grep -rn "Agricultural / Cultivable|Agricultural Cropland" backend/app` -> 0 matches.
- **Record Override Rules (M14)**: Enforced in `manager.py` and `classifier.py` that only records with `verification in ['official', 'user_provided']` can override classification, with conflict detection against remote-sensing signals.
- **Config Cleanup (M20)**: Removed `LAND_RECORDS_MOCK_FALLBACK` and guessed `KSRSAC_REST_ENDPOINT`. Added detection & gating flags (`LAND_DETECTION_MODE`, `LAND_GATE_MODE`, etc.) to `config.py` and `.env.example`.
- **Grep Gate M20**: `grep -rn "ksrsac.karnataka.gov.in/geoserver" backend` -> 0 matches.
- **Honest Provenance (M17)**: `land.py` computes true observed feature share, reports genuine layer states, and leaves `admin.state` null when no boundary/record is present.
- **Non-Mocking Test Suite (M21)**: Replaced mock on `LandClassifier.classify` with genuine raster environment input. Added `test_no_coordinate_defaults_to_agricultural` and meta-test `test_meta_no_tests_patch_classifier`. All 56 tests passed.


