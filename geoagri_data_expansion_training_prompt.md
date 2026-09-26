# GeoAgri — Global Dataset Expansion & Model Retraining

**Paste this whole file into the coding agent (Antigravity / Claude Code / Gemini) working on the `GeoAgri` repo.** It is a complete task spec — read it fully before writing any code.

---

## 0. Context (do not skip)

Repo: `GeoAgri/backend/ml/`
Current state:
- `data/raw/` contains only **3 files**: `Crop_recommendation.csv`, `Crop_recommendation_with_intercrops.csv`, `Crop_yield.csv` — all small, India/single-region-biased, ~20-25 crop labels.
- `data/processed/` (`crop_profile_best.csv`, `crop_registry.json`, `intercrop_matrix.json`, `intercrop_pairs_best.csv`) was derived from those same 3 files, so it inherited the same narrow crop coverage — regenerating "processed" from "raw" will not fix anything; **raw must be replaced/expanded first**.
- `Model B` (Multi-Crop Recommender) and `Model D` (Quantile Yield Regressors) in `app/services/` are trained on this narrow label set, which is why the API always returns the same handful of crops for any global coordinate.
- The 78-layer feature pipeline (optical, SAR, terrain, soil, thermal, hydrological) is already rich and global — **the model/label side is the bottleneck, not the feature side.**

Goal of this task: expand to **free, open-license global datasets**, rebuild the crop registry to **2,000+ species**, and retrain Models B, D and the intercrop engine so recommendations vary correctly by region, and both single-crop and intercrop options are genuinely competitive (not just intercrop always winning by a fixed +15%).

---

## 1. Acquire the datasets (all free, no paid API keys required)

Fetch and cache raw downloads into `backend/ml/data/raw/external/`, one subfolder per source, with a `SOURCE.md` in each noting license + retrieval date.

| # | Source | What it gives us | Why it matters here | Access |
|---|---|---|---|---|
| 1 | **FAO ECOCROP** (now served via FAO GAEZ) | Climate & soil requirement envelopes (temp min/opt/max, rainfall min/opt/max, pH range, soil texture, depth, growth cycle, altitude) for **~2,568 plant species** | This is THE dataset that gets us to "2000+ crops" — it's the only free global crop-envelope database at this scale | `https://gaez.fao.org/pages/ecocrop-search` and `https://ecocrop.apps.fao.org/ecocrop/srv/en/home` — scrape/export per-species records (no bulk CSV export is officially guaranteed, so build a polite rate-limited scraper with caching; check for a bulk download link on the GAEZ data portal first before scraping) |
| 2 | **FAOSTAT** (Crops and livestock products domain) | Actual country-level production, yield (t/ha), and harvested-area time series for ~170 crop commodities, 40+ years, every country | Real yield ground-truth to train/validate Model D regressors — ECOCROP alone has no yield numbers | `https://www.fao.org/faostat/en/#data/QCL` — bulk CSV download, no key needed |
| 3 | **USDA GENESYS / GRIN-Global** | Germplasm-level species and variety metadata, climatic zone of origin | Fills gaps in ECOCROP for minor/regional crops and confirms taxonomy | `https://www.genesys-pgr.org/` — open API |
| 4 | **ICRISAT / ICAR crop data (India-region)** | Already partially reflected in the existing 3 CSVs — keep these as one regional slice, not the whole dataset | Use as one labeled cluster among many regional clusters, not the global default | existing files |
| 5 | **GBIF occurrence records** | Real-world lat/lon points where each species is actually grown/found | Use to sanity-check ECOCROP's climate envelope against real occurrence bioclimatic values (cross-validation), and to catch species whose "suitable" envelope never actually corresponds to any real cultivated location | `https://www.gbif.org/developer/occurrence` — free REST API |
| 6 | **WorldClim / Bioclim variables** | Gridded global 19 bioclimatic variables at up to 1km resolution | Already conceptually covered by the pipeline's NASA POWER/ERA5 layers, but pull once as a static reference grid so envelope validation doesn't require live API calls per species | `https://worldclim.org/data/bioclim.html` — free download |
| 7 | **Companion-planting / intercropping literature datasets** | No single official API. Build a **rules table** from: legume family (N-fixing) tagging via taxonomy, root-depth complementarity, canopy-height stratification, allelopathy flags | ECOCROP includes taxonomic family — use `Fabaceae` = nitrogen-fixer flag automatically; combine with a manually curated allelopathy/synergy exception list (a few hundred well-documented pairs, e.g. maize+beans+squash, is enough — do not hallucinate untested pairs) | curate manually, cite sources in comments |

**Do not** invent a dataset or fabricate crop records that "look like" ECOCROP if the scrape fails — fail loudly, log which species couldn't be retrieved, and keep the pipeline resumable/cacheable so it can be re-run without re-fetching what's already cached.

---

## 2. Build the unified schema

Create `backend/ml/training/build_global_crop_registry.py` that merges everything above into one canonical table, one row per species:

```
crop_id, common_name, scientific_name, family, category
  (cereal / pulse / oilseed / cash_crop / vegetable / fruit / fodder / agroforestry / other)
temp_min_c, temp_opt_min_c, temp_opt_max_c, temp_max_c
rainfall_min_mm, rainfall_opt_min_mm, rainfall_opt_max_mm, rainfall_max_mm
ph_min, ph_opt_min, ph_opt_max, ph_max
soil_texture_pref[]        # from ECOCROP soil descriptors
altitude_min_m, altitude_max_m
growth_cycle_days_min, growth_cycle_days_max
is_nitrogen_fixer (bool)   # Fabaceae family flag
has_real_yield_data (bool) # true only if FAOSTAT has yield series for this crop
data_sources[]             # provenance — which of the above sources contributed
confidence_tier            # "A" = has real yield time series (FAOSTAT), "B" = ECOCROP envelope only
```

This becomes the new `crop_registry.json` (target: 2,000+ rows, confidence_tier A for the ~150-200 major commodities, tier B for the long tail).

---

## 3. Retrain the models — keep the existing 5-model architecture, change what feeds it

Do **not** force one black-box model to cover all 2,000+ species equally — that will overfit or degrade badly for rare crops. Use a **tiered approach** that matches the resilience/fallback pattern already documented in the README:

- **Model B (Multi-Crop Recommender)**
  - Tier A crops (real yield + production data): train the existing Gradient Boosting / Random Forest classifier on the full merged feature set (78-layer vector + ECOCROP envelope distance features), using FAOSTAT-derived regional suitability as weak labels where explicit labels don't exist.
  - Tier B crops (ECOCROP envelope only, no yield history): score with a **transparent envelope-matching function** (e.g. Mahalanobis distance from the site's climate/soil vector to the crop's optimal envelope, penalized outside min/max bounds) rather than a trained classifier — this is honest about data limits and still gives 2,000+ crop coverage.
  - Merge both into one ranked list; tag each recommendation with its `confidence_tier` in the API response so the frontend/PDF report can show "ML-verified" vs "agro-climatic envelope match."

- **Model D (Quantile Yield Regressors, P10/P50/P90)**
  - Only run for Tier A crops — do not fabricate yield numbers for species with no yield ground truth. For Tier B crops, omit yield figures or show a suitability score instead, clearly labeled.

- **Intercrop Engine (`intercrop_service.py`)**
  - Rebuild `intercrop_matrix.json` from taxonomy-driven rules (nitrogen-fixer + canopy-height diff + root-depth diff + no allelopathy flag) plus the curated exception list, not just the old 3-CSV pairs.
  - **Important fix requested:** don't hardcode intercropping at a fixed +15% synergy — compute the synergy delta per pair from the same envelope-overlap logic (how well companion crops' resource use is complementary at this specific site), and always compute the **best single-crop monoculture yield/score alongside the best intercrop combo** so the report can honestly show which wins at a given site instead of assuming polyculture always wins.

---

## 4. Validation before shipping

- Hold out entire regions (not random rows) when validating Tier A models — train on some continents, test on others — to catch geographic overfitting.
- Spot-check 15-20 species across different climate zones (e.g. cassava in equatorial Africa, quinoa in Andean highlands, durum wheat in Mediterranean) against known agronomic reality.
- Re-run `backend/tests/test_phase2_data.py` through `test_phase5_models.py` and extend them to assert: registry has 2,000+ rows, every row has a valid confidence_tier, no envelope has min > max, Model B never returns the exact same top-5 for two climatically distinct test coordinates.

---

## 5. Deliverables

1. `backend/ml/data/raw/external/**` — cached raw pulls + `SOURCE.md` per source (license, URL, fetch date, row count).
2. `backend/ml/training/build_global_crop_registry.py` — reproducible merge script.
3. Updated `backend/ml/data/processed/crop_registry.json` (2,000+ species, tiered).
4. Updated `backend/ml/data/processed/intercrop_matrix.json` (rule-derived, not fixed +15%).
5. Retrained joblib binaries in `backend/ml/models/`.
6. Updated `app/services/decision_fusion.py` and `intercrop_service.py` to read and expose `confidence_tier` and per-site synergy delta.
7. Passing test suite (`pytest -v` in `backend/`) with the new assertions from Step 4.
8. A short `CHANGELOG_dataset_expansion.md` summarizing before/after crop counts, source list, and known limitations (e.g. "Tier B species use envelope-matching, not ML regression — flag clearly in UI").

Work in small, reviewable commits (one per data source, one for the registry builder, one per model retrain) rather than a single giant commit.
