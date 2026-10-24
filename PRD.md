# GeoAgri AI — Product Requirements Document (PRD) v2.1

**Version:** 2.1 · **Date:** 2026-10-24 · **Supersedes:** PRD v2.0 (all v2.0 sections remain in force unless a v2.1 section says otherwise)
**Scope of v2.1:** (1) audit result of the "after PRD v2.0" build and **force-fix list**; (2) **forest & building detection** ported from `GeoAgri-added_forest_and_building_detection.zip` and redesigned; (3) **rollback / safe-integration plan**; (4) an ordered **Antigravity runbook** (§20).
**Integration target:** `geoagri_ai_after_finishing_the_prd.md_file_.zip` (v2.0 build). **Donor (read-only):** `GeoAgri-added_forest_and_building_detection.zip`.
**Implementation tool:** Antigravity (coding agent). **Read §0, §2B, §3B, §19, §20 first.**

---

## 0. Instructions to the coding agent (Antigravity) — non-negotiable

1. This PRD is the source of truth. If code and PRD disagree, follow the PRD and log it in `CHANGELOG.md`.
2. **Never fabricate data.** No synthetic satellite, soil, weather, parcel, survey-number, khata, area or crop values may reach a user-facing response. Synthetic data exists only when `ALLOW_SYNTHETIC_DATA=true` **and** the response is flagged `data_quality: "synthetic"`.
3. **Fail loudly and honestly.** A missing/unreachable source returns `unknown` / `unavailable` + reason. Never a silent default (no `18.5`, `145.0`, `0.58`, `1.0 ha`, no Hyderabad centroid).
4. **Evidence gate first, crops second.** Land class and irrigability are computed **before** any crop model runs (§5, §7).
5. **Do not scrape or bypass** Bhoomi, e-Swathu/e-Khata portals, Dishaank, K-GIS, Bhuvan UI, India-WRIS, Aranya Bhoomi. They are CAPTCHA/OTP/robots-restricted citizen services. Allowed access routes are only those in §6.3 (official data-sharing, user-uploaded documents, open datasets, documented WMS/APIs).
6. **No personal data.** Owner names, Aadhaar, phone, PAN and addresses of persons are stripped at parse time and never stored, logged or returned (§6.4).
7. Small commits: one per data source, service, model retrain. Run `pytest -v` (backend) and `npm run build` (frontend) before each commit.
8. Secrets only in `backend/.env` (git-ignored). Never commit keys, service-account JSON or downloaded land records.
9. **"Force change" rule:** items in §3 **and §3B** are mandatory. Do not mark a phase complete until its grep/test gate passes.
10. **Never mock the unit under test.** Tests may stub network/raster readers; they must not patch `LandClassifier.classify`, `IrrigabilityEngine.evaluate` or provider return values to force an outcome (M21).
11. **A provider returns real data or `None`.** No hard-coded `RecordResult`, no hard-coded `layers[]`/`data_quality`, no defaults standing in for missing features (A1–A7).
12. **Integrate safely.** Follow §19 (git baseline, one commit + tag per step, runtime flags). The donor zip is read-only; copy only the files named in §2B.3.
13. **Report real test results.** If a command cannot run, write `NOT RUN` and why. Never claim a pass you did not observe.

---

## 1. Product summary

> "For **this coordinate / plot**: what *is* the land (agriculture, forest, wasteland, urban, water), what do official records say, **can it be irrigated**, and — only if it can — which crops, yield, water need and climate risk apply?"

### 1.1 Goals
- **G1.** Classify every enquiry into a **land class** and an **irrigability verdict** with evidence, source, date, confidence.
- **G2.** Show a clear, unmissable **"NOT IRRIGABLE"** result (with reasons) for forest, urban/built-up, water body, and wasteland; no crop list for those.
- **G3.** Enquire land details by **coordinates** (and optional survey/khata number) through pluggable land-record providers (Karnataka first → India → other countries).
- **G4.** Real data end-to-end (v1 goal retained); models retrained on documented data.
- **G5.** Free-tier operation where possible; credentials that are needed are listed exactly (§8).

### 1.2 Non-goals
- Not a legal title, survey, or conversion/zoning certificate. Output is **decision support**, never legal proof.
- No ownership/personal data. No scraping. No claim of surveyor accuracy.
- "Not irrigable" means *as currently classified and evidenced*; it is not a statement that the land can never be reclaimed (wasteland can be reclaimable — §5.4).

---

## 2. What changed since PRD v1.0 (verified from `GeoAgri-main_2.zip`)

### 2.1 Done by Antigravity (Phase 0 — confirmed in code/CHANGELOG)
| Item | Evidence |
|---|---|
| Typed settings, `ALLOW_SYNTHETIC_DATA=false`, `GEE_MOCK_FALLBACK=false` defaults | `backend/app/core/config.py`, `.env.example`, `docker-compose.yml` |
| PostGIS service + geospatial deps | `docker-compose.yml`, `requirements.txt` (geopandas, rasterio, pyogrio, pyarrow, duckdb, SQLAlchemy, GeoAlchemy2, psycopg, pystac-client, planetary-computer, owslib, cachetools) |
| Live `/health` checker, no mocks | `backend/app/services/health/checker.py` |
| `test_no_synthetic_leak.py` | `backend/tests/` |
| SoilGrids REST replaced by GEE/OpenLandMap queries | `services/soil/soilgrids.py` (per CHANGELOG) |
| 2 sample datasets + `SOURCE.md`; legacy CSV `SOURCE.md` | `ml/data/raw/external/{labels/ftw_india,geo/hydrorivers}`, `ml/data/raw/SOURCE.md` |

### 2.2 Still wrong in the v1 repo (historic list; items 1–7 were fixed in the v2.0 build — see §2B for the current state)
| # | File | Remaining problem |
|---|---|---|
| 1 | `services/geo/area.py` | Point → 100 m circle (3.14 ha); no input → `1.0 ha` at Hyderabad `78.4867, 17.3850`. |
| 2 | `services/geo/land_mask.py` | Only Natural Earth 110 m ocean/land check; everything on land is "arable". |
| 3 | `api/v1/predict.py` | No eligibility/irrigability gate; flow is profile → features → models → fusion. |
| 4 | `schemas/predict.py` | `FieldSummary.used_fallback_buffer`; no land-class / irrigability / land-record blocks. |
| 5 | `services/soil/soilgrids.py` | Still contains constants `phosphorus_ppm 18.5`, `potassium_ppm 145.0` (lines ~49–50, ~88–89) and a seeded RNG synthetic block (~107–119). |
| 6 | `services/geo/gee_client.py` | Live branch still has hard-coded `"evi": 0.58` (~line 78) and a derived `evi = ndvi*0.88` (~line 110, not a real EVI). Other indices/radar values need audit. |
| 7 | `core/config.py` | Stale `SOILGRIDS_API_URL` (REST is paused). |
| 8 | `frontend/.../MapSelector.tsx` | Hard-coded Karnataka centroid/presets; click = point marker only; no polygon, overlays, evidence panel. |
| 9 | `ml/data/raw/external/` | Only 2 of ~15 datasets downloaded; WorldCover, MS buildings, HydroLAKES, GHSL, OSM, forest/protected layers absent. |
| 10 | `app/rules/` | Only `agronomic_rules.yaml`; no `land_class_rules.yaml` / `irrigability_rules.yaml`. |

---

## 2B. Audit of the "after PRD v2.0" build (`geoagri_ai_after_finishing_the_prd.md_file_.zip`) — v2.1 findings

Method: full read of the new v2 modules (`landclass/`, `irrigability/`, `landrecords/*`, `api/v1/land.py`, `predict.py`, schemas, rules, tests, frontend refs), grep gates M1–M3, `python -m compileall` on `backend/app`, `backend/tests`, `backend/ml/training`.
**Not verified:** `pytest -v` and `npm run build` could not be executed in the audit sandbox (PyPI/npm unreachable). Antigravity must run both first (§20, step S0) and record the real result in `CHANGELOG.md`. Compile check (syntax only) passed.

### 2B.1 What v2.0 got right (keep; do not regress)
| Item | Status |
|---|---|
| M1 `area.py`: no point buffer, no Hyderabad default; point → `area_ha: null` | ✅ grep gate clean |
| M2 `soilgrids.py`: P/K are `None` unless user-provided; no seeded RNG | ✅ grep gate clean |
| M3 `gee_client.py`: real `compute_evi()`; synthetic branch only when `ALLOW_SYNTHETIC_DATA` | ✅ (spot-checked) |
| M6 gate in `predict.py`: NOT_IRRIGABLE* ⇒ `recommended_crops: []`, models `skipped_not_irrigable` | ✅ implemented |
| M7 schemas (`LandClassification`, `Irrigability`, `LandRecordSummary`, `LandInquiryResponse`) | ✅ |
| Rules files, `/land/inquiry`, `/land/providers`, `/land/records/upload`, UI banner in `CropPredictionPage.tsx` | ✅ present |

### 2B.2 Defects (severity-ordered) — each is fixed by a §3B change
| ID | Sev | File | Defect | Effect |
|---|---|---|---|---|
| **A1** | **CRITICAL** | `services/landrecords/bhuvan_wms.py` | `by_coordinate()` never calls the WMS; it returns a **hard-coded record** `class_geoagri="AGRICULTURAL"`, "NRSC Bhuvan LULC 1:50K, 2022", for *every* coordinate on Earth. | Violates §0.2 (fabricated data). |
| **A2** | **CRITICAL** | `services/landrecords/open_layers.py` | Same: returns `AGRICULTURAL` "ESA WorldCover 2021 + Copernicus DEM" without reading any layer; `available()` always `ready`, `records_found=5`. | Fabricated provenance. |
| **A3** | **CRITICAL** | `landrecords/manager.py` + `landclass/classifier.py` | Manager returns the *first non-None record* (order: user_document, ksrsac, **bhuvan_wms**, open_layers); classifier's "record override" then returns that class at **confidence 0.95**. | Every plot classifies `AGRICULTURAL`; **forest / water / urban / wasteland can never be detected from real inputs and the NOT-IRRIGABLE gate never fires.** |
| **A4** | **CRITICAL** | `tests/test_land_inquiry_and_gating.py`, `test_phase8_landclass.py` | Gating test **patches `LandClassifier.classify`** to return WATER_BODY; inquiry tests only assert keys exist and verdict ∈ allowed set. | A3 is invisible to the suite. |
| **A5** | HIGH | `landclass/classifier.py` | `layer_hits` is never passed by `predict.py`/`land.py`, so water/building/protected-area layers are **never consulted**. YAML rules are loaded but **never read**. Class shares are literals (0.85, 0.88, 0.90, 0.95…). Plantation test is a lat/lon box + elevation. No WorldCover/OSM/buildings/Hansen evidence. | Forest & building detection effectively **absent**; "shares" are invented. |
| **A6** | HIGH | `api/v1/land.py` | Hard-coded `admin.state="Karnataka"` for any coordinate; `layers[]` always lists WorldCover/DEM/Sentinel-2/HydroLAKES as `"checked"`; `data_quality.observed_feature_share: 0.85` literal; notes claim Sentinel-2 was used. | Fabricated provenance (§0.2, §0.3). |
| **A7** | HIGH | `features/pipeline.py` | `_std/_max/_min` invented as ±5 %/10 % of the value; `None→0.0`; hidden defaults (`ph 6.5`, `lat 13.32`, `lon 75.75`, `elev 320`, `temp 25`, `rain 800`, generic `0.5`). Classifier/engine read these (`slope` default 2.0, `ndvi` 0.0). | Violates FR-12/13 feature honesty; silent defaults drive land class. |
| **A8** | HIGH | `landrecords/user_document.py` | Decodes **bytes as UTF-8** (PDF/JPG uploads → garbage; the RTC use-case does not work); extent regex treats **acres as hectares** (no guntas); **defaults to `AGRICULTURAL`** when no term matches; `"well" in text` matches "farewell/swelling"; token uses Python `hash()` (per-process random, `% 1e6` collisions); store is a **process-global dict shared by all users** (cross-user leakage, §6.4); `by_coordinate` returns any stored record with geometry (geometry is never set → dead code). | Wrong data, privacy risk. |
| **A9** | HIGH | `irrigability/engine.py` | Thresholds (20°, 8°, 82 %, 65 %) hard-coded; `irrigability_rules.yaml` ignored (violates M8). Never returns `UNVERIFIED`. Water-access check (§7.3) absent. Building deduction uses A5's invented shares. | Rules not tunable; no honest "don't know". |
| **A10** | MED | `core/config.py` | `KSRSAC_REST_ENDPOINT` is a **guessed URL**; `LAND_RECORDS_MOCK_FALLBACK` flag exists though no mock path should exist; `KSRSACOfficialProvider` reads `os.getenv` instead of settings. | Misleading config. |
| **A11** | MED | `api/v1/predict.py`, `land.py` | Blanket `except Exception → HTTP 500 detail=str(e)` and `traceback.print_exc()`. | Leaks internals; no structured logging. |
| **A12** | MED | `frontend CropPredictionPage.tsx` | `verdict.replace('_',' ')` replaces only the first underscore → "NOT IRRIGABLE_PROVISIONAL". Demo presets in `MapSelector.tsx` still present with no `VITE_DEMO_MODE` gate (FR-21); polygon file import (GeoJSON/KML/zipped SHP, FR-1) not found. | UX/spec gaps. |
| **A13** | MED | `CHANGELOG.md` | Stops at "Phase 0". All v2 work is undocumented (breaks §0.1). | Audit trail missing. |
| **A14** | LOW | misc | `SQLAlchemy[asyncio]` (donor) vs `SQLAlchemy` (after) mismatch; `mapbox-vector-tile` absent; `config.py` defaults `SOILGRIDS_SOURCE="gee"` but `.env.example` still says `local`. | Merge friction. |

### 2B.3 What the donor zip (`GeoAgri-added_forest_and_building_detection.zip`) actually is
It is a branch of the **original v1 repo** (not of v2.0) plus one feature. Files it truly adds/changes:
| Donor file | What it is | Disposition |
|---|---|---|
| `backend/app/services/geo/area_check.py` (472 lines) | **The detection engine**: a ≈0.7-acre (≈30 m radius) circle around the pin is checked against **ESA WorldCover v200 10 m** (COG on AWS), **Copernicus DEM GLO-30** (COG on AWS), **OpenStreetMap via OpenFreeMap vector tiles** (Overpass as backup). Detects roads, railways, runways, **buildings**, **forest**, snow/ice, steep/high terrain, water/wetland/mangrove/bare/tundra, settlements/industry/quarries/landfill/cemetery/military, national parks/nature reserves. Parallel threads, LRU cache, partial-failure warnings. | **PORT (refactor)** — §5A |
| `backend/tests/test_area_check.py` (231 lines, offline) | Synthetic-raster + stubbed-network tests | **PORT** and extend |
| `backend/requirements.txt` | adds `mapbox-vector-tile>=2.0.0`, `SQLAlchemy[asyncio]` | **MERGE** |
| `frontend/src/api/client.ts` | `area_check?` response type | **ADAPT** into `land_class.detection` types |
| `frontend/src/pages/CropPredictionPage.tsx` | "land cannot be farmed" banner + "partly checked" notice + passed notice | **ADAPT** to `detection` block |
| `README.md` | "0.7-Acre Land Check" section | **ADAPT** |
| `MapSelector.tsx`, `WorkflowContext.tsx` | Only demo-preset coordinates changed | **IGNORE** |
| `predict.py`, `schemas/predict.py`, `config.py`, `main.py`, `area.py`, `gee_client.py`, `soilgrids.py`, `PRD.md`, `test_phase3/4/5/7*`, `test_no_synthetic_leak.py` | **Older v1 versions** | **DO NOT COPY** — they would erase v2.0 (resurrect the 100 m buffer bug, drop the land router, remove land settings, restore P/K constants) |

### 2B.4 Defects in the donor's detection logic that must be fixed while porting
| ID | Defect | Required behaviour in v2.1 |
|---|---|---|
| **D1** | Evaluates only a **30 m circle at the centroid**; the user's polygon is ignored. | Evaluate the **polygon** (raster mask / geometry intersection). Circle only for point-only enquiries (`AREA_CHECK_ACRES`, default 0.7). |
| **D2** | **Any single WorldCover built-up pixel (class 50) rules out the whole area** (10 m pixels, ≈77 % overall accuracy; a farmhouse = rejection). Contradicts §5.2 "farmhouse ≠ whole-plot rejection". | Share-based rule + footprint subtraction (`building_share`, `footprint_ha`). Legacy behaviour available only as `detection.legacy_strict: true` for point-only. |
| **D3** | "Forest" = tree cover > 50 % **or OSM `landuse=forest/natural=wood`** → blocked. Coffee/areca/coconut/rubber plantations (Malnad, Kodagu, coastal Karnataka) would be called forest. | Output `forest.kind = "cover"` (physical) vs `"legal"` (protected/reserved polygon). Cover ⇒ `FOREST_COVER` + plantation-signature guard (§5A.4). Only protected-area/forest-boundary hits ⇒ `FOREST_LEGAL`. |
| **D4** | Slope threshold 15° / elevation 4000 m hard-coded and **differs from irrigability rules** (8° soft, 20° hard). 30 m DEM over a 30 m radius ≈ 5 pixels → noisy slope. | Detection returns raw metrics only; verdict thresholds live **only** in `irrigability_rules.yaml`. Slope computed over polygon (min window ≈ 90 m). |
| **D5** | `is_agricultural = (not reasons) if sources else None`: if **only the DEM** answers, `sources=[DEM]`, `reasons=[]` ⇒ **`True`** (false "clear"). | Require WorldCover **and** (OSM **or** local buildings layer) to state "not detected". Otherwise per-feature state `unknown`; overall `UNVERIFIED`. (§7 FR-7: missing ≠ clear.) |
| **D6** | Worst-case wait ≈ 40 s per source; `requests` blocking; p95 target is ≤ 5 s. | Per-source timeout ≤ 6 s, total budget ≤ 8 s, circuit breaker, TTL cache (24 h–30 d), return partial with warnings. |
| **D7** | Cache stores/returns the **same mutable dict**; no TTL. | Deep-copy on read; TTL; key on geometry hash + source versions. |
| **D8** | Network-only. Local COGs downloaded per `DATA_GUIDE.md` are never used. | **Local-first** (local WorldCover COG, local MS-buildings/OSM extract, local DEM/slope), remote COG/tiles as fallback; `source` and `source_date` recorded. |
| **D9** | OSM is treated as authority for "National park / nature reserve". OSM ≠ legal boundary. | Report as `basis: osm` with `legal_status: "unverified"`; legal only from WDPA/KSRSAC/Forest Dept layer. |
| **D10** | Thresholds (0.5, 15, 4000) in code constants. | Move to `land_class_rules.yaml` `detection:` block (§5A.3). |
| **D11** | OpenFreeMap terms of service not verified in this research (⚠). | Document in `SOURCE.md`; production should self-host or use the Geofabrik extract; respect ODbL attribution. |

---

## 3. MANDATORY CHANGE SET (force-apply) — with pass/fail gates

Antigravity must apply every row. Each has a **gate** that must pass before the item is closed.

| ID | Change | Gate (must pass) |
|---|---|---|
| **M1** | **Delete the point-buffer and default-centroid logic** in `area.py`. Require a valid polygon for any area. A bare point returns `area_ha: null` and the land enquiry still runs on the point (see §9.2). Remove `used_fallback_buffer` from schema (breaking change → log). | `grep -rn "78.4867\|17.3850\|default_buffer_m\|used_fallback_buffer" backend frontend/src` → **no matches**. Test: point-only request ⇒ `area_ha is None`. |
| **M2** | **Remove every hard-coded agronomic constant** in `soilgrids.py` (`18.5`, `145.0`) and the seeded-RNG synthetic soil branch. P/K come only from: user soil test → Soil Health Card district stats (`quality: estimated`) → `missing`. | `grep -rn "18\.5\|145\.0\|rng.uniform" backend/app/services/soil` → none. `test_no_synthetic_leak.py` extended and green. |
| **M3** | **Remove hard-coded spectral values** in `gee_client.py` (`evi: 0.58`, radar constants, raw-band constants). Compute EVI properly (`2.5*(NIR−RED)/(NIR+6*RED−7.5*BLUE+1)` on scaled SR), or return `missing`. Add date window, SCL cloud mask, provenance. | Unit test: no literal feature constants returned; every feature carries `{value, source, observed_at, quality}`. |
| **M4** | **New package `backend/app/services/landclass/`** — land-class classifier (§5). **New package `backend/app/services/irrigability/`** — irrigability engine (§7). | `pytest backend/tests/test_phase8_landclass.py test_phase9_irrigability.py` green; §13 matrix passes. |
| **M5** | **New package `backend/app/services/landrecords/`** — provider registry + adapters (§6). Adapters: `user_document` (RTC/e-Khata upload), `ksrsac_official` (stub until approved), `bhuvan_wms` (display/validation), `open_layers`. | `GET /api/v1/land/inquiry` returns provider status per provider; unavailable provider ⇒ `state:"unavailable"` with reason, never fake data. |
| **M6** | **Gate the prediction pipeline.** `predict.py` calls land-class → irrigability **first**. If `irrigability.verdict == "NOT_IRRIGABLE"` **or** land class ∈ {FOREST, URBAN_BUILT, WATER_BODY, WASTELAND} ⇒ return the classification and `recommended_crops: []`, `models: "skipped_not_irrigable"`. Environmental profile is built from the **eligible sub-polygon** only. | Test: lake, dense urban block, reserved-forest polygon, barren rocky wasteland ⇒ HTTP 200, `irrigability.verdict=="NOT_IRRIGABLE"`, no crop list, model runtime ≈ 0. |
| **M7** | **Schema update** (`schemas/predict.py`): add `LandClassification`, `Irrigability`, `LandRecordSummary`, `Provenance` models (§10); `FullReportResponse` gains `land_class`, `irrigability`, `land_records`, `eligibility`. | OpenAPI shows the new blocks; `documentation/api_reference.md` regenerated. |
| **M8** | **Rules in YAML, not code:** `backend/app/rules/land_class_rules.yaml`, `irrigability_rules.yaml`, `land_record_class_map.yaml` (§5.3, §7.3, §6.5). | Changing a threshold in YAML changes the verdict without code edits (test). |
| **M9** | **Frontend:** polygon draw/edit + file import; coordinate enquiry; **red "NOT IRRIGABLE" banner** with reasons; land-class legend; layer toggles; evidence + land-record panel; "provisional" styling; remove demo presets unless `VITE_DEMO_MODE=true`. | `npm run build` green; manual check list in §11 passes. |
| **M10** | **Data download** (§12 + `DATA_GUIDE.md`): run script for all zero-key sets; add new sources (Hansen, Karnataka protected areas, SRTM slope, etc.) with `SOURCE.md` each. | `/api/v1/map-layers` lists every layer as `ready` or `unavailable` + reason. |
| **M11** | **Config cleanup:** delete `SOILGRIDS_API_URL`; add env vars in §8; update `.env.example`, `docker-compose.yml`, `render.yaml`, `vercel.json`. | App boots with only `.env.example` keys documented. |
| **M12** | **Tests:** add `test_phase8_landclass.py`, `test_phase9_irrigability.py`, `test_landrecords_privacy.py` (PII stripped), `test_land_inquiry_api.py`; update `test_phase3…7` to drop mock assumptions. | `pytest -v` all green. |

---

## 3B. ADDITIONAL MANDATORY CHANGES (v2.1) — force-apply, with gates

M1–M12 above stay mandatory (**M4, M6 are re-opened**: implemented but functionally defeated by A3 until M13–M15 land). **M13–M30 are new.** Order of execution is in §20; rollback rules in §19. A change is closed only when its gate passes **and** `pytest -v` + `npm run build` are green.

| ID | Change | Gate (must pass) |
|---|---|---|
| **M13** | **Kill fabricated providers.** `bhuvan_wms.by_coordinate` must perform a real WMS `GetFeatureInfo` (OWSLib/httpx, timeout ≤ 6 s) or return `None`. `open_layers` must read real local/remote layers (§5A) or return `None`. Neither may return a hard-coded `RecordResult`. `available()` reports truth: `ready` only after a successful cheap probe (cached 5 min), else `unavailable(reason)`. | Test with network blocked: `bhuvan_wms.by_coordinate(...) is None`, `open_layers.by_coordinate(...) is None`, provider status `unavailable`. `grep -rn "Agricultural / Cultivable\|Agricultural Cropland" backend/app` → no matches. |
| **M14** | **Record-override rules.** Only records with `verification ∈ {official, user_provided}` may override remote-sensing classification. `reference_only`/`unverified` sources contribute **evidence**, never a class. If a record conflicts with ≥ 2 independent evidence sources → keep record class but set `conflict: true`, confidence ≤ 0.5, reason `record_vs_imagery_conflict`. | Test: manager with only reference sources ⇒ `record is None`; lake fixture + no document ⇒ `WATER_BODY`. |
| **M15** | **Classifier consumes real evidence.** New `landclass/evidence.py` (`collect_evidence(geometry|point) -> Evidence`) feeds `LandClassifier.classify(evidence, features, record)`. All thresholds read from `land_class_rules.yaml` (`detection:` + `thresholds:`). Class shares are **computed** from measured shares; no numeric literals for shares/confidence in code (confidence from `confidence_scoring:` in YAML). Insufficient evidence ⇒ `UNKNOWN`. | `test_rules_are_live`: changing a YAML threshold flips a fixture verdict. `test_unknown_without_evidence`. No literal `0.85/0.88/0.90/0.95` in `classifier.py`. |
| **M16** | **Port forest & building detection** from the donor (`area_check.py`) as `services/landclass/detection.py`, refactored per §5A (D1–D11). Keep `services/geo/area_check.py` as a thin deprecated re-export for one release. | §5A.6 test matrix green; `tests/test_detection_*.py` offline. |
| **M17** | **Honest provenance in `land.py` / `predict.py`.** `layers[]`, `data_quality`, `admin`, `sources` come from the actual `Evidence` object (`state: checked|unavailable|skipped`, with `source_date`, `licence`). `admin.state` only from boundary data or `null`. No literal `0.85`. | Test: with all sources stubbed unavailable, response lists them `unavailable`, `observed_feature_share == 0`, `admin.state is None`. |
| **M18** | **Feature-vector honesty (A7).** Remove invented `_std/_max/_min`; remove silent defaults. Missing ⇒ `None/NaN` + `quality:"missing"`. If a model cannot accept NaN, impute **inside the model wrapper only**, and list `imputed_features[]` in the response; `observed_feature_share` = real share. Classifier/engine must treat missing as `unknown`, never as 0/2.0/default. | `test_no_default_leak.py`: all-missing profile ⇒ `observed_feature_share==0`, land class `UNKNOWN`/irrigability `UNVERIFIED`. `grep -n "13\.32\|75\.75\|320\.0\|, 0\.5)" backend/app/services/features` → no matches. |
| **M19** | **Rewrite `user_document.py` (A8).** (a) Accept PDF/JPG/PNG/TXT; PDF → `pypdf` text, image/scanned → optional OCR (`pytesseract`, off if not installed ⇒ `needs_ocr`), never decode binary as UTF-8. (b) Units: acres, guntas (40 guntas = 1 acre ⚠ verify), hectares → `recorded_extent_ha`. (c) **No default class**: unmatched term ⇒ `UNKNOWN` + `unmapped_record_term`. (d) Word-boundary regex (`\bwell\b`, `\bborewell\b`). (e) Token = `sha256(content)[:16]` + random session id. (f) Store is **per session** with TTL (`UPLOAD_RETENTION_SECONDS`, default 0 = delete after response), never process-global. (g) Return `fields_found[]`, `parse_confidence`, and require user confirmation before the record is used. | `test_landrecords_privacy.py`: PII fixture (owner, father name, Aadhaar-like, phone, PAN) ⇒ none survives in response/log/store. `test_user_document_units.py`: "2 acres 20 guntas" ⇒ 0.9713 ha ±0.001. Cross-session test: session B cannot read session A record. PDF fixture parses. |
| **M20** | **Config cleanup (A10).** Delete `LAND_RECORDS_MOCK_FALLBACK`, delete guessed `KSRSAC_REST_ENDPOINT`; keep `KSRSAC_API_BASE_URL` / `KSRSAC_API_KEY` (empty by default) read via `get_settings()`. Add detection settings (§5A.7). Update `.env.example`, `docker-compose.yml`, `render.yaml`, `vercel.json`. | App boots from `.env.example` only; `grep -rn "ksrsac.karnataka.gov.in/geoserver" backend` → none. |
| **M21** | **Tests that do not mock the thing under test (A4).** Add end-to-end gating tests that stub only the **network/raster readers** (evidence) — never `LandClassifier.classify`. Add regression `test_no_coordinate_defaults_to_agricultural`. | See §14.1 matrix; CI fails if any gating test patches `classify` (a meta-test greps for `patch(".*LandClassifier.classify")` in `tests/`). |
| **M22** | **Port + extend donor tests** (`test_area_check.py` → `test_detection_*.py`); keep them offline. | ≥ 25 detection tests, all offline, green. |
| **M23** | **Frontend.** (a) Detection panel: Forest / Buildings / Roads / Water / Terrain rows with state (`detected / not detected / unknown`), share, basis, source; (b) fix label `replace(/_/g,' ')`; (c) gate demo presets with `VITE_DEMO_MODE` (FR-21); (d) polygon draw/import (FR-1, FR-14); (e) "partly checked" notice (from donor) driven by `detection.warnings`; (f) show `gate_mode` (`enforce|shadow|off`) and a visible "SHADOW MODE — verdict not enforced" strip when not enforcing. | `npm run build` green; checklist §11 (+ rows 9–12) passes. |
| **M24** | **Docs.** `CHANGELOG.md` entry for every v2.0 + v2.1 change (A13); `README.md` detection section (adapted from donor, thresholds from YAML), licences/attributions; regenerate `documentation/api_reference.md`; `SOURCE.md` for WorldCover tiles, Copernicus DEM, OpenFreeMap, Bhuvan WMS, Hansen, protected areas. | Files exist; every `SOURCE.md` has URL/licence/date/limits. |
| **M25** | **Dependencies.** Add `mapbox-vector-tile>=2.0.0`, `requests` (or use `httpx` consistently), `pypdf`, optional `pytesseract`; use `SQLAlchemy[asyncio]`; pin versions; Dockerfile uses a rasterio wheel with HTTP/`/vsicurl/` support. Add `scripts/verify.sh` (pytest + build + grep gates). | `pip install -r backend/requirements.txt` clean; `scripts/verify.sh` exit 0. |
| **M26** | **Error handling (A11).** Replace blanket `except → HTTP 500 str(e)` and `traceback.print_exc()` with `logging` + typed errors (400 invalid geometry, 422 schema, 502 upstream, 500 generic message with `request_id`). | Test: forced evidence exception ⇒ 200 with `UNVERIFIED` + warning (not 500); invalid polygon ⇒ 400. |
| **M27** | **Rollback scaffolding (§19).** `git init`, baseline tag, step tags, flags `LAND_DETECTION_MODE`, `LAND_GATE_MODE`, backup zip + checksums, `scripts/rollback_drill.sh`. | Drill (§19.6) executed once and logged in `CHANGELOG.md`. |
| **M28** | **Latency/resilience (D6/D7).** Per-source timeout, total budget, circuit breaker, TTL cache with deep copies, structured logs of source latency/failure. | `test_detection_budget.py`: slow stubs ⇒ result ≤ 8 s with warnings. |
| **M29** | **UNVERIFIED path (A9).** Classifier and engine must be able to return `UNKNOWN` / `UNVERIFIED`. Remote-sensing-only `NOT_IRRIGABLE_PROVISIONAL` requires ≥ 2 independent sources agreeing (e.g., WorldCover + OSM/MS-buildings for urban; WorldCover + Hansen/DW for forest); a single source ⇒ `UNVERIFIED` with reason `single_source_only`. Implement the water-access check of §7.3 or report `water_access: unknown`. | Tests for both. |
| **M30** | **Attribution & licence strings** shown in UI/PDF for every active layer: OSM ODbL, OpenFreeMap, ESA WorldCover (CC BY 4.0), Copernicus DEM, Microsoft Buildings (CDLA-Permissive-2.0), Hansen/UMD, WDPA, Bhuvan/NRSC. | UI attribution control lists active layers; PDF includes them. |

---

## 4. Users and flows
| Persona | Need |
|---|---|
| Farmer / FPO advisor | "I have survey no. X (or this GPS pin). Is it farmable and irrigable?" |
| Extension officer | Evidence-backed land class + records summary + irrigation feasibility. |
| Student / reviewer | Reproducible, honest, documented data pipeline. |

Flow: **enquire** (pin / polygon / survey no. / upload RTC or e-Khata) → **land class + records** → **irrigability verdict** → *(only if irrigable/conditional)* crops, yield, water need, risk → **PDF with provenance**.

---

## 5. Land-class classification (new core)

### 5.1 Classes
| Class code | Meaning | Typical evidence |
|---|---|---|
| `AGRICULTURAL` | Cropland / fallow cropland / orchards & plantations | RTC land type, WorldCover 40, DW crops (time series), FtW-calibrated rules |
| `FOREST_LEGAL` | Reserved / protected / notified forest | **Official** forest boundary or protected-area polygon (WDPA, KSRSAC Karnataka protected areas) |
| `FOREST_COVER` | Dense tree cover *without* legal confirmation | WorldCover 10, Hansen `treecover2000` ≥ T_tree **and** no plantation signature |
| `WASTELAND` | Barren/rocky, scrub, gullied, salt-affected, sandy, waterlogged, degraded land (NRSC Wastelands Atlas categories) | Bhuvan wasteland WMS, WorldCover 60/20/30 + DW bare, slope, soil (salinity proxies), RTC "kharab/gomala/…" classes |
| `URBAN_BUILT` | Built-up / urban / settlement / industrial | WorldCover 50, DW built, MS/OSM buildings, GHSL, e-Khata present, OSM `landuse=residential/commercial/industrial` |
| `WATER_BODY` | Lake, tank, reservoir, river channel | HydroLAKES, JRC GSW occurrence, WorldCover 80, DW water, OSM `natural=water` |
| `UNKNOWN` | Evidence missing/conflicting | — |

A plot may be **mixed**: output per-class **area shares** (`class_shares`) and a dominant class. Union exclusions first to avoid double counting.

### 5.2 Hard rules
- **Tree cover ≠ legal forest.** In Karnataka, coffee/areca/coconut/rubber plantations (Western Ghats, coast, Malnad) look like tree cover. `FOREST_COVER` requires no plantation signature (regular row spacing/ phenology via DW/NDVI seasonality, RTC land type = plantation, or `AGRICULTURAL` records). Otherwise → `UNKNOWN` + reason `tree_cover_may_be_plantation`.
- **No arbitrary buffers** around forest/water/buildings unless an official rule with a citation is supplied.
- **Bare ≠ wasteland.** Harvested/fallow fields are bare for months. Use ≥12-month crop-probability time series (DW `crops` p90) and historical cropland (WorldCover 2020/2021, FtW fields) before assigning `WASTELAND`.
- **Urban vs agricultural conflict:** e-Khata/e-Swathu present or ≥ T_urban built share ⇒ `URBAN_BUILT` dominates unless an RTC shows the plot as agricultural *and* built share is small (farmhouse). Footprint area only is subtracted (a farmhouse ≠ whole-plot rejection).
- Precedence on conflict: **official record > official layer > multi-source remote-sensing consensus > single-source remote sensing**. Each decision lists the sources it used.

### 5.3 Wasteland sub-classes (reason codes)
Initial list from the NRSC Wastelands Atlas categories (NRSC mapped 28 wasteland classes at 1:50,000 for 2003-04/2005-06 — **exact class legend must be confirmed from the Bhuvan Wastelands layer legend**, ⚠ not enumerated on the page checked):
`gullied_ravinous`, `land_with_scrub`, `land_without_scrub`, `waterlogged_marshy`, `salt_affected`, `shifting_cultivation`, `degraded_notified_forest`, `degraded_pasture`, `degraded_plantation`, `sandy_area`, `mining_industrial_waste`, `barren_rocky`, `steep_sloping`, `snow_glacial`.
Remote-sensing proxies (all thresholds in `land_class_rules.yaml`, calibrated per §14.3): bare-soil fraction (WorldCover 60, DW `bare`), low NDVI p90 over 12 months, slope (SRTM) and rock/stone indicators, SoilGrids texture/pH/EC proxies (salinity is *not* directly available → flag `salinity_unknown`), JRC GSW seasonality for waterlogging.

### 5.4 Reclaimability note
Wasteland output includes `reclaimable: "possible" | "unlikely" | "unknown"` (e.g., scrub/ degraded pasture often reclaimable; barren rocky, snow/glacial, steep slopes unlikely). It is informational and never makes the verdict "irrigable".

---

## 5A. Forest & building detection (ported from the donor, redesigned) — new in v2.1

### 5A.1 Purpose
Give the classifier **measured evidence** about forest, buildings, roads, water and terrain for the exact plot (or the area around a pin), with per-feature `state ∈ detected | not_detected | unknown`, share/area, basis and source — so §5 classes and §7 verdicts are derived from data, not literals.

### 5A.2 Evidence sources (local-first, then remote; all key-less)
| Evidence | Primary (local, `raw/external/…`) | Remote fallback | Notes |
|---|---|---|---|
| Land cover (tree 10, built 50, bare 60, water 80, wetland 90…) | `geo/worldcover_2021/*.tif` | `/vsicurl/https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_{tile}_Map.tif` (as in donor) | CC BY 4.0; ≈ 77 % overall accuracy → evidence, not proof |
| Buildings | `geo/buildings_ms/*` (Karnataka quadkeys), OSM extract | OpenFreeMap vector tiles `building` layer (zoom 14) → Overpass backup | CDLA-Permissive-2.0 / ODbL |
| Roads / rail / runways | OSM extract | OpenFreeMap `transportation`, `aeroway` layers | farm tracks/paths ignored (donor logic kept) |
| Forest cover | WorldCover 10, Hansen `treecover2000` (GEE/COG), Dynamic World `trees` | OpenFreeMap `landcover=wood` | physical cover only |
| Legal forest / protected | WDPA (non-commercial), Karnataka Protected Areas KML (⚠), KSRSAC forest layer when granted | OpenFreeMap `park` (national_park / nature_reserve / protected_area) — **unverified, OSM** | legal only from non-OSM sources |
| Water | HydroLAKES, JRC GSW, WorldCover 80, DW water | OpenFreeMap `water` | |
| Terrain | local DEM/slope COG | Copernicus DEM GLO-30 COG (`copernicus-dem-30m` bucket, as in donor ⚠ licence/terms to confirm) | |
`Evidence` records, per source: `state (checked|unavailable|skipped)`, `source`, `source_date`, `licence`, `latency_ms`, `warning`.

### 5A.3 Rules (all in `land_class_rules.yaml → detection:`; initial values are guesses to be calibrated, §14.3)
```yaml
detection:
  point_only_acres: 0.7          # circle used only when no polygon (donor default)
  legacy_strict: false           # true = any built-up pixel/road in the circle blocks (donor behaviour)
  min_independent_sources: 2     # for provisional remote-sensing-only verdicts
  forest:
    cover_share_min: 0.50        # WorldCover 10 and/or Hansen treecover >= hansen_min within the plot
    hansen_treecover_min_pct: 60
    plantation_guard: true
  buildings:
    urban_dominant_share_min: 0.30   # built share of plot -> URBAN_BUILT
    farmhouse_max_share: 0.05        # below this: subtract footprint, stay AGRICULTURAL
  roads:
    deduct_lines: false              # roads reported; area deducted only from polygon evidence
    assumed_half_width_m: {}         # opt-in per class, flagged `assumed`
  water:
    share_min: 0.35
  terrain:
    report_only: true                # verdict thresholds live in irrigability_rules.yaml
    slope_window_m_min: 90
  timeouts:
    per_source_s: 6
    total_budget_s: 8
  cache_ttl_s: 86400
```

### 5A.4 Mapping to classes
| Detection result | Class | Notes |
|---|---|---|
| `forest.kind=legal` (WDPA / forest boundary / protected polygon from a non-OSM source) | `FOREST_LEGAL` | `NOT_IRRIGABLE` |
| `forest.kind=cover`, share ≥ `cover_share_min`, **no plantation signature** | `FOREST_COVER` | `NOT_IRRIGABLE_PROVISIONAL` (needs ≥ 2 sources) |
| tree cover high **with** plantation signature (RTC says plantation, regular row/phenology signal, or inside known plantation zone *and* an RTC/user confirmation) | `AGRICULTURAL` subclass `agroforestry_plantation` (or `UNKNOWN` + `tree_cover_may_be_plantation`) | A lat/lon box alone is **not** a plantation signature |
| `buildings.share ≥ urban_dominant_share_min` (or built-up share) | `URBAN_BUILT` | `NOT_IRRIGABLE` with official/e-Khata evidence, else provisional |
| `buildings.share < farmhouse_max_share` | `AGRICULTURAL` with `footprint_ha` deducted | farm + farmhouse stays assessable |
| water share ≥ `water.share_min` | `WATER_BODY` | |
| bare/rocky + slope metric | `WASTELAND` subclass per §5.3 | thresholds from `irrigability_rules.yaml`/`land_class_rules.yaml` |
| required sources unavailable | `UNKNOWN` | never "clear" (D5) |

### 5A.5 Response block (added to `FullReportResponse` and `LandInquiryResponse`)
```json
"detection": {
  "mode": "enforce",
  "geometry_basis": "polygon",
  "forest":    {"state": "detected", "kind": "cover", "share": 0.62,
                "basis": ["worldcover:10=0.58", "hansen:treecover>=60=0.66"],
                "plantation_signature": false, "legal_status": "unverified"},
  "buildings": {"state": "detected", "share": 0.04, "footprint_ha": 0.03, "count": 2,
                "basis": ["ms_buildings", "osm:building"]},
  "roads":     {"state": "not_detected", "basis": ["osm:transportation"]},
  "water":     {"state": "unknown", "basis": [], "reason": "worldcover_unavailable"},
  "terrain":   {"state": "checked", "mean_slope_deg": 6.1, "max_elevation_m": 812, "source": "copernicus_dem_glo30"},
  "sources":   [{"name": "esa_worldcover_2021", "state": "checked", "source_date": "2021", "licence": "CC BY 4.0", "latency_ms": 420}],
  "warnings":  ["OpenStreetMap tiles unavailable (Timeout); buildings from local layer only"]
}
```
Deprecated alias for one release: `area_check` (old donor shape) is derived from `detection` so the donor UI keeps working during migration.

### 5A.6 Detection test matrix (offline; stub readers, never the classifier)
| Case | Expected |
|---|---|
| 100 % WorldCover 40 | forest/buildings `not_detected` → `AGRICULTURAL` |
| 1 built pixel (farmhouse) in a 1 ha polygon | `buildings.state=detected`, share < 0.05, **AGRICULTURAL**, footprint deducted; with `legacy_strict=true` + point-only ⇒ blocked |
| 40 % built | `URBAN_BUILT` |
| 70 % tree, no plantation signature, no legal layer | `FOREST_COVER` → `NOT_IRRIGABLE_PROVISIONAL` |
| 70 % tree + RTC says plantation / areca | `AGRICULTURAL` (not forest) |
| tree cover only from OSM `landcover=wood` (single source) | `UNVERIFIED` (`single_source_only`) |
| polygon inside WDPA polygon | `FOREST_LEGAL` → `NOT_IRRIGABLE` |
| OSM `park=national_park` only | `forest.legal_status="unverified"`; not `FOREST_LEGAL` |
| only DEM answers | `UNVERIFIED` (D5), **not** "clear" |
| WorldCover 404 tile | open water (sea), as donor |
| farm track / footpath near plot | ignored |
| tiles down → Overpass fallback; both down | warnings, partial, no crash |
| slow sources (stubs sleep 20 s) | total ≤ 8 s, warnings |
| cached result mutated by caller | cache unaffected (deep copy) |
| point-only | circle `AREA_CHECK_ACRES`; `area_ha=null` |
| polygon spanning two WorldCover tiles | mosaic correct shares |

### 5A.7 Settings (`backend/.env.example`)
```
LAND_DETECTION_MODE=shadow        # off | shadow | enforce   (see §19)
LAND_GATE_MODE=shadow             # off | shadow | enforce
AREA_CHECK_ACRES=0.7
OPENFREEMAP_TILEJSON=https://tiles.openfreemap.org/planet
OVERPASS_URL=https://overpass-api.de/api/interpreter
DETECTION_PER_SOURCE_TIMEOUT_S=6
DETECTION_TOTAL_BUDGET_S=8
DETECTION_CACHE_TTL_S=86400
```
Start in **shadow** (computed, returned, logged, not enforced); switch to **enforce** only after §14.3 calibration meets the metrics in §14.4.

---

## 6. Land-record enquiry layer (new)

### 6.1 Reality check (verified during research — be honest in the UI/README)
| Source | Finding | Consequence |
|---|---|---|
| **Bhoomi / RTC** (`landrecords.karnataka.gov.in`) | Citizen portal, per-record, no public API/key found; automated fetch blocked. | **No key to obtain.** Use user-uploaded RTC or an official data-sharing arrangement. |
| **e-Khata / e-Swathu** | Property (urban/gram panchayat) records held by local bodies; no public API documented; third-party sites (e.g., Landeed) are private, non-government. | Presence of an e-Khata/e-Swathu = strong **urban/non-agricultural property** signal. Accept user-uploaded copy only. |
| **ULPIN / Bhu-Aadhaar** (14-digit parcel ID from vertex coordinates; DoLR concept note) | Karnataka listed as **pilot** (as of Mar 2023 note); DoLR lists OGC-compliant APIs as an *objective*, not a launched public service; raw ID reveals location, public form is a mapped number. | Treat ULPIN as an optional identifier field; no public lookup. Re-check status periodically. |
| **Dishaank** (NeGD) | Mobile app, no API documented. | Manual verification aid only. |
| **K-GIS / KSRSAC** | Layers exist (cadastral/village/forest/600+ thematic); "map/web services for external use" mentioned but no public API docs. | **Official request** to `ksrsac-gok@karnataka.gov.in` (Phase 7). |
| **Bhuvan** | WMS access for thematic layers (LULC, **Wasteland**, Urban Land Use, Water Bodies, Salt-affected & waterlogged, Erosion, Flood). Page says *APIs are "being developed"*. No licence text found. | Use WMS for **display/validation**; bulk reuse unconfirmed. No token documented. |
| **Other Indian states** | Public portals are per-record; no free bulk APIs (pages for UP Bhulekh and Bengal Banglarbhumi say the same). | Same provider pattern per state later. |
| **Third-party aggregators** | Some commercial providers offer land-record APIs under agreements; terms/price unverified. | Optional adapter; only with a signed contract and legal review. |

> **There is no free public "Bhoomi/e-Khata API key" to plug in.** The product therefore supports four lawful routes, in this priority: (1) official data-sharing credentials (when granted), (2) user-supplied record documents, (3) documented WMS/open datasets, (4) coordinate-based remote-sensing inference. The UI always states which route produced each fact.

### 6.2 Provider interface
`backend/app/services/landrecords/base.py`
```python
class LandRecordProvider(Protocol):
    name: str
    async def available(self) -> ProviderStatus            # ready | unavailable(reason) | needs_credentials
    async def by_coordinate(self, lon: float, lat: float) -> RecordResult | None
    async def by_reference(self, ref: SurveyRef) -> RecordResult | None   # district/taluk/hobli/village/survey/hissa or khata/property id
```
`RecordResult` = `{parcel_id, ulpin?, admin{state,district,taluk,hobli,village}, survey_no?, hissa_no?, recorded_land_class?, recorded_use?, recorded_extent_ha?, irrigation_source?, geometry?, boundary_source, source_name, source_date, verification: official|user_provided|unverified}`. **No owner fields exist in the type.**

### 6.3 Adapters to implement
| Adapter | Status at v2 | Behaviour |
|---|---|---|
| `user_document` | **Implement fully** | Upload RTC/Pahani PDF/photo, e-Khata/e-Swathu extract, or enter fields manually. Parse (pdf text → OCR fallback), extract survey/hissa, village, extent, **land type**, irrigation source, khata type (A/B/e-Swathu). Mark `verification: user_provided`. Never "official". |
| `ksrsac_official` | Stub + config | Reads `KSRSAC_API_BASE_URL` + `KSRSAC_API_KEY` (or mTLS/OAuth as the MoU specifies). If unset ⇒ `needs_credentials`. Implement against the written API spec when received; no guessing endpoints. |
| `bhuvan_wms` | Implement | OWSLib `GetFeatureInfo`/`GetMap` against documented Bhuvan WMS endpoints to *sample* LULC/Wasteland/Urban/Water at a coordinate for **validation/display**; tagged `reference_only`. Honour polite rate limits; cache. Confirm layer names in QGIS first (⚠). |
| `open_layers` | Implement | Local WorldCover, DW, GHSL, MS buildings, OSM, HydroLAKES/RIVERS, protected areas, Hansen, SRTM (§12). |
| `third_party_aggregator` | Interface only | Disabled by default; requires contract + legal sign-off. |
| `india_other_states/*`, `global/*` | Phase 8 | Same interface; see §6.6. |

### 6.4 Privacy and legality
- Parsers drop owner name, father/husband name, Aadhaar, phone, PAN, bank, address at the **parser layer** (allow-list of fields, not deny-list). Test `test_landrecords_privacy.py` feeds a fixture RTC containing PII and asserts none survives in DB, logs, or response.
- Uploaded documents are processed in memory/temp storage and deleted after parsing unless the user opts in to save; retention default 0.
- Cite legal basis in README: user-supplied documents about their own land; official data under written agreement; open data under stated licences.

### 6.5 Record → land-class mapping (`land_record_class_map.yaml`)
Maps recorded Karnataka classifications to GeoAgri classes. **Initial entries come from prior knowledge and must be validated with a Karnataka revenue-record source or KSRSAC before release (⚠):**
| Recorded term (RTC / revenue) | GeoAgri class |
|---|---|
| Bagayat / Neeravari / Jirayat / Khushki (garden / irrigated / dry cultivable) | `AGRICULTURAL` |
| Kharab (A/B: uncultivable/ non-assessed) | `WASTELAND` (if no other info) |
| Gomala / grazing / Gairan / Hullubanni | `WASTELAND` (grazing; `reclaimable: unlikely`) |
| Forest / Aranya / Reserved / Protected | `FOREST_LEGAL` |
| Non-agricultural (conversion order, N.A.) / Residential / Commercial / Industrial | `URBAN_BUILT` |
| Tank / Kere / Halla / Water | `WATER_BODY` |
| Unknown term | `UNKNOWN` + reason `unmapped_record_term` (never guess) |

### 6.6 Beyond Karnataka (Phase 8 — all ⚠ to verify before building)
Country adapters follow the same interface. Candidates (open/public): India — other state Bhulekh portals (per-record); USA — USDA Cropland Data Layer + SSURGO soils; EU — national LPIS/open parcel sets where published (e.g., Netherlands BRP, France RPG); Brazil — CAR/SICAR public downloads; global fallback — WorldCover, Dynamic World, Hansen, OSM landuse, GHSL, MS buildings, WDPA (non-commercial). Each adapter ships with `SOURCE.md`, licence, coverage bbox, and a reliability grade. Do **not** claim parcel-level coverage where only land-cover exists.

---

## 7. Irrigability engine (new)

### 7.1 Verdicts
| Verdict | Meaning | UI |
|---|---|---|
| `IRRIGABLE` | Land is agricultural and passes terrain/soil/water-access checks | Green; crop output allowed |
| `CONDITIONALLY_IRRIGABLE` | Agricultural but with limits (slope, texture, salinity unknown, water source far/unknown) | Amber; crop output allowed with limits listed |
| `NOT_IRRIGABLE` | Forest, urban/built-up, water body, wasteland, or hard terrain/soil limit | **Red banner "NOT IRRIGABLE"**; no crops |
| `NOT_IRRIGABLE_PROVISIONAL` | Same as above but based only on remote-sensing evidence (no official record) | Red-hatched banner + "provisional" |
| `UNVERIFIED` | Evidence missing/conflicting | Grey; no definitive verdict |

### 7.2 Decision order (stop at first hit)
1. `land_class ∈ {FOREST_LEGAL, URBAN_BUILT, WATER_BODY}` with official/record/multi-source evidence ⇒ `NOT_IRRIGABLE` (reason codes: `reserved_or_protected_forest`, `urban_built_up`, `water_body`).
2. `land_class == WASTELAND` ⇒ `NOT_IRRIGABLE` (reason `wasteland:<subclass>`) with `reclaimable` note.
3. `land_class == FOREST_COVER` (physical only) ⇒ `NOT_IRRIGABLE_PROVISIONAL`.
4. Same classes from remote sensing alone ⇒ `NOT_IRRIGABLE_PROVISIONAL`.
5. `AGRICULTURAL` ⇒ evaluate **terrain, soil, water access** (§7.3). Hard limit ⇒ `NOT_IRRIGABLE`; soft limits ⇒ `CONDITIONALLY_IRRIGABLE`; none ⇒ `IRRIGABLE`.
6. Otherwise `UNVERIFIED`.
For mixed plots, compute `irrigable_area_ha = A_parcel − area(union(non-irrigable classes) ∩ parcel) − area(hard-limit zones)` and report both the dominant verdict and the usable area.

### 7.3 Checks for agricultural land (`irrigability_rules.yaml`)
Thresholds are **initial, configurable and must be calibrated** — modelled on FAO land-irrigability practice (slope, soil texture/depth, drainage, salinity, water availability); do not present as validated.
| Check | Data | Initial rule (tunable) |
|---|---|---|
| Slope | SRTM/Cop-DEM | > `T_slope_hard` ⇒ hard limit for surface irrigation; > `T_slope_soft` ⇒ drip/sprinkler only |
| Soil texture | SoilGrids clay/sand/silt | Very coarse (sand > T) or very heavy clay ⇒ soft limit (infiltration/drainage) |
| Salinity / sodicity | Not in SoilGrids; user soil test or Bhuvan "Salt affected & waterlogged" WMS | Unknown ⇒ soft limit `salinity_unknown`; Bhuvan hit ⇒ hard/soft per rules |
| Waterlogging | JRC GSW seasonality, Bhuvan layer | Persistent ⇒ limit |
| Water access | Distance to HydroRIVERS/HydroLAKES/OSM canals; India-WRIS command areas when verified (⚠); recorded irrigation source from RTC | None found ⇒ `rainfed_only` soft limit; never assume a well/canal |
| Rainfall adequacy | NASA POWER / Open-Meteo climatology | Informational for irrigation need (Model C) |
Output includes `irrigation_options: ["canal","well/borewell","tank","drip","sprinkler","rainfed_only"]` as **possible**, each with the evidence that supports it, and `water_source_evidence[]`.

### 7.4 Model C relationship
Model C (irrigation need) runs **only** for `IRRIGABLE` / `CONDITIONALLY_IRRIGABLE`. For other verdicts the response says why irrigation is not applicable instead of returning a number.

---

## 8. Credentials and environment variables (exactly what needs a key)
| Credential | Needed for | Cost | Notes |
|---|---|---|---|
| **GEE project** (`GEE_PROJECT_ID`, optional service account) | Dynamic World, JRC GSW, Hansen, SRTM, Sentinel-2 | Free noncommercial tier | Not an API key; confirm service-account use for your tier. Commercial use needs a licence. |
| **KSRSAC / Karnataka official data-sharing** (`KSRSAC_API_BASE_URL`, `KSRSAC_API_KEY`) | Official parcels, forest, village boundaries, records | Government process | **Does not exist until granted.** Leave blank; adapter reports `needs_credentials`. |
| **data.gov.in API key** | APY yields, Soil Health Card resources | Free | Register on portal. |
| **CDSE OAuth client** | Sentinel backup | Free | |
| **WDPA token** | Only if using WDPA API (bulk download needs none) | Free, non-commercial | |
| **Global Forest Watch API key** (optional) | GFW Data API (alternative to Hansen via GEE) | Free (⚠ confirm flow) | Hansen via GEE needs no extra key. |
| **Bhuvan** | WMS display/validation | None found | No token documented; confirm terms before bulk use. |
Key-less: NASA POWER, Open-Meteo, ESA WorldCover (S3), MS Buildings, GHSL, HydroLAKES/RIVERS, SoilGrids files, FAOSTAT, GAEZ, OSM.

`backend/.env.example` additions (delete `SOILGRIDS_API_URL`):
```
# --- land records
LAND_RECORD_PROVIDERS=user_document,open_layers,bhuvan_wms   # add ksrsac_official after approval
KSRSAC_API_BASE_URL=
KSRSAC_API_KEY=
BHUVAN_WMS_BASE=https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms
BHUVAN_LULC250K_WMS=https://bhuvan-ras2.nrsc.gov.in/cgi-bin/LULC250K.exe
UPLOAD_MAX_MB=10
UPLOAD_RETENTION_SECONDS=0
GFW_API_KEY=
# --- classification
LAND_CLASS_RULES=backend/app/rules/land_class_rules.yaml
IRRIGABILITY_RULES=backend/app/rules/irrigability_rules.yaml
LAND_RECORD_CLASS_MAP=backend/app/rules/land_record_class_map.yaml
```
Frontend: `VITE_API_BASE_URL`, `VITE_MAP_STYLE_URL`, `VITE_DEMO_MODE=false`.

---

## 9. Functional requirements

### 9.1 Geometry
- **FR-1** Draw polygon, import GeoJSON/KML/zipped SHP, or pick an official parcel (when an official layer exists).
- **FR-2** `boundary_source ∈ official_cadastral | user_imported | user_drawn | point_only`; persist and display.
- **FR-3** Validate/repair geometry (`make_valid`), limits on area/vertices; geodesic area (WGS84); local UTM for overlay math (EPSG:32643 for Karnataka).
- **FR-4** A point never produces an area (M1).

### 9.2 Coordinate enquiry (the "use coordinates + key to enquire land details" requirement)
- **FR-5** `GET /api/v1/land/inquiry?lat=&lon=` and `POST` with geometry. Steps: (a) resolve admin hierarchy from local boundaries (state/district/taluk/village when available); (b) sample all open layers at the point (or aggregate over polygon); (c) query every enabled provider `by_coordinate`; (d) classify land (§5); (e) irrigability (§7); (f) return a provenance table. Providers needing credentials that are not configured report `needs_credentials`.
- **FR-6** Optional reference lookup: `district/taluk/hobli/village/survey_no/hissa_no` or `khata/property id` → provider `by_reference`; user-declared values are `user_declared` until a provider verifies them.
- **FR-7** Document upload: `POST /api/v1/land/records/upload` (PDF/JPG/PNG ≤ `UPLOAD_MAX_MB`) → parsed fields, user confirms/edits before they are used.

### 9.3 Classification & gate
- **FR-8** Every response carries `land_class`, `class_shares`, `irrigability`, `reasons[]`, `sources[]`, `confidence`, `data_quality`.
- **FR-9** Missing layer ⇒ `unknown` + reason (never "clear").
- **FR-10** `NOT_IRRIGABLE*` or `UNVERIFIED` ⇒ no crop list (optional opt-in low-confidence exploratory list for `UNVERIFIED` only, clearly labelled).
- **FR-11** Environmental profile built from the eligible sub-polygon only.
- **FR-12** 78-feature vector carries `{value, source, observed_at, quality: observed|derived|estimated|user_provided|missing}`; models receive `NaN` for missing.

### 9.4 UI
- **FR-13** Red **NOT IRRIGABLE** banner (plus provisional variant), class badge, reasons list, usable-area figure, "why" tooltips per layer, and "what would verify this" hints (e.g., upload RTC, request KSRSAC access).
- **FR-14** Map: basemap switch (OSM/satellite/terrain), polygon tools, import, layer toggles (land cover, forest/protected, water, buildings, wasteland WMS, eligible area), legend with accessible colours, attribution control per active layer.
- **FR-15** Land-record panel: provider status chips (ready / needs credentials / unavailable), parsed record fields (no PII), verification level.
- **FR-16** Persistent disclaimer: "Decision-support only. Not a legal land record, conversion certificate or survey."
- **FR-17** PDF report includes classification, irrigability, record summary, provenance table, attributions, disclaimer.

### 9.5 Platform
- **FR-18** `GET /api/v1/map-layers`, `GET /api/v1/health` (per provider/layer status), TTL caches (weather 24 h, land cover 30 d, static layers until re-ingest), polite rate limits (Nominatim ≤ 1 req/s, Bhuvan modest, cache all), circuit breaker per source.

---

## 10. API contracts

### 10.1 Endpoints
`POST /api/v1/land/inquiry` · `GET /api/v1/land/inquiry?lat&lon` · `POST /api/v1/land/records/upload` · `GET /api/v1/land/providers` · `POST /api/v1/parcels/validate|import` · `GET /api/v1/map-layers` · `GET /api/v1/health` · `POST /api/v1/predict/full-report` (adds gating + blocks below).

### 10.2 Land inquiry response
(v2.1: the response also carries the `detection` block of §5A.5 and `gate_mode`; `layers[]`, `data_quality` and `admin` must be derived from real evidence per M17.)
```json
{
  "query": {"lon": 75.75, "lat": 13.32, "boundary_source": "point_only", "area_ha": null},
  "admin": {"state": "Karnataka", "district": null, "taluk": null, "village": null, "source": "kgis_admin_boundaries|unavailable"},
  "land_class": {
    "dominant": "WASTELAND",
    "class_shares": {"WASTELAND": 0.82, "AGRICULTURAL": 0.10, "URBAN_BUILT": 0.08},
    "subclass": "barren_rocky",
    "legal_forest_status": "unknown",
    "confidence": 0.71
  },
  "irrigability": {
    "verdict": "NOT_IRRIGABLE_PROVISIONAL",
    "reasons": [
      {"code": "wasteland:barren_rocky", "evidence": ["worldcover_2021:class60=0.78", "srtm_slope_pct=21"], "source_date": "2021"},
      {"code": "no_official_record", "evidence": []}
    ],
    "reclaimable": "unlikely",
    "irrigable_area_ha": null,
    "irrigation_options": [],
    "crop_models": "skipped_not_irrigable"
  },
  "land_records": {
    "providers": [
      {"name": "user_document", "state": "no_document"},
      {"name": "ksrsac_official", "state": "needs_credentials"},
      {"name": "bhuvan_wms", "state": "checked", "reference_only": true, "lulc": "…"}
    ],
    "record": null
  },
  "layers": [{"name": "worldcover_2021", "state": "checked", "licence": "CC BY 4.0", "source_date": "2021"}],
  "data_quality": {"observed_feature_share": 0.0, "notes": []},
  "disclaimer": "Decision-support only. Not a legal land record or survey.",
  "assessment_timestamp": "ISO-8601"
}
```
`null`, `"unknown"` and `needs_credentials` are valid, intentional values.

### 10.3 Parcel table (PostGIS `parcels`)
`parcel_id, country, state, district, taluk, hobli, village_code, survey_number, subdivision_number, ulpin (nullable), geometry(Polygon,4326), recorded_area_ha, recorded_land_class, class_geoagri, source_name, source_date, verification (official|user_provided|unverified)`. **No owner fields.**

---

## 11. Frontend acceptance checklist
1. Click a lake ⇒ red banner "NOT IRRIGABLE — Water body", no crop UI.
2. Draw polygon on dense Bengaluru block ⇒ "NOT IRRIGABLE — Urban / built-up", e-Khata hint shown.
3. Polygon inside a protected area (layer loaded) ⇒ "NOT IRRIGABLE — Reserved/protected forest".
4. Barren/rocky hill ⇒ "NOT IRRIGABLE (provisional) — Wasteland: barren rocky" + reclaimable note.
5. Farm plot with farmhouse ⇒ amber/green with usable area reduced by building footprint.
6. Pin only ⇒ classification shown, area "—", no invented size.
7. Provider with no credentials ⇒ chip "needs credentials", never fake data.
8. Upload sample RTC (PDF **and** text) ⇒ parsed fields editable, PII absent, badge "user-provided", acres/guntas converted.
9. Pin in dense forest (no protected layer) ⇒ "NOT IRRIGABLE (provisional) — Forest cover" with detection row Forest = detected, kind = cover, basis listed; **coffee/areca plantation fixture ⇒ not forest**.
10. Plot containing buildings ⇒ detection row Buildings = detected, share %, footprint ha; usable area reduced; if share ≥ urban threshold ⇒ "NOT IRRIGABLE — Urban / built-up".
11. Source down ⇒ row shows `unknown` + warning chip ("partly checked"), never a green tick; label reads `NOT IRRIGABLE_PROVISIONAL` fixed to "NOT IRRIGABLE PROVISIONAL".
12. `LAND_GATE_MODE=shadow` ⇒ "SHADOW MODE — verdict not enforced" strip; `off` ⇒ no banner; `enforce` ⇒ crops hidden for non-irrigable.

---

## 12. Data requirements (downloads → `backend/ml/data/raw/external/…`)
All v1 sources remain (see `DATA_GUIDE.md`): WorldCover 2021, HydroLAKES/RIVERS, MS buildings, GHSL, OSM Karnataka, FtW India, FAOSTAT, SoilGrids, GAEZ, ECOCROP, NASA POWER, Open-Meteo. Run:
```
python backend/ml/data/scripts/download_datasets.py --all
```
**New in v2 (add to script / DATA_GUIDE; each with SOURCE.md):**
| Dataset | Use | Access | Status |
|---|---|---|---|
| Hansen Global Forest Change (`treecover2000`, loss/gain) | Physical forest cover | GEE (`UMD/hansen/global_forest_change_*`; the 2015_v1_3 ID was confirmed, use the latest version in the GEE catalogue) | ⚠ licence/version to confirm |
| Karnataka Protected Areas 2022 (KML, source KSRSAC, listed "Public Domain" on OpenCity) | Interim protected-forest polygons | `data.opencity.in` resource page (page showed no direct file link — download via the portal UI) | ⚠ completeness/authority unverified; **not** the legal Reserved Forest layer |
| WDPA / Protected Planet | Global protected areas | Bulk download (non-commercial) | v1 |
| Bhuvan thematic WMS: LULC 50K/250K, **Wastelands**, Urban Land Use, Water Bodies, Salt Affected & Waterlogged, Erosion, Flood | Wasteland/urban/water *validation* and display | Documented WMS endpoints; confirm layer names in QGIS | ⚠ terms/layer names unverified |
| SRTM / Copernicus DEM → slope raster | Slope limits | GEE or local | v1 |
| NRSC Wastelands Atlas 2019 (report) | Class definitions, state statistics | Public document | reference |
| Soil Health Card nutrient stats | P/K priors | data.gov.in (API key) | ⚠ |

Folder additions: `geo/hansen/`, `geo/protected_areas_ka/`, `geo/bhuvan_wms_samples/`, `geo/slope/`, `processed/land_class_training/`.
Add large paths to `.gitignore`; commit only `SOURCE.md` + small samples.

---

## 13. Architecture
```
React + MapLibre ──► FastAPI
   ├─ landrecords/   providers: user_document · ksrsac_official · bhuvan_wms · open_layers · (states/countries)
   ├─ landclass/     class shares, subclass, forest-legal vs cover, wasteland subclasses
   ├─ irrigability/  verdict + usable area + irrigation options
   ├─ parcels/ · geo/ · weather/ · soil/ · features/
   └─ models A–E + fusion (existing, gated by landclass+irrigability)
PostGIS (vectors) · COG store (rasters) · cache (in-memory → Redis optional)
```
Routers added: `landinquiry.py`, `landrecords.py`, `parcels.py`, `layers.py`. Keep `main.py` structure. Vector layers served as GeoJSON for small extents only; never ship national datasets to the browser.

---

## 14. Testing and validation

### 14.1 Test matrix (pytest + small GeoJSON fixtures)
| Case | Expected |
|---|---|
| Polygon on HydroLAKES lake | `WATER_BODY` → `NOT_IRRIGABLE`, no crops |
| Dense Bengaluru block | `URBAN_BUILT` → `NOT_IRRIGABLE` |
| Polygon in protected area (layer loaded) | `FOREST_LEGAL` → `NOT_IRRIGABLE` |
| Dense tree cover, no legal layer | `FOREST_COVER` → `NOT_IRRIGABLE_PROVISIONAL` |
| Coffee/areca plantation (plantation signature or RTC) | **not** forest; `AGRICULTURAL` / `UNKNOWN` with reason |
| Barren rocky hill | `WASTELAND` / `barren_rocky` |
| Harvested/fallow cropland | `AGRICULTURAL` (not wasteland) |
| Farm + farmhouse | footprint subtracted, crops allowed |
| RTC says Kharab, remote sensing says crops | conflict reason; record wins as `user_provided`, verdict flagged "document vs imagery conflict" |
| e-Khata uploaded | `URBAN_BUILT` hint dominates; reason cites document |
| Point only | classification yes, `area_ha=null` |
| Provider without credentials | `needs_credentials`, no fake record |
| Invalid/self-intersecting polygon | repaired or rejected with message |
| PII in uploaded RTC | none survives anywhere |
| Overlapping exclusions | union area, no double subtraction, `A ≥ 0` |
| **No network, no record** (any coordinate) | `land_records.record is null`; class `UNKNOWN`; verdict `UNVERIFIED` — never `AGRICULTURAL` (A1–A3 regression) |
| Reference-only provider (Bhuvan/open layers) says "agricultural", imagery says lake | `WATER_BODY` (record override denied, M14) |
| Evidence stubs: 70 % tree, no plantation, no legal layer | `FOREST_COVER` → `NOT_IRRIGABLE_PROVISIONAL`; with `LAND_GATE_MODE=shadow` crops still returned + `gate_mode:"shadow"` |
| Evidence stubs: polygon inside WDPA polygon | `FOREST_LEGAL` → `NOT_IRRIGABLE`, crops `[]` |
| Evidence stubs: 1 farmhouse in 1 ha | `AGRICULTURAL`, footprint deducted |
| YAML threshold changed | verdict changes with no code edit |
| Provider/evidence exception | HTTP 200 with `UNVERIFIED` + warning, not 500 |

### 14.2 Existing tests: update `test_phase3…7`; keep `test_no_synthetic_leak.py` green.

### 14.3 Calibration
- Labelled set: FtW India polygons (cropland positives) + sampled non-crop (water/built/forest/bare) from OSM/MS/WorldCover/WDPA → tune `T_*`; report precision/recall per class in `documentation/result/land_class_validation.md`.
- Manual review of **≥ 50 Karnataka plots** on satellite imagery (agri, fallow, plantation, built, water, reserved-forest edge, barren rocky, scrub) — agreement target ≥ 90 % (stretch 95 %).

### 14.4 Acceptance metrics (confirm after calibration)
- 0 synthetic values; 0 constants matching §3 grep gates.
- Class agreement with manual set ≥ 90 %; **no plantation misclassified as forest** in the plantation subset ≥ 95 %.
- Detection on the labelled set (§20 S11, ≥ 100 points): forest recall ≥ 90 %, building-dominant recall ≥ 90 %, **plantation→forest false-positive rate ≤ 5 %**, farmland false-block rate ≤ 5 %. Report honestly if unmet and stay in `shadow`.
- p95 latency: land inquiry ≤ 5 s with local layers (≤ 8 s hard budget with remote fallback); full report ≤ 15 s.
- Yield model beats district-mean baseline under district-held-out CV (v1 metric).

---

## 15. Implementation plan (v2.0 phases — **superseded by the §20 runbook for ordering**)
| Phase | Work | Done when |
|---|---|---|
| **1** | M1–M3, M11: remove fabricated fallbacks, config cleanup | grep gates pass; tests green |
| **2** | M10: download all datasets, ingest to PostGIS/COG, `/map-layers` | every layer `ready` or `unavailable`+reason |
| **3** | M4 (landclass) + M8 rules + calibration scripts | §14.1 land-class rows pass |
| **4** | M4 (irrigability) + Model C gating | irrigability rows pass |
| **5** | M5 landrecords providers, upload parser, privacy tests | `test_landrecords_privacy.py` green |
| **6** | M6–M7 gate + schema + API docs | lake/urban/forest/wasteland return no crops |
| **7** | M9 frontend (banner, panels, import, layers) | §11 checklist passes |
| **8** | Retrain Models B & D (spatial CV), model cards (v1 §10) | beats baseline |
| **9 (parallel)** | KSRSAC written request; implement official adapter on receipt | `VERIFIED_AGRICULTURAL` reachable |
| **10** | Other states + countries (§6.6) | per-adapter SOURCE.md + tests |

---

## 16. Non-functional
Provenance on every value (source, date, quality) · privacy (no PII, no polygon logs without opt-in) · licences/attributions (OSM ODbL; WorldCover/Dynamic World/HydroLAKES/SoilGrids CC BY 4.0; MS CDLA-Permissive-2.0; JRC "EC JRC/Google"; GHSL acknowledgement; WDPA citation with release month/year; Hansen citation; KSRSAC/Bhuvan credit) · resilience (timeouts, retries, circuit breaker, cached-last-good with age) · security (upload type/size limits, malware-safe parsing, CORS) · observability (structured logs, per-source latency/failure counters).

---

## 17. Risks and unverified items
| Risk / item | Mitigation |
|---|---|
| **No public land-records API/key for Bhoomi, e-Khata/e-Swathu, ULPIN** | User-document route + KSRSAC request; UI says so plainly |
| Official forest/parcel layers unavailable | Max status provisional; Karnataka Protected Areas KML as interim, labelled non-legal |
| Plantations misread as forest | Plantation signature + record override + reason codes |
| Wasteland vs fallow confusion | 12-month time series + historical cropland |
| Salinity/sodicity not in open data | `salinity_unknown` soft limit; user soil test; Bhuvan layer |
| GEE quota / noncommercial terms | Cache, pre-export COGs, CDSE fallback |
| WDPA/GEE non-commercial | Keep project non-commercial or obtain permission |
| Detection thresholds (30 % built, 50 % tree, 60 % Hansen…) are guesses | Shadow mode + calibration (§20 S11); YAML-tunable |
| OpenFreeMap / Overpass availability and terms ⚠; Copernicus DEM bucket terms ⚠ | Local-first layers; self-host/Geofabrik extract for production; attribution |
| WorldCover 10 m is ≈ 77 % accurate; single built pixel ≠ building | Share-based rules, ≥ 2 independent sources for provisional verdicts |
| Plantation (coffee/areca/coconut) vs forest confusion | Plantation guard, RTC override, `UNKNOWN` when unsure |
| `pytest`/`npm run build` not executed during the v2.1 audit (sandbox had no PyPI/npm access) | S0 records real baseline results |
| ⚠ **Not verified in this research** | Bhuvan layer names/terms; Karnataka RTC/e-Khata field layouts and land-type vocabulary (§6.5); Hansen current version/licence; GFW API key flow; India-WRIS endpoint; OpenCity KML download path and completeness; third-party aggregator terms; country adapter datasets in §6.6; exact NRSC wasteland class legend |

---

## 18. Definition of done
1. Boots with real data only; `/health` shows real provider/layer state.
2. All **M1–M12** gates pass; no grep-gate hits.
3. Lake, urban, forest, wasteland cases return **NOT IRRIGABLE** with reasons and no crops; plantation and fallow cases are not misclassified.
4. Coordinate enquiry returns classification + provider statuses + provenance; credential-gated providers say so.
5. RTC/e-Khata upload works with PII stripped.
6. Models B & D retrained on documented data with spatial CV and model cards.
7. `DATA_GUIDE.md` reproduces the data folder on a clean machine; README documents licences, non-commercial limits, limitations and the disclaimer.
8. No secrets in git; `pytest -v` and `npm run build` pass (**observed**, not assumed).
9. Forest and building detection live (§5A) with per-feature state/share/basis in API and UI; verified on the fixtures and the labelled set.
10. A1–A14 closed with evidence in `CHANGELOG.md`; M13–M30 gates pass; `scripts/verify.sh` exit 0.
11. Rollback drill prints `ROLLBACK OK`; `baseline-v2.0` and `step-S*` tags exist; flags documented and defaulted to `shadow` until metrics pass.

---

---

## 19. Rollback and safe-integration plan (mandatory)

Neither zip contains a `.git` directory, so there is currently **no way to undo a change**. Fix that first.

### 19.1 Baseline (before any edit)
```bash
cd GeoAgri-main                         # the "after PRD v2.0" project is the integration target
cp -r . ../GeoAgri-main_BACKUP_v2.0     # plain folder copy kept OUTSIDE the repo
(cd .. && zip -qr GeoAgri_BACKUP_v2.0.zip GeoAgri-main_BACKUP_v2.0 && sha256sum GeoAgri_BACKUP_v2.0.zip > GeoAgri_BACKUP_v2.0.sha256)
git init -b main && git add -A && git commit -m "baseline: after-PRD v2.0 as received"
git tag baseline-v2.0
git checkout -b integrate/detection
```
The donor zip is **read-only**: extract to a separate folder (`../donor/`), copy files out one at a time per §2B.3. Never `cp -r donor/* .`.

### 19.2 One commit per step, one tag per commit
Each step in §20 ends with `pytest -v`, `npm run build`, grep gates, then:
```bash
git add -A && git commit -m "S03: <title> (M13,M14)" && git tag step-S03
```

### 19.3 Rolling back
| Need | Command |
|---|---|
| Undo the last step, keep history | `git revert HEAD` |
| Return to a known-good step | `git switch -c rollback/from-S07 step-S06` (or `git reset --hard step-S06` on the integration branch) |
| Return to the original v2.0 | `git switch main` (tag `baseline-v2.0`) |
| Restore from outside git | unzip `GeoAgri_BACKUP_v2.0.zip`, verify `sha256sum -c GeoAgri_BACKUP_v2.0.sha256` |
| Containers | tag before building: `docker tag geoagri-backend:latest geoagri-backend:v2.0`; roll back with `docker compose up -d` pinned to that tag |
| Data | no schema migrations in v2.1. If any are added later, each needs an Alembic `downgrade` and a test |

### 19.4 Runtime switches (rollback without redeploying)
| Flag | Values | Effect |
|---|---|---|
| `LAND_DETECTION_MODE` | `off` / `shadow` / `enforce` | `off`: detection not run (v2.0 behaviour); `shadow`: run, return `detection`, log, **do not** feed the verdict; `enforce`: feeds classifier |
| `LAND_GATE_MODE` | `off` / `shadow` / `enforce` | `off`: no gating (crops always computed, banner hidden); `shadow`: verdict returned **and** crops computed, UI shows "SHADOW MODE"; `enforce`: gating as §7 |
| `VITE_DETECTION_UI` | `true` / `false` | hides the detection panel |
| `area_check` response alias | present for one release | old UI keeps working while migrating |
Defaults for first deployment: `shadow` / `shadow`. Promote to `enforce` only when §14.4 metrics pass; demote with one env change.

### 19.5 Compatibility rules
- New response fields are additive (`detection`, `gate_mode`, `imputed_features`); do not rename existing fields in the same release.
- Removing `used_fallback_buffer` / `area_check` is a documented breaking change scheduled one release later.
- New env vars have safe defaults; the app must boot without them.

### 19.6 Rollback drill (run once, record in `CHANGELOG.md`)
`scripts/rollback_drill.sh`: (1) `git stash -u`; (2) `git switch --detach baseline-v2.0` → `pytest -q` → record pass/fail; (3) `git switch --detach step-S<last>` → `pytest -q`; (4) `git switch integrate/detection`; (5) set `LAND_DETECTION_MODE=off LAND_GATE_MODE=off`, call `/api/v1/predict/full-report` and assert v2.0-shaped output. The drill must print `ROLLBACK OK`.

---

## 20. Antigravity runbook — ordered, force-apply

**Rules for the agent:** do the steps in order; do not skip a gate; if a gate fails, fix it before moving on; if blocked for > 2 attempts, stop and write the blocker into `CHANGELOG.md` — do **not** work around it with a default, a mock, or a looser test. Never patch the unit under test in a test (M21). Never copy donor files not listed in §2B.3.

**Master prompt to paste into Antigravity:**
> Read `PRD.md` (v2.1) fully. Execute §20 steps S0→S14 in order on branch `integrate/detection`, one commit and one tag per step (§19.2). For each step run the gate listed; paste the command output into `CHANGELOG.md`. Do not fabricate data, defaults, provenance, or test results. Do not overwrite v2.0 files with donor files except as §2B.3 allows. If a command cannot run (network, credentials), record it as `NOT RUN` with the reason and continue only if the next step does not depend on it.

| Step | Do | Gate |
|---|---|---|
| **S0** | §19.1 baseline. Install deps; run `pytest -v` and `npm run build` **unmodified** and record real results (audit could not run them). | Baseline results recorded; tag `baseline-v2.0` |
| **S1** | Kill fabrication: **M13, M14, M17, M20** (providers return real data or `None`; record-override rules; honest `land.py`; config cleanup). Add the failing regression tests first (M21 `test_no_coordinate_defaults_to_agricultural`) and watch them fail on baseline, then pass. | grep gates M13/M20; regression test red→green |
| **S2** | **M18, M26** feature honesty + error handling. | `test_no_default_leak.py`; grep gate M18 |
| **S3** | **M25** dependencies + `scripts/verify.sh`; **M27** flags + rollback drill script. | `scripts/verify.sh` exit 0 |
| **S4** | **M16, M22, M28**: port `area_check.py` → `landclass/detection.py` per §5A (D1–D11); port tests; offline stubs. Leave `geo/area_check.py` as deprecated re-export. | §5A.6 matrix green; budget test green |
| **S5** | **M15, M29**: classifier consumes `Evidence`; rules from YAML; UNKNOWN/UNVERIFIED paths; irrigability reads YAML, adds water-access check. | `test_rules_are_live`, `test_unknown_without_evidence` |
| **S6** | **M19** `user_document` rewrite (PDF, units, privacy, sessions). | privacy + units + PDF + cross-session tests |
| **S7** | Wire `detection` into `predict.py` and `land.py` responses (§5A.5) with `LAND_DETECTION_MODE`/`LAND_GATE_MODE` semantics; keep `area_check` alias. | contract tests in §14.1 |
| **S8** | Data: run `download_datasets.py` for WorldCover, MS buildings, HydroLAKES, OSM extract; add Hansen/protected-area/slope per §12; `SOURCE.md` each; `/map-layers` honest status (**M10, M24**). | each layer `ready` or `unavailable`+reason |
| **S9** | **M23** frontend: detection panel, label fix, demo-mode gate, polygon draw/import, shadow strip. | `npm run build`; §11 checklist rows 1–12 |
| **S10** | **M30** attributions in UI/PDF; docs (**M24**): README, `api_reference.md`, CHANGELOG for v2.0 + v2.1. | docs present; UI attribution lists layers |
| **S11** | Calibration set + report (§14.3): ≥ 100 labelled points (forest, built, farmland, plantation, water, wasteland), ≥ 50 manual plots. Output `documentation/result/detection_validation.md` with precision/recall per class. | Metrics computed (may be below target — report honestly) |
| **S12** | Models B & D retrain on documented data (v1 §10) — only if S1–S11 are green. | model cards updated |
| **S13** | Rollback drill (§19.6) → must print `ROLLBACK OK`. | drill log in CHANGELOG |
| **S14** | Promote flags to `enforce` **only if** §14.4 detection metrics pass; otherwise leave `shadow` and record why. Final `scripts/verify.sh`. | verify exit 0; flags recorded |

**Stop conditions (agent must halt and report):** a gate fails twice; a step needs a credential not in `.env`; a change would require copying a "DO NOT COPY" donor file; a test would need to mock the unit under test.

---

## A. Carry-over from PRD v1.0 (unchanged unless contradicted above)
Evidence-gate statuses (`VERIFIED_AGRICULTURAL`, `AGRICULTURAL_CANDIDATE`, `RESTRICTED_LEGAL`, `NON_AGRICULTURAL_BUILT`, `WATER_BODY`, `UNVERIFIED`) remain in the `eligibility` block and map as: `FOREST_LEGAL→RESTRICTED_LEGAL`, `URBAN_BUILT→NON_AGRICULTURAL_BUILT`, `WATER_BODY→WATER_BODY`, `AGRICULTURAL` with official record+boundary → `VERIFIED_AGRICULTURAL`, otherwise `AGRICULTURAL_CANDIDATE`. v1 §5 (FR crop intelligence, season handling, tiered confidence, intercrop), §6.1 source matrix, §6.5 training datasets, §9 eligibility algorithm, §10 ML requirements and §12 data-folder layout continue to apply; the 78-feature honesty rules (FR-13/14) are now enforced by M2/M3.