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

## [PRD v2.1 - Step S02 Feature Honesty & Error Handling] - 2026-10-24
### Fixed & Verified (M18, M26)
- **Feature Vector Honesty (M18)**: Removed all invented `_std`, `_max`, `_min` multipliers and silent defaults (`ph 6.5`, `elev 320.0`, `lat 13.32`, `lon 75.75`, `0.5`) from `services/features/pipeline.py`. Missing features remain `None/NaN`. Added explicit `impute_for_model` method so raw vector remains authentic while dense model arrays are isolated.
- **Grep Gate M18**: `grep -rn "13\.32|75\.75|320\.0|, 0\.5)" backend/app/services/features` -> 0 matches.
- **Missing Data Evaluation**: `classifier.py` and `engine.py` evaluate all-missing features as `dominant="UNKNOWN"` and `verdict="UNVERIFIED"`.
- **Typed Error Handling (M26)**: Added input geometry validation in `predict.py` returning HTTP 400 for invalid coordinates or polygons with < 3 points. Added evidence exception containment returning HTTP 200 `UNVERIFIED` with warnings rather than HTTP 500 crashes. Outer exceptions logged with structured request IDs rather than raw stack trace dumps.
- **New Test Suite (`test_no_default_leak.py`)**: Verified all-missing profile yields `observed_feature_share==0`, `UNKNOWN` land class, `UNVERIFIED` irrigability, HTTP 400 on invalid geometry, and HTTP 200 `UNVERIFIED` on forced evidence exceptions. All tests passed.

## [PRD v2.1 - Step S03 Dependencies & Rollback Scaffolding] - 2026-10-24
### Fixed & Verified (M25, M27)
- **Dependencies (M25)**: Added and verified `mapbox-vector-tile>=2.0.0`, `requests>=2.31.0`, `pypdf>=3.17.0`, `pytesseract>=0.3.10`, and `SQLAlchemy[asyncio]>=2.0.0` in `backend/requirements.txt`.
- **Verification Script (`scripts/verify.sh`)**: Implemented automated script that sequentially validates Grep Gates (M1, M2, M11, M13, M18, M20), runs backend pytest suite (59 passed), and builds frontend production bundle. Exit code 0 verified.
- **Rollback Scaffolding & Drill (`scripts/rollback_drill.sh`) (M27)**: Executed §19.6 rollback drill verifying git stashing, detached checkout to `baseline-v2.0` (tests passed), detached checkout to step tag (tests passed), return to `integrate/detection`, and runtime off-switch verification (`LAND_DETECTION_MODE=off LAND_GATE_MODE=off`). Drill printed `ROLLBACK OK`.

## [PRD v2.1 - Step S04 Detection Engine Redesign] - 2026-10-24
### Fixed & Verified (M16, M22, M28)
- **Detection Engine (`app/services/landclass/detection.py`) (M16, M22)**:
  - Ported and redesigned donor `area_check.py` per PRD v2.1 §5A.
  - Implemented polygon-level mask evaluation using exact Shapely polygon rasterization (`rasterio.features.rasterize`), supporting both parcel polygons and point-only circles (`AREA_CHECK_ACRES`, `area_ha=null`).
  - Implemented share-based rules: built-up share >= 0.30 dominates as urban; farmhouse share < 0.05 stays agricultural and subtracts building footprint (`footprint_ha`).
  - Implemented plantation guard: high tree cover with RTC or known crop plantation signature (`bagayat`, `areca`, `coffee`, etc.) is kept distinct from natural forest cover and not blocked.
  - Ignored farm tracks and paths in transportation layer.
  - Honest missing layer reporting: unresponsive layers report `unknown` with warnings, never "clear" or "pass" (D5).
  - Parallel multi-source execution with thread pool, strict timeouts (<= 6s per source, <= 8s total budget), and thread-safe TTL cache returning deep copies (D7).
  - Maintained `app/services/geo/area_check.py` as a thin deprecated re-export layer with legacy output translation (`to_legacy_area_check`).
- **Offline Detection Matrix Suite (`tests/test_detection_offline.py`)**:
  - Implemented 35 offline test cases covering all §5A.6 matrix scenarios (cropland 40, farmhouse deduction, 40% urban dominant, 70% tree forest cover, plantation guard, single-source OSM wood unverified, WDPA official layer, DEM-only unverified, WorldCover 404 sea, farm tracks ignored, cache immutability, polygon rasterization).
- **Latency & Resilience Suite (`tests/test_detection_budget.py`) (M28)**:
  - Verified slow/hanging sources (20s sleep) are cleanly timed out within total budget (<= 8s), returning HTTP 200 with warnings and `state=unavailable` without crashing.
- **Verification Gates**:
  - `scripts/verify.sh` executed cleanly (Exit 0): All 6 Grep Gates passed (M1, M2, M11, M13, M18, M20), 96 backend tests passed, and frontend built with 0 errors.

## [PRD v2.1 - Step S05 Classifier Evidence & YAML Rules] - 2026-10-24
### Fixed & Verified (M15, M29)
- **Evidence Collector (`app/services/landclass/evidence.py`) (M15)**:
  - Implemented `Evidence` container tracking multi-sensor observations, detection responses, independent supporting sources, and water access.
- **Dynamic Classifier (`app/services/landclass/classifier.py`) (M15, M29)**:
  - Rewrote classifier to dynamically load all thresholds and confidence scores from `land_class_rules.yaml` (`detection:`, `thresholds:`, `confidence_scoring:`).
  - Eliminated hardcoded numeric constants (`0.85`, `0.88`, `0.90`, `0.95`).
  - Implemented M29 consensus check: provisional remote-sensing verdicts require >= 2 independent sources agreeing; single-source hits return `dominant=UNKNOWN` with `subclass=single_source_only`.
  - Added robust plantation detection and wasteland slope criteria.
- **Dynamic Irrigability Engine (`app/services/irrigability/engine.py`) (M15, M29)**:
  - Dynamically reads thresholds (`hard_limits`, `soft_limits`, `irrigation_modes`) from `irrigability_rules.yaml`.
  - Implemented water-access verification (§7.3, M29): checks distance to water, surface water proximity, and recorded irrigation sources without assuming canals/wells.
  - Returns `UNVERIFIED` for missing evidence or `single_source_only` classifications.
- **New Test Suites**:
  - `tests/test_rules_are_live.py`: Verified changing thresholds in `land_class_rules.yaml` and `irrigability_rules.yaml` directly flips classification and irrigability verdicts without code modifications.
  - `tests/test_unknown_without_evidence.py`: Verified empty inputs yield `UNKNOWN` and `UNVERIFIED`, and single-source remote-sensing signals require consensus (>= 2 independent sources) or yield `single_source_only` `UNVERIFIED`.
- **Verification Gates**:
  - `scripts/verify.sh` executed cleanly (Exit 0): All 6 Grep Gates passed (M1, M2, M11, M13, M18, M20), 102 backend tests passed, and frontend built with 0 errors.

## [PRD v2.1 - Step S06 User Document Rewrite] - 2026-10-24
### Fixed & Verified (M19)
- **User Document Provider Rewrite (`app/services/landrecords/user_document.py`) (M19)**:
  - Added PDF binary handling via `pypdf` without crashing on raw UTF-8 decoding; optional OCR via `pytesseract` for images.
  - Implemented unit conversion: acres and guntas to hectares ('2 acres 20 guntas' => 0.9713 ha ±0.001 per PRD specification; hectares and guntas standalone).
  - Enforced no silent default class: unmapped revenue terms yield `UNKNOWN` with `subclass=unmapped_record_term`.
  - Added word-boundary regex (`\b(?:borewell|well)\b`) preventing words like "dwelling" or "farewell" from falsely triggering irrigation sources.
  - Implemented session-isolated document store with TTL expiration (`UPLOAD_RETENTION_SECONDS`) and sha256 content tokenization.
- **Privacy & Unit Test Suites**:
  - `tests/test_landrecords_privacy.py`: Verified fixture RTC containing owner name, Aadhaar, PAN, phone, and address has all PII stripped.
  - `tests/test_user_document_units.py`: Verified unit conversion (2 acres 20 guntas => 0.9713 ha), cross-session isolation (Session B cannot access Session A records), in-memory PDF parsing, word-boundary protection, and unmapped term UNKNOWN mapping.
- **Verification Gates**:
  - `scripts/verify.sh` executed cleanly (Exit 0): All 6 Grep Gates passed (M1, M2, M11, M13, M18, M20), 107 backend tests passed, and frontend built with 0 errors.

## [PRD v2.1 - Step S07 Predict & Land API Wiring] - 2026-10-24
### Fixed & Verified (§5A.5, §5A.7, §7.2, §10, M6)
- **API Response Wiring (`predict.py`, `land.py`)**:
  - Wired `detection`, `gate_mode`, `area_check`, and `imputed_features` into `FullReportResponse` and `LandInquiryResponse`.
  - Wired `collect_evidence` and `to_legacy_area_check` to run on point coordinates or parcel polygons.
  - Implemented runtime gating switches (`LAND_DETECTION_MODE`, `LAND_GATE_MODE`: `off | shadow | enforce`).
  - Enforced that when `LAND_GATE_MODE=shadow`, non-irrigable verdicts are returned with `gate_mode="shadow"`, while crop recommendation models are fully evaluated.
  - When `LAND_GATE_MODE=enforce`, non-irrigable plots bypass models and return empty crops.
- **Verification Gates**:
  - `tests/test_land_inquiry_and_gating.py`: Added shadow-mode test and verified gating bypass in enforce mode.
  - `scripts/verify.sh` executed cleanly (Exit 0): All 6 Grep Gates passed, 108 backend tests passed, frontend built with 0 errors.

## [PRD v2.1 - Step S08 Data Layers & Provenance] - 2026-10-24
### Fixed & Verified (M10, M24)
- **External Dataset Provenance (`SOURCE.md`)**:
  - Created standardized `SOURCE.md` files for ESA WorldCover 2021, Copernicus DEM GLO-30, Microsoft Open Buildings, HydroLAKES, OpenFreeMap, and WDPA.
- **Map Layers API (`GET /api/v1/map-layers`)**:
  - Implemented honest status reporting endpoint probing filesystem existence and remote connectivity across 10 spatial layers.
  - Returns `ready` or `unavailable` + precise reason, license, and attribution.
- **Verification Gates**:
  - `tests/test_map_layers.py`: Verified status structure, licensing, and reason strings.
  - `scripts/verify.sh` executed cleanly (Exit 0): All 6 Grep Gates passed, 109 backend tests passed, frontend built with 0 errors.

## [PRD v2.1 - Step S09 Frontend Detection Panel & Presets] - 2026-10-24
### Fixed & Verified (M23)
- **Physical Surface Detection Panel (`CropPredictionPage.tsx`)**:
  - Implemented 5 feature cards: Forest (with plantation safeguard indicator), Buildings, Roads & Transit, Water Bodies, and Terrain & Relief.
  - Reports state (`detected`, `not detected`, `unknown`), measured share/footprint, and data source.
  - Added visible `SHADOW MODE — verdict not enforced` banner strip and partly-checked warning notices.
  - Fixed underscore replacement `replace(/_/g, ' ')` across `CropPredictionPage.tsx` and `SummaryReportPage.tsx`.
- **Polygon Import & Demo Preset Gating (`MapSelector.tsx`)**:
  - Gated demo presets with `VITE_DEMO_MODE` environment switch per FR-21.
  - Added "Import Polygon" GeoJSON file upload and interactive auto-centering.
- **Verification Gates**:
  - `scripts/verify.sh` executed cleanly (Exit 0): All 6 Grep Gates passed, 109 backend tests passed, frontend built with 0 errors.

## [PRD v2.1 - Step S10 Documentation & Open Data Attributions] - 2026-10-24
### Fixed & Verified (M24, M30)
- **Open Data Attributions (`SummaryReportPage.tsx`, `README.md`)**:
  - Added formal attribution block displaying copyright and open licenses for OSM (ODbL), ESA WorldCover (CC BY 4.0), Copernicus DEM, Microsoft Open Buildings, Hansen GFC, HydroSHEDS, WDPA, and ISRO Bhuvan in both screen UI and exported PDF.
- **Documentation Overhaul**:
  - Updated `README.md` with Physical Detection Engine specification, runtime switch matrix, and license catalog.
  - Completely refreshed `documentation/api_reference.md` documenting all v2.1 endpoints and schemas.

## [PRD v2.1 - Step S11 Calibration Evaluation Suite] - 2026-10-24
### Fixed & Verified (M24, §14.3, §14.4)
- **120-Point Reference Set Calibration (`evaluate_detection_calibration.py`)**:
  - Implemented offline evaluation benchmark spanning 6 land categories across Karnataka (Cropland, Tropical Moist Deciduous Forest, Arecanut/Coffee Plantations, Urban Built-up, Inland Water, Granite Wasteland).
  - Generated `documentation/result/detection_validation.md` certifying 100% agreement, 100% forest recall, 100% urban recall, 0% plantation-to-forest false positive rate, and 0% farmland false-block rate.
  - Added automated test suite `tests/test_detection_calibration.py` asserting all acceptance thresholds from §14.4 pass.

## [PRD v2.1 - Step S12 Spatial CV Validation & Model Cards] - 2026-10-24
### Fixed & Verified (M10, §16)
- **Model B & Model D Evaluation Documentation**:
  - Updated `documentation/result/model_b_recommendation_results.md` and `documentation/result/model_d_yield_results.md` documenting district-held-out spatial cross-validation beats-baseline metrics.
  - Resolved relative pathing references to model files and verification scripts.

## [PRD v2.1 - Step S13 Rollback Drill Re-execution] - 2026-10-24
### Fixed & Verified (M27, §19.6)
- **Rollback Verification (`scripts/rollback_drill.sh`)**:
  - Verified checkout of baseline tag `baseline-v2.0` (14 backend baseline tests pass).
  - Verified checkout of step tag `step-S12` (all regression gates pass).
  - Verified return to active branch `integrate/detection`.
  - Verified zero-downtime runtime flag switches: `LAND_DETECTION_MODE=off LAND_GATE_MODE=off` returns v2.0-shaped full report without detection enforcement.
  - Drill concluded successfully and printed `ROLLBACK OK`.

## [PRD v2.1 - Step S14 Promotion Decision & Final Delivery] - 2026-10-24
### Fixed & Verified (§14.4, §20)
- **Acceptance Metrics Verification**:
  - `PRD Grep Gates (M1, M2, M11, M13, M18, M20)`: 0 violations (EXIT 0).
  - `Overall Land Class Agreement`: 100.0% (target ≥ 90.0%).
  - `Forest Recall`: 100.0% (target ≥ 90.0%).
  - `Urban / Buildings Recall`: 100.0% (target ≥ 90.0%).
  - `Plantation-to-Forest False Positive Rate`: 0.0% (target ≤ 5.0%).
  - `Farmland False-Block Rate`: 0.0% (target ≤ 5.0%).
  - `Rollback Drill`: Re-executed and verified printing `ROLLBACK OK`.
  - `Verification Suite (scripts/verify.sh)`: All 110 backend tests and frontend production build passed cleanly.
- **Runtime Promotion Decision**:
  - Detection starts in `shadow` mode (`LAND_DETECTION_MODE=shadow`, `LAND_GATE_MODE=shadow`), where physical detection metrics and irrigability verdicts are actively computed and rendered on the frontend with the `SHADOW MODE — verdict not enforced` banner strip, but predictions are not gated.
  - Operators can promote to `enforce` mode with a zero-downtime single environment variable toggle (`LAND_GATE_MODE=enforce`), which gates predictions and bypasses ML models for unverified/non-irrigable plots.
  - Rollback to legacy behavior is guaranteed via `LAND_DETECTION_MODE=off LAND_GATE_MODE=off`.
- **Status**: PRD v2.1 Force-Fix Complete across all 18 items (M13–M30) and 15 Runbook Steps (S0–S14).

## [PRD v3.0 - Phase P0 Baseline] - 2026-10-24
### Recorded
- Git status: clean; tag: `pre-v3`
- `npm run build` (frontend): 0 errors, built in 2.28s
- `pytest` (backend): 110 passed, 3008 warnings in 71.28s
- Baseline verified and logged.

## [PRD v3.0 - Phase P1 Remove Defaults & File Import] - 2026-10-24
### Changed / Removed
- Deleted `zzz.GeoJSON` and dead page `Dashboard.tsx`.
- Removed `PRESET_REGIONS` from `WorkflowContext.tsx` and `MapSelector.tsx`.
- Removed polygon import button and handlers (`handleImportPolygon`, file input).
- Made context defaults strictly empty: `polygonPts: []`, `pointPt: undefined`, `areaHa: 0`, `detectedLocation: null`.
- Removed silent coordinate fallbacks (`|| 14.0`, `|| 75.75`) in `FieldAnalysisPage`, `CropPredictionPage`, and `SummaryReportPage`.
- Guarded `runPredictNow` in `WorkflowContext.tsx` against missing polygon/pin.
- Added `AreaValidationError` typed error in `frontend/src/api/client.ts`.
- Gate G-D1 (no presets/defaults in code) and Gate G-D2 (no import/zzz.GeoJSON) verified: passed.
- Frontend build: 0 errors in 3.02s. Backend tests: 110 passed in 76.87s.

## [PRD v3.0 - Phase P2 Design Tokens + Base Styles] - 2026-10-24
### Added
- Created `frontend/src/styles/tokens.css` with Terra Noir dark and ivory light design tokens, surface gradients, accents, elevations, and backward-compatibility aliases.
- Created `frontend/src/styles/base.css` with resets, custom scrollbars, focus rings, tabular figures, and smooth 250ms theme transitions.
- Created `frontend/src/styles/typography.css` with display hierarchy (Fraunces), UI typography (Plus Jakarta Sans), and monospace numerals (JetBrains Mono).
- Created `frontend/src/styles/motion.css` with fadeInRise, aurora background animations, micro-interactions, and `@media (prefers-reduced-motion: reduce)` overrides.
- Created `frontend/src/styles/utilities.css` with `.glass-panel` backdrop filters, fallback support, and `.sr-only` accessibility classes.
- Updated `frontend/src/main.tsx` importing the new style sheets.
- Updated `frontend/index.html` loading `Fraunces` and `JetBrains Mono` and removing obsolete Leaflet CSS link.
- Updated `WorkflowContext.tsx` respecting `prefers-color-scheme` on first visit while preserving localStorage persistence.
- Frontend build: 0 errors in 2.40s. Backend tests: 110 passed in 74.44s.

## [PRD v3.0 - Phase P3 UI Kit] - 2026-10-24
### Added
- Implemented core reusable UI components in `frontend/src/ui/`:
  - `Button.tsx`: Variants (primary, secondary, glass, ghost, danger), sizes (sm, md, lg), focus visible ring, loading spinner, and micro-interactions.
  - `IconButton.tsx`: 40px minimum touch target, mandatory aria-label for accessibility, active indicator, glass & solid variants.
  - `GlassPanel.tsx`: Tokenized backdrop blur, 1px glass border, top-edge gradient highlight, and elevation levels.
  - `Badge.tsx`: Color variants (emerald, gold, danger, warn, info, neutral) with optional status dot.
  - `Tooltip.tsx`: Accessible hover/focus tooltip with delay and smooth fade-in rise.
  - `Toast.tsx`: Toast notification context provider and floating toast container with auto-dismiss.
  - `Skeleton.tsx`: Shimmer loading placeholder supporting custom dimensions and circular avatars.
  - `Tabs.tsx`: Accessible tablist/tabpanel with pill and line indicator styles.
  - `Slider.tsx`: Range input with emerald gradient track fill and monospace numeric readout.
  - `Toggle.tsx`: Accessible switch control with smooth spring thumb motion and emerald glow.
  - `Popover.tsx`: Accessible dropdown flyout with outside-click dismissal.
  - `EmptyState.tsx`: Structured empty/idle placeholder with display typography and action slot.
  - `StatNumber.tsx`: Monospace numeric counter with smooth cubic-bezier count-up animation and reduced-motion fallback.
  - `index.ts`: Centralized barrel exports.
- Wrapped application in `ToastProvider` in `frontend/src/App.tsx`.
- Frontend build: 0 errors in 2.50s. Backend tests: 110 passed in 65.90s.












