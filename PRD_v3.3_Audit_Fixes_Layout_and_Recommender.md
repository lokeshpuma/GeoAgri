# GeoAgri AI — PRD v3.3: Audit Fixes, Screen-Fit Layout and a Real Recommender

**Version:** 3.3 · **Date:** 2026-10-28 · **Audited build:** `GeoAgri-main (1).zip` (after PRD v3.2, tag `v3.2.0`) · **Tool:** Antigravity
**Supersedes:** PRD v3.2 for every item below. v3.0, v3.1, v3.2 rules stay in force.
**Companion file:** `geoagri_v33_pack.zip` (crop crosswalk + test, 4 tests pass).

---

## 0. Rules for the coding agent

1. Report only what you ran. `NOT RUN` / `DID NOT FINISH` plus the reason, never a claim without a command.
2. **Never put hand-typed numbers in code and label them as data.** No "verified" label on anything that did not come from a source.
3. **No silent defaults.** If a value is unknown it is `null` and the screen says so. A fallback month, rank, factor or irrigation mode is a defect.
4. Every visible number must be consistent with every other visible number on the same card.
5. Check layout in a real browser at 1280×720, 1440×900, 1920×1080 and 390×844. Attach screenshots to `documentation/screens/`.
6. One commit and one tag per phase (section 8). Run `npm run build`, `npm test`, `npx playwright test`, `pytest -q` before each commit.

---

## 1. What I ran on this build

| Check | Result (observed by me) |
|---|---|
| `npm ci`, `npm run build` | Pass. Entry bundle 65.95 kB gzip. |
| `npm test` | **20 passed** (5 files). |
| Grep gates | Raw colours in TSX: **0**. Inline styles: **12**. (Both pass.) `index.css` still **3,816 lines** (old stylesheet still shipped next to the new ones). |
| `pytest -q` from a clean checkout, no `.env`, no cache | **131 passed, 1 failed**: `test_prediction_gating_shadow_mode_returns_crops` (0 crops returned). The changelog says 132 passed. |
| `npx playwright test` | **NOT RUN by me**: the sandbox cannot download Chromium. The changelog says 2 passed; I could not verify it. |
| Changelog Q7/Q8 | Honest: DID NOT FINISH. But see D-9: Q7 stopped too early. |

**PRD v3.2 items that are done and good:** `confirmBoundary`, `extractBoundary`, Finish shape, Edit boundary, map frozen on confirm, `pytest-socket` in requirements, test env set inside `conftest.py`, CI workflow, registry with 2,033 species, climatology service with a "no data" path, Tier A/B fields in the API, Tier B yield suppression, FAO attribution on the Workspace page, drawing flow Playwright spec.

---

## 2. Defects found

### 2.1 Fabricated data (critical, breaks rule 2)
| ID | Defect | Evidence |
|---|---|---|
| **D-1** | `services/weather/climatology.py` ships a **hand-typed monthly climate for the 0.1° cell 13.3_75.8** (12 temperatures, 12 rainfall values) with `source="NASA_POWER_CLIMATOLOGY_VERIFIED"`. No NASA call produced it. The offline tests pass only because they use coordinates in that cell. | `_CLIMATOLOGY_CACHE = {"13.3_75.8": …}` |
| **D-2** | HTTP errors from NASA POWER (429, 500, 503) are stored in the in-memory cache as "unavailable" **forever**. One bad minute disables a whole 10 km cell until restart. | `climatology.py` non-200 branch |
| **D-3** | `predict.py` falls back to invented values when a Tier A crop has no envelope: `limiting_factor="climatic_envelope"`, `best_planting_month=6` (June), `season_months=4`. | `predict.py` ~L417–420, L453–466 |

### 2.2 Why every Tier A card says "Limited by: climatic_envelope • Best planting: June"
| ID | Defect |
|---|---|
| **D-4** | **Zero** of the 119 legacy crop ids exist in the global registry (legacy ids are `finger_millet`; global ids are scientific slugs like `eleusine_coracana_ssp_coracana`). `envelope_by_id.get(cid)` is always `None` for Tier A crops, so the fallbacks in D-3 are always used. Your screenshot shows exactly this for Finger Millet, Turmeric, Groundnut and Sugarcane. **Fix is in the pack:** `legacy_crosswalk.json` links **114 of 119** (1 is a group crop, 4 are not in EcoCrop's usable set: triticale, camelina, sweet lime, isabgol). |
| **D-5** | Tier A crops are never scored on climate, so a crop can be "ML-verified" and rank first even when the site's climate rules it out. |

### 2.3 Wrong or contradictory numbers on the crop cards (from your screenshot)
| ID | Defect |
|---|---|
| **D-6** | **Rank text contradicts the card.** Card #2 (Turmeric) says "ranks #25", card #3 (Groundnut) says "ranks #2", card #4 (Sugarcane) says "ranks #41". `fusion/engine.py` writes the rank into the rationale **before** the Tier A/B merge re-sorts the list. |
| **D-7** | **Irrigation contradiction.** Cards show "rainfed" while the sentence says "requires full irrigation (1300 mm water need)". The label uses the merged `effective_mode`; the sentence uses the fusion engine's own preference. |
| **D-8** | **Tier B "water need" is annual rainfall.** `water_need_mm = sum(site.monthly_rain_mm)` (rainfall at the site) is shown as the crop's water need. `climate_risk_score = (1 − score) × 100` is a made-up index shown as "risk". Both are invented meanings. |
| **D-8b** | **Yield baselines still implausible:** rice p50 **13.02 t/ha**, maize **13.04**, coffee **13.18**, cotton **13.19**. No plausibility guard exists (v3.2 §7.1.8 not done). Rice or coffee at 13 t/ha will be shown if they rank. |
| **D-8c** | Raw tokens on screen: `climatic_envelope`, `Cash_crops`, `Spices` category pills mismatch the filter tabs (Oilseeds, Cash/Industrial), and the card header wraps the "ML-verified (Tier A)" badge over three lines. "Suitability" is clipped at the card edge. |

### 2.4 Drawing screen
| ID | Defect |
|---|---|
| **D-10** | **Several shapes can exist at once** (your screenshot shows a triangle, three rectangles and a circle together). The summary describes only one; Confirm silently sends one and ignores the others. The "Replace current boundary?" prompt required by v3.0 FR-B8 and v3.2 §2 does not exist (no matching string in the code). |
| **D-11** | Playwright has 2 tests; the v3.2 list needed 4 (draw 3 corners and stop; reload shows the restore banner and does not auto-confirm are missing). |

### 2.5 Layout (screen fit, your request)
| ID | Defect |
|---|---|
| **L-1** | **Field Analysis:** the left map is a fixed `340px` tall (`height="340px"`) in a two-column grid with `align-items` default. The right card is about 950 px tall, so **~600 px of empty page** sits under the map. |
| **L-2** | **Boundary Studio:** heights use `calc(100vh - 120px)` and `calc(100vh - 140px)`, a guess at the header size, and `100vh` is wrong on mobile browsers. A blank strip shows under the map and behind the floating step bar; the summary panel is capped with the same guess. |
| **L-3** | Old `index.css` still defines `.top-grid` and `.bottom-workflow-nav`, which fight the new component CSS (two sources of truth). |

### 2.6 Tests and data
| ID | Defect |
|---|---|
| **T-1** | The one failing clean-checkout test needs the hand-typed climate in D-1. Tests must inject a **fake climatology provider**, not rely on a baked-in cache. |
| **D-9** | Q7 stopped for all of D1–D4 after FAOSTAT returned 403. **GBIF, WorldClim and SoilGrids were never tried** and do not depend on FAOSTAT. |

---

## 3. Fixes

### 3.1 Climatology (D-1, D-2, T-1)
1. **Delete** the hard-coded `"13.3_75.8"` entry. The cache starts empty.
2. Cache **only successful** results, with a TTL (7 days) and an LRU cap (5,000 cells). Never cache a transient failure (non-200 other than a real "no land data" answer, timeouts, exceptions). Cache a "no land data" answer (ocean) for 30 days.
3. Return `source="NASA_POWER_CLIMATOLOGY"` only for data fetched this way. Remove the word `VERIFIED` from code.
4. Persist the cache to `backend/.cache/climatology.json` (git-ignored) so restarts do not refetch, and write the **fetch date** next to each cell.
5. Tests inject a provider: `monkeypatch.setattr("app.api.v1.predict.fetch_monthly_climatology", fake)` returning a `MonthlyClimatologyResult` built **inside the test file** and labelled `source="TEST_FIXTURE"`. Add a test that fails if the string `NASA_POWER_CLIMATOLOGY_VERIFIED` appears anywhere in `app/`.
6. Gate: `grep -rn "13.3_75.8\|VERIFIED" backend/app` returns nothing.

### 3.2 Link Tier A crops to envelopes (D-3, D-4, D-5)
1. Copy the pack. Load `legacy_crosswalk.json` in `services/crops/registry.py` as `get_legacy_crosswalk()`.
2. In `predict.py`, look up each Tier A crop's envelope with `envelope_by_id.get(crosswalk.get(cid, cid))`. **Do not limit the ranking to the top 100**: score every crop in the crosswalk directly with `score_crop`, and rank the rest of the registry separately.
3. **Remove every fallback** (`"climatic_envelope"`, month 6, 4 months, `"Moderate"`). If a Tier A crop has no envelope (triticale, camelina, sweet lime, isabgol, small millets), the fields are `null`, the card shows "No climate envelope on file", and `score_source="ml_only"`.
4. **Climate gate for Tier A:** if a Tier A crop has an envelope score < 0.30 (rainfed *and* irrigated), it is **not** recommended and appears only in an "Excluded for this climate" list with the limiting factor. A crop cannot be "ML-verified" and climatically impossible at the same time.
5. Pass the rest of the site into `Site(...)`: `altitude_m` (from the DEM already in the profile), `absolute_min_temp_c` if known, `soil_texture`. Unknown stays `None`.
6. Fix the tie-breaks required in v3.2 §7.1.5 in `rank_crops`: score, then Tier A, then category priority (cereal, pulse, root_tuber, vegetable, fruit_nut, others), then envelope margin, then name. Add a test with 30 crops tied at 1.0.

### 3.3 Make the card numbers agree (D-6, D-7, D-8, D-8b, D-8c)
1. **Rank:** the fusion engine must not put a rank in free text. Build the explanation **after** the final sort, from the final position, or drop the number. Test: for every card, any `#N` in the rationale equals the card's position.
2. **Irrigation:** one source of truth per crop. Use the scorer: `irrigation_need = "rainfed" if score_rainfed >= 0.6 else "supplemental" if score_irrigated >= 0.6 and score_rainfed >= 0.3 else "full irrigation" if score_irrigated >= 0.6 else "not suitable"`. The label, the sentence and the water figure all come from it. Test: a card whose label is "rainfed" cannot contain the words "irrigation" in its sentence.
3. **Tier B:** remove `water_need_mm` (set `null`) unless computed from a published crop water requirement. Remove the invented `climate_risk_score` for Tier B (`null`, card shows "Not assessed"). Show `score_rainfed` and `score_irrigated` instead.
4. **Yield plausibility guard (v3.2 §7.1.8):** add `backend/app/rules/yield_ceilings.yaml` with an upper P50 ceiling per crop (t/ha) for the common crops; reviewed by a human, with a comment naming the source for each number. If a crop's P50 exceeds its ceiling, the API returns `expected_yield_t_ha: null` and `yield_note: "Baseline failed plausibility check"`. Start with at least rice, wheat, maize, sorghum, millets, pulses, groundnut, soybean, cotton, coffee, tea, sugarcane, potato. Until D5 retraining, rice, maize, coffee and cotton must show no yield.
5. **Labels:** a shared `labels.ts` maps `climatic_envelope|temperature|rainfall|ph|altitude|frost|texture` to "Climate fit", "Temperature", "Rainfall", "Soil pH", "Altitude", "Frost", "Soil texture"; categories map `cash_crops → Cash / Industrial`, `root_tuber → Roots & Tubers`, `fruit_nut → Fruits & Nuts`, `medicinal_aromatic → Spices & Herbs`, and the filter tabs use the same keys. No raw snake_case may reach the screen (Playwright asserts no text matches `/[a-z]+_[a-z]+/` in the cards).
6. **Card layout:** grid `repeat(auto-fill, minmax(300px, 1fr))`; header badges in one flex row that wraps cleanly; `min-width: 0` on every flex child so "Suitability" is never clipped.

### 3.4 One shape only (D-10)
1. In `BoundaryMap`, when a draw `finish` with `action:'draw'` produces a second polygon, **do not keep it**: remove the new feature, show a confirmation "Replace current boundary with the new shape?", and on Yes remove the old one and keep the new one, on No remove the new one. (Terra Draw: `draw.removeFeatures([id])`.)
2. `extractBoundary` already reports `multiple_polygons`; treat that note as an error state: Confirm disabled until one shape remains.
3. Add Playwright tests (section 6): draw a second shape → prompt appears; Yes → one shape; No → still the first; reload → restore banner, not confirmed; three corners only → Confirm disabled.

### 3.5 Screen fit (L-1, L-2, L-3) — exact CSS requirements
Define once in `tokens.css`: `--app-header-h` (set from a `ResizeObserver` on the header element, default `88px`) and `--step-bar-h` (same for the floating step bar), and `--vh: 100dvh`.

**Boundary Studio** (`boundaryStudio.css`):
```css
.boundary-studio-page {
  position: relative;
  height: calc(100dvh - var(--app-header-h));   /* real header, real viewport */
  min-height: 480px;
  overflow: hidden;
}
.boundary-map-wrapper, .boundary-map-canvas { position: absolute; inset: 0; height: auto; min-height: 0; }
.plot-summary-panel { max-height: calc(100dvh - var(--app-header-h) - var(--step-bar-h) - 32px); }
.tool-dock { bottom: calc(var(--step-bar-h) + 16px); }
```
The map fills the whole area; nothing blank is visible under or beside it; the floating step bar sits **over** the map and the panels stay clear of it. Call `map.resize()` on window resize and when the panel collapses.

**Field Analysis** (`fieldAnalysis.css` + `FieldAnalysisPage.tsx`):
```css
.top-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 20px; align-items: stretch; }
.field-map-column { display: flex; flex-direction: column; gap: 12px; min-height: 0; position: sticky; top: calc(var(--app-header-h) + 12px); align-self: start; height: calc(100dvh - var(--app-header-h) - var(--step-bar-h) - 48px); min-height: 420px; }
.field-map-column .boundary-preview-container { flex: 1 1 auto; height: auto !important; min-height: 320px; }
@media (max-width: 900px) { .field-map-column { position: static; height: 60dvh; } }
```
Remove `height="340px"` from `FieldAnalysisPage.tsx`. The map is now as tall as the visible screen and stays in view while the right-hand card scrolls, so no empty area is left.

**Old stylesheet (L-3):** delete `.top-grid`, `.page-container`, `.bottom-workflow-nav` and every rule already re-created in `styles/components/*.css` from `index.css`; target `index.css` below 1,000 lines with no duplicate selectors (gate: a script that lists selectors defined in both places must print nothing).

**Page padding:** every page reserves `padding-bottom: calc(var(--step-bar-h) + 24px)` so the step bar never covers content.

**Check:** Playwright takes screenshots at 1280×720, 1440×900, 1920×1080 and 390×844 for `#boundary`, `#analysis`, `#crops`, and asserts for each: no horizontal scrollbar; the map element's bottom edge ≥ viewport height − `--step-bar-h`; on `#analysis` the empty space below the map inside `.field-map-column` is < 8 px.

### 3.6 Finish the data work that is possible (D-9)
Re-run Q7 per source, independent of each other. For each: try, record the HTTP status and reason, continue.
- **D1 FAOSTAT:** the agent's script got 403 from the CDN. Do the manual path: open `https://www.fao.org/faostat/en/#data/QCL` in a browser, choose *Download data → All data normalized (CSV)* and save to `backend/ml/data/raw/external/faostat/Production_Crops_Livestock_E_All_Data_(Normalized).csv`. `ml/training/load_faostat.py` must accept that file, filter to Area harvested, Yield, Production, 1990–latest, and write `faostat_yields.parquet` plus a `SOURCE.md` with the licence text copied from the download page. Record the date and row count.
- **D2 GBIF:** `https://api.gbif.org/v1/occurrence/search` (no key needed for search). For the 72 Tier A species, 300 occurrences each, `basisOfRecord=HUMAN_OBSERVATION`, `hasCoordinate=true`, `hasGeospatialIssue=false`. Cache one JSON per species.
- **D3 WorldClim 2.1:** `https://geodata.ucdavis.edu/climate/worldclim/2_1/base/` (`wc2.1_10m_tavg.zip`, `wc2.1_10m_prec.zip`, `wc2.1_10m_bio.zip`). 10 arc-minute is enough for calibration and small.
- **D4 Calibration:** `ml/training/calibrate_envelopes.py` as specified in v3.2 §6 D4. Re-run the four "too harsh" checks (wheat/Punjab, durum/Seville, olive/Seville, date palm/Riyadh) and write the before/after to `calibration_report.json`.
- **D5/D6 retraining:** only after the FAOSTAT file exists. If it does not, `DID NOT FINISH` stays, honestly.

---

## 4. Acceptance criteria

| ID | Criterion | Verified by |
|---|---|---|
| AC-1 | `grep -rn "13.3_75.8\|VERIFIED" backend/app` → nothing; cache starts empty | grep |
| AC-2 | `pytest -q` from a clean clone (no `.env`, no `.cache`) → all pass | CI |
| AC-3 | A transient NASA failure (HTTP 503) is **not** cached; the next call retries | pytest |
| AC-4 | Every one of the 114 crosswalk crops returns a real `limiting_factor` and `best_planting_month` (never "climatic_envelope", never a default June) | pytest |
| AC-5 | A Tier A crop with envelope scores < 0.30 is excluded and listed with its limiting factor | pytest |
| AC-6 | For every card, `#N` in the sentence equals the card position | pytest + Playwright |
| AC-7 | A "rainfed" card never says "irrigation"; irrigated cards never say "rainfed" | pytest |
| AC-8 | Tier B cards show no yield, no water-need figure, no invented risk index | pytest |
| AC-9 | Rice, maize, coffee, cotton show no yield until their baselines pass the ceiling check | pytest |
| AC-10 | No snake_case text on the crop page | Playwright |
| AC-11 | Drawing a second shape shows the replace prompt; one shape remains after answering | Playwright |
| AC-12 | Reload restores the draft with a banner and does not auto-confirm | Playwright |
| AC-13 | No blank area: map bottom ≥ viewport − step bar on `#boundary`; < 8 px empty under the map on `#analysis`; no horizontal scroll at 1280×720, 1440×900, 1920×1080, 390×844 | Playwright + screenshots |
| AC-14 | `index.css` < 1,000 lines, no selector defined in two stylesheets | script |
| AC-15 | `npm run build`, `npm test`, `npx playwright test`, `pytest -q` all green; real output pasted in `CHANGELOG.md` | CI |
| AC-16 | D1–D4 each report a real status; calibration before/after published, good or bad | reports |

---

## 5. Test list that must exist

Backend (pytest, offline): climatology cache rules (no entry shipped, no cache on 503, TTL, no-land cached); crosswalk link tests (in pack); Tier A gets envelope fields; Tier A climate exclusion; tie-break order with 30 tied crops; rank text equals position; irrigation label/sentence agreement; Tier B nulls; yield ceiling guard; a test that scans `app/` for forbidden strings (`VERIFIED`, `"climatic_envelope"` used as a value, hard-coded month defaults).
Frontend (Vitest): `labels.ts` mapping covers every enum value; no raw token reaches a card (render test over fixtures).
Playwright: the 4 drawing scenarios from v3.2 plus the replace-shape prompt, and the layout checks in 3.5 at four viewports.

---

## 6. Runbook (one commit + tag per phase)

**V0 Truth baseline.** Tag `pre-v3.3`. Run the commands in section 1 from a clean clone and paste real output, including the one failing test.

**V1 Remove fabricated data (3.1).** AC-1 to AC-3.

**V2 Clean-clone tests (T-1).** Inject a fake climatology provider in tests. AC-2.

**V3 Crosswalk + Tier A envelope (3.2).** Copy `geoagri_v33_pack.zip` over the repo root first. AC-4, AC-5.

**V4 Card truthfulness (3.3).** AC-6 to AC-10.

**V5 One-shape rule + drawing tests (3.4).** AC-11, AC-12.

**V6 Screen fit + stylesheet cleanup (3.5).** AC-13, AC-14. Commit the screenshots.

**V7 External data (3.6).** D1 to D4, each independent, each reporting its own status. AC-16.

**V8 Retrain Tier A (D5, D6)** only if V7 produced the FAOSTAT file; otherwise `DID NOT FINISH`.

**V9 Docs and release.** README, api reference, `documentation/screens/`, `CHANGELOG.md` with real output, tag `v3.3.0`.

Rollback: `git reset --hard <previous-tag>`. V1 to V6 do not depend on V7 or V8.

---

## 7. Kickoff prompt for Antigravity (paste as-is)

> Read `PRD_v3.3_Audit_Fixes_Layout_and_Recommender.md` completely. Unzip `geoagri_v33_pack.zip` over the repo root when you reach V3, not before. Run V0 first from a clean clone and record real output, including the failing test. Execute V1 to V9 in order, running each phase's gate, committing and tagging. Never type climate, yield or soil numbers into code and call them data; delete the hard-coded climatology cell. Never add a fallback value for planting month, limiting factor, rank, irrigation mode or yield. Fix the layout exactly as section 3.5 specifies and prove it with Playwright screenshots at four viewport sizes. Run V7's sources independently and report each one's real HTTP status. If something cannot run, write `NOT RUN` or `DID NOT FINISH` with the reason.
