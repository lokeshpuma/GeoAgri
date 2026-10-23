# GeoAgri AI — Product Requirements Document (PRD) v2.0

**Version:** 2.0 · **Date:** 2026-10-23 · **Supersedes:** PRD v1.0 (kept in §A as the delta base)
**Scope of v2:** add **land-class + irrigability classification** (forest, wasteland, urban/built-up, water → *explicitly "NOT IRRIGABLE"*), a **land-records enquiry layer** (Karnataka e-Khata/e-Swathu, Bhoomi RTC, ULPIN, other states, other countries) driven by **coordinates + credentials**, and a **mandatory change set** that Antigravity must apply to the repo.
**Implementation tool:** Antigravity (coding agent). **Read §0 and §3 first.**

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
9. **"Force change" rule:** items in §3 are mandatory. Do not mark a phase complete until its §3 grep/test gate passes.

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

### 2.2 Still wrong in the repo (must be fixed — see §3)
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
8. Upload sample RTC ⇒ parsed fields editable, PII absent, badge "user-provided".

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

### 14.2 Existing tests: update `test_phase3…7`; keep `test_no_synthetic_leak.py` green.

### 14.3 Calibration
- Labelled set: FtW India polygons (cropland positives) + sampled non-crop (water/built/forest/bare) from OSM/MS/WorldCover/WDPA → tune `T_*`; report precision/recall per class in `documentation/result/land_class_validation.md`.
- Manual review of **≥ 50 Karnataka plots** on satellite imagery (agri, fallow, plantation, built, water, reserved-forest edge, barren rocky, scrub) — agreement target ≥ 90 % (stretch 95 %).

### 14.4 Acceptance metrics (confirm after calibration)
- 0 synthetic values; 0 constants matching §3 grep gates.
- Class agreement with manual set ≥ 90 %; **no plantation misclassified as forest** in the plantation subset ≥ 95 %.
- p95 latency: land inquiry ≤ 5 s with local layers; full report ≤ 15 s.
- Yield model beats district-mean baseline under district-held-out CV (v1 metric).

---

## 15. Implementation plan (hand to Antigravity phase by phase)
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
8. No secrets in git; `pytest -v` and `npm run build` pass.

---

## A. Carry-over from PRD v1.0 (unchanged unless contradicted above)
Evidence-gate statuses (`VERIFIED_AGRICULTURAL`, `AGRICULTURAL_CANDIDATE`, `RESTRICTED_LEGAL`, `NON_AGRICULTURAL_BUILT`, `WATER_BODY`, `UNVERIFIED`) remain in the `eligibility` block and map as: `FOREST_LEGAL→RESTRICTED_LEGAL`, `URBAN_BUILT→NON_AGRICULTURAL_BUILT`, `WATER_BODY→WATER_BODY`, `AGRICULTURAL` with official record+boundary → `VERIFIED_AGRICULTURAL`, otherwise `AGRICULTURAL_CANDIDATE`. v1 §5 (FR crop intelligence, season handling, tiered confidence, intercrop), §6.1 source matrix, §6.5 training datasets, §9 eligibility algorithm, §10 ML requirements and §12 data-folder layout continue to apply; the 78-feature honesty rules (FR-13/14) are now enforced by M2/M3.
