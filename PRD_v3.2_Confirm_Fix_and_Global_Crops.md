# GeoAgri AI — PRD v3.2: Confirm-Boundary Fix + Global Crop Coverage

**Version:** 3.2 · **Date:** 2026-10-27 · **Audited build:** `GeoAgri-main.zip` (after PRD v3.1) · **Tool:** Antigravity
**Supersedes:** PRD v3.1 for the items below. Everything else in v3.0, v3.1 and v2.1 stays in force (no hidden defaults, no scraping, offline tests, honest reporting).
**Companion file:** `geoagri_data_pack.zip` (real data + tested code, see section 5).

---

## 0. Rules for the coding agent

1. Report only what you ran. Write `NOT RUN` or `DID NOT FINISH` plus the reason. Never write "restyled", "verified" or "N passed" for something you did not observe.
2. Never invent crop, yield, climate or soil values. If a source is unreachable, fail loudly, record it in `SOURCE.md`, and leave the field empty.
3. A crop with no yield data gets a suitability score and a clear label. It never gets a made-up yield.
4. The drawing screen must be checked in a real browser (Playwright). Unit tests alone are not enough for it.
5. One commit and one tag per phase (section 9). Run `npm run build`, `npm test` and `pytest -q` before each commit.

---

## 1. What I ran on this build

| Check | Result |
|---|---|
| `npm ci`, `npm run build` | Pass. Entry bundle about 66 kB gzip, code-split. |
| `npm test` (as shipped) | 11 passed. |
| `pytest` on a **clean checkout** | **Fails to start**: `pytest-socket` is imported by `conftest.py` but is not in `requirements.txt`. |
| `pytest` after `pip install pytest-socket` | **9 failed, 108 passed.** The 9 need `GEE_MOCK_FALLBACK=true` and `ALLOW_SYNTHETIC_DATA=true`, which only exist in the author's local `.env`. |
| `pytest` with those two variables set | 117 passed. (So the changelog's "117 passed" is true only on the author's machine.) |
| Real browser run of the drawing screen | **NOT RUN** (no browser in my environment). |

---

## 2. The Confirm problem you reported — root cause

You said: after drawing, the shape cannot be confirmed because editing still seems active.

Two defects explain it. The first I reproduced with a test; the second I verified in the Terra Draw 1.38.0 source.

### C1 (reproduced): Confirm shows success but never leaves the Studio
`BoundaryStudioPage.handleConfirm` saves the boundary, shows "Boundary Confirmed", then runs `setTimeout(() => goToStep(3), 400)`. That `goToStep` was created on the render **before** the save, so its `isStepAccessible(3)` still sees `formData.confirmed === false` and returns without doing anything. The user stays on the map with the handles still visible, so it looks like editing is still active.

Reproduction (`src/context/stale.repro.test.tsx`, passes today because it documents the bug):
- call `goToStep` captured before confirm, after `updateFormData({... confirmed:true})` → `currentStep` stays **1**
- call a fresh `goToStep(3)` → `currentStep` becomes **3**

### C2 (verified in source): an unfinished shape counts as a finished boundary
Terra Draw keeps helper features in the same store as the user's shape: `closingPoint`, `coordinatePoint`, `snappingPoint`, `midPoint`, `selectionPoint`, and while drawing an in-progress polygon marked `currentlyDrawing: true` whose last vertex is the mouse cursor. `BoundaryMap.syncFromTerraDraw` takes "the first Polygon in the snapshot" and calls `onGeometryChange` + `evaluateBoundary` on it. So:
- while the user is still placing corners, the panel can say **Valid** and enable Confirm for a half-drawn shape that includes the cursor position;
- `draw.on('finish')` calls `onToolChange('select')` after **every** finish (also after dragging a vertex), and `draw.on('change')` calls `handleGeometryChange` on every store change, which sets `confirmed:false`. Any later change event silently un-confirms.
- the pin fallback `features.find(Point)` can pick a helper point as a "pin".

### Required fix

**Context** (`WorkflowContext.tsx`): add one atomic action and stop navigating through a stale gate.

```ts
interface BoundaryPayload {
  polygonPts: [number, number][]; pointPt?: [number, number]; areaHa: number;
  plotName: string; boundarySource: 'drawn' | 'point' | 'demo';
  areaSource: 'server' | 'client-estimate';
}
const confirmBoundary = (p: BoundaryPayload) => {
  setFormData(prev => ({ ...prev, ...p, confirmed: true }));
  setAnalysisStatus(s => ({ ...s, locationSelected: true }));
  setIsPredicted(false); setReport(null);                    // a new boundary invalidates old results
  setCurrentStep(3);
  setMaxUnlockedStep(m => Math.max(m, 3));
  if (typeof window !== 'undefined') window.location.hash = STEP_HASHES[3];
};
```
Expose it in the context value. In `BoundaryStudioPage.handleConfirm` call `confirmBoundary(...)` and **delete** the `setTimeout(() => goToStep(3))`.

**Map** (`BoundaryMap.tsx`): use `extractBoundary` (in the data pack, 8 tests) as the only reader of the snapshot.

```ts
const sig = (r: LngLat[] | null) => (r ? r.map(c => c.join(',')).join(';') : '');
const syncFromTerraDraw = () => {
  const res = extractBoundary(draw.getSnapshot());
  onDrawStatusChange(res.status);                       // 'none' | 'drawing' | 'ready'
  if (res.status === 'drawing') return;                 // never treat an unfinished shape as a boundary
  const next = sig(res.polygon) + '|' + (res.pin?.join(',') ?? '');
  if (next === lastCommittedSig.current) return;        // selection or hover changes must not un-confirm
  lastCommittedSig.current = next;
  onGeometryChange(res.polygon, res.pin);
};
```
- `draw.on('finish', (id, ctx) => …)`: switch to select mode **only** when `ctx.action === 'draw'` (a shape was just completed), never after edits.
- Remove `onToolChange('select')` from the generic `finish` handler.
- If `res.note === 'multiple_polygons'`, ask "Replace current boundary?" instead of silently choosing.

**Studio / panel:**
- `handleGeometryChange` calls `updateFormData({ confirmed:false })` **only if** `formData.confirmed` is true **and** the committed signature changed.
- While `drawStatus === 'drawing'`, Confirm is disabled and the panel shows: "Finish the shape: double-click, click the first corner, or press Enter."
- Add a **Finish shape** button for that state. Implementation (uses APIs verified in Terra Draw 1.38): read the in-progress polygon from the snapshot, drop its last coordinate (the cursor) and the duplicate closing coordinate, require ≥ 3 distinct corners, `draw.removeFeatures([id])`, `draw.addFeatures([{type:'Feature', properties:{mode:'polygon'}, geometry:{type:'Polygon', coordinates:[closedRing]}}])`, then `setMode('select')`. Do **not** switch mode first: leaving polygon mode runs `cleanUp()`, which deletes the unfinished shape.
- On Confirm, call `draw.setMode('static')` after reading the geometry, so handles disappear and nothing can change the shape while the server check runs. Add an **Edit boundary** button that returns to `select` and sets `confirmed:false`.
- Do not call `onGeometryChange` during the initial `addFeatures` of a restored draft, so a restored draft is never auto-confirmed.

**Tests that must exist**
1. Context: `confirmBoundary` from step 2 lands on step 3 with `confirmed:true`, even when invoked from a handler created before the call.
2. `extractBoundary` cases (already written, 8 tests).
3. Studio (RTL, Terra Draw mocked): drawing status disables Confirm; a `change` event with an unchanged signature does not reset `confirmed`; a finish with `action:'dragCoordinate'` does not switch tools.
4. **Playwright** (headless Chromium): draw four corners with clicks, double-click to close, press Confirm → URL hash becomes `#analysis` within 2 s; draw three corners and stop → Confirm is disabled; draw a bow-tie → "Edges cross" and Confirm disabled; reload → restore banner, not auto-confirmed.

---

## 3. Test hygiene defect (fresh clone)

| ID | Defect | Fix |
|---|---|---|
| T1 | `pytest-socket` missing from `requirements.txt` | Add `pytest-socket>=0.7` (or a `requirements-dev.txt`). |
| T2 | 9 tests depend on the author's `.env` | In `tests/conftest.py` set `GEE_MOCK_FALLBACK=true` and `ALLOW_SYNTHETIC_DATA=true` through `monkeypatch`/an autouse fixture, and clear `get_settings.cache_clear()`. These flags must never be set outside tests. |
| T3 | CI | A GitHub Actions job that runs from a clean clone with no `.env`: `pip install -r requirements.txt`, `pytest -q`, `npm ci`, `npm test`, `npm run build`. |

Gate: `rm -f backend/.env && pytest -q` passes from a fresh virtual environment.

---

## 4. Why crops are limited today

Measured on the current repo:
- `crop_registry.json` has **119** crops, and the recommender only ranks those.
- The yield baselines in that file are not credible, so Model D's numbers cannot be trusted: rice p50 **13.0 t/ha**, maize **13.0**, coffee **13.2**, against typical farm yields of roughly 2–6, 3–10 and under 2. They came from the small Kaggle file the repo itself calls a "demo baseline" with known outliers.
- `ml/data/raw` holds three small India-only CSVs.

So the feature side is global (satellite, soil, weather) but the crop side is a short list with questionable yields. That is the bottleneck.

---

## 5. What I obtained and built (real, tested)

All files are in `geoagri_data_pack.zip`. Observed results:

**Data downloaded:** the full **FAO EcoCrop** database, 2,568 plant records (temperature, rainfall, pH, altitude, growth cycle, soil texture, depth, fertility, salinity, drainage, climate zones). Source: public GitHub copy of the FAO export (`OpenCLIM/ecocrop`). Provenance and caveats are in its `SOURCE.md`.

**Registry built** (`build_global_crop_registry.py`): of 2,568 records, **2,033 kept**; 512 rejected for missing envelopes, 22 for inconsistent order (min > optimum), 1 implausible. **1,646** are recommendable (cereals, pulses, roots, vegetables, fruit and nuts, medicinal/aromatic, materials, fodder, cover crops); ornamental, weed and forestry-only species stay in the file but are off by default. 391 species are tagged nitrogen-fixing (family *Leguminosae*, which is how EcoCrop spells it). 72 crops are Tier A, 1,961 are Tier B.

**Scorer built** (`envelope_suitability.py`): the published EcoCrop limiting-factor method. Each factor (temperature, rainfall, pH, altitude, frost) is scored 0–1 with a trapezoid; the most limiting factor wins; it is evaluated for each of the 12 possible planting months, and returns the best month, the limiting factor, and **both a rainfed and an irrigated score**.

**Tests:** backend **127 passed** (117 existing + 10 new); frontend **20 passed** (11 existing + 8 `extractBoundary` + 1 reproduction).

### Spot checks against known agronomy (approximate textbook monthly climates; test inputs only)

| Crop @ place | Score | Reads as |
|---|---|---|
| Cassava @ Kisumu, Kenya | 1.00 | correct |
| Quinoa @ Cusco, Peru (3,400 m) | 0.92 | correct |
| Maize @ Iowa, USA | 1.00 | correct |
| Finger millet @ Bengaluru | 1.00 | correct |
| Rice, rainfed @ Riyadh | 0.00 (irrigated 0.50) | correct |
| Coffee @ Bengaluru | rainfed 0.22 / irrigated 1.00 | plausible (900 mm is low for coffee) |
| Wheat @ Ludhiana, Punjab | rainfed 0.00 / irrigated 0.40, limited by pH 7.9 | **too harsh** (Punjab wheat is real) |
| Durum wheat @ Seville | 0.41, limited by temperature | **too harsh** (cool-season crop) |
| Olive @ Seville | 0.37, limited by temperature | **too harsh** |
| Date palm @ Riyadh, irrigated | 0.31, limited by temperature | **too harsh** |

Number of crops scoring ≥ 0.3 differs a lot by climate (Kisumu 842, Seville 248, Iowa 189, Cusco 176, Ludhiana 114, **Riyadh 1**), so recommendations now change with the place and a desert returns almost nothing instead of padding the list.

### What this tells us (limits to state in the UI)
- It is a **screening score from expert envelopes**, not a yield forecast and not a trained model.
- Using the minimum over months and annual-mean envelopes penalises cool-season crops, and EcoCrop's pH limits are conservative. Several real crops score too low. This must be calibrated (section 6) before any score is described as "accurate".
- Many crops tie at 1.0. Ranking needs tie-breaks (section 7).

---

## 6. What still needs data, and the exact steps to run on your machine

I could not reach these from my environment (FAO, GBIF, WorldClim, Kaggle, Hugging Face were blocked), so **nothing below has been downloaded or trained**. Your machine and Antigravity have internet. Do not train on EcoCrop alone: it has no yield or presence labels, so a model trained on it would only learn the envelopes back.

**D1. FAOSTAT crop yields (Tier A ground truth).**
`https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_All_Data_NOFLAG.zip` (QCL). Keep: country, item, element ∈ {Area harvested, Yield, Production}, years 1990–latest. Use the **FAO item name** mapping table `item_to_ecocrop.csv` (curated, one row per commodity, reviewed by hand, ~150–200 rows). Licence: the FAOSTAT pages show CC BY 4.0 in some places and CC BY-NC-SA 3.0 IGO in others; **check the current terms before commercial use** and record them in `SOURCE.md`.

**D2. GBIF occurrences (check the envelopes).**
GBIF occurrence API, `basisOfRecord=HUMAN_OBSERVATION`, with coordinates, no flagged issues, for each Tier A species and a sample of Tier B. Cache by species; rate-limit politely.

**D3. WorldClim 2.1 bioclim and monthly climate (1 km or 2.5 arc-min).**
Download once. Use it to get the climate at each GBIF point and for each FAOSTAT country's cropland.

**D4. Calibration (new script `ml/training/calibrate_envelopes.py`).**
For every species with ≥ 100 clean occurrences: compute the 5th/25th/75th/95th percentile of annual temperature, annual rainfall and (where SoilGrids is available) pH at the occurrence points. Compare with EcoCrop min/optimum/max. Output `calibration_report.json` with, per species, the share of occurrences outside the EcoCrop min–max, and a suggested widened envelope. **Never overwrite EcoCrop values automatically**: write `registry_calibrated.json` with `envelope_source: "ecocrop" | "gbif_adjusted"` and use the adjusted range only when ≥ 100 occurrences and the outside-share exceeds 15%. Re-run the section 5 spot checks; wheat/Punjab, durum/Seville, olive/Seville and date palm/Riyadh should improve, and the report must say whether they did.

**D5. Tier A models (retrain, keep the 5-model architecture).**
- *Model D (yield quantiles):* train per crop with country-year FAOSTAT yield as target and WorldClim/ERA5 climate, soil and year trend as inputs. Validate with **leave-one-continent-out** splits, not random rows. Report pinball loss and the share of observations inside P10–P90. Replace the implausible baselines in `crop_registry.json`; any crop that cannot beat the "country mean yield" baseline keeps that baseline and is labelled so.
- *Model B (recommender):* weak labels = a crop is a positive for a country-year if its harvested-area share is in the top quartile; features = the same climate/soil vector. Hold out whole regions. Report top-5 hit rate per continent.
- Store joblibs with a `model_card.json` (data version, split, metrics, date).

**D6. Intercropping.** Rebuild `intercrop_matrix.json` from rules (nitrogen fixer + different canopy height + different rooting depth, minus a curated allergopathy exception list). Compute the benefit per site from envelope overlap; do not hard-code +15%. Always show the best single crop next to the best pair. Add a `sources` list for every curated pair; do not add pairs you cannot cite.

Every step writes a `SOURCE.md` (URL, licence, retrieval date, row count) and is resumable. Acceptance for D1–D5 is in section 8.

---

## 7. Integration requirements

### 7.1 Backend
1. Copy the data pack into the repo. Add `get_global_registry()` next to `get_crop_registry()`.
2. **Monthly climate input.** The scorer needs 12 monthly mean temperatures and 12 monthly rainfall totals for the site. Add `services/weather/climatology.py` that returns a long-term (≥ 10 years) monthly climatology from NASA POWER (already a project source) and caches it. If it cannot be obtained, return `unavailable` and show **no crop ranking** with the reason. Do not substitute annual means silently.
3. **Water mode.** Pass `irrigated = (irrigability.verdict is irrigable AND an irrigation mode other than rainfed_only is permitted)`. Return both scores; rank by the one that matches the permitted mode.
4. **Recommendation merge.** For each site: Tier A crops are scored by the trained models (when D5 exists) and also get the envelope score; Tier B crops get the envelope score only. The response adds, per crop: `confidence_tier`, `method` (`"ml_model"` or `"ecocrop_envelope"`), `score`, `score_rainfed`, `score_irrigated`, `best_planting_month`, `season_months`, `limiting_factor`, `category`, `scientific_name`, `notes`. **Yield fields are present only for Tier A crops.**
5. **Tie-breaks** (many crops score 1.0): order by score, then Tier A first, then category priority (cereal, pulse, root_tuber, vegetable, fruit_nut, then others), then margin (average distance from the envelope edges), then name.
6. **Filtering:** `?category=`, `?include_all_categories=false` default, `?top_n=` (default 20, max 100), `?min_score=0.3`.
7. The land gate still wins: a plot that is not irrigable or not agricultural returns no crops at all, exactly as in v3.1.
8. Replace the implausible baseline yields (section 4) with FAOSTAT-derived values after D5; until then, hide yield numbers for any crop whose baseline fails the plausibility check (`rice > 10`, `maize > 15`, `coffee > 3` t/ha, and so on, as a table in the rules file).
9. The report and PDF must show the data sources used (FAO EcoCrop, plus FAOSTAT/GBIF/WorldClim when present) with the licence line.

### 7.2 Frontend
- Results page: tabs by category, search box, "show more", and a badge per crop: **ML-verified** (Tier A) or **Climate-envelope match** (Tier B), with a tooltip that explains the difference.
- Show the limiting factor ("Limited by: rainfall — better with irrigation") and the best planting month.
- Never show a yield range for Tier B crops. Show the suitability score and "no yield data for this crop".
- Respect the existing premium theme tokens; no new raw colours.

### 7.3 Country coverage
The scorer uses only coordinates and monthly climate, so any country works. Add a small region test set (section 8) so "works everywhere" is checked, not assumed.

---

## 8. Acceptance criteria

| ID | Criterion | How |
|---|---|---|
| AC-1 | Draw a closed shape, press Confirm → lands on Field Analysis within 2 s, handles gone | Playwright |
| AC-2 | A shape that is still being drawn cannot be confirmed | Playwright + Vitest |
| AC-3 | Selecting or moving the map after Confirm does not un-confirm; editing the shape does, and re-locks steps 4–5 | Vitest |
| AC-4 | Fresh clone: `pytest -q` passes with no `.env` | CI |
| AC-5 | Registry ≥ 2,000 rows, all envelopes ordered, unique ids, valid tiers | pytest (exists) |
| AC-6 | Three climatically different test sites give three different top-8 lists; a hyper-arid site returns fewer than 10 crops | pytest (exists) |
| AC-7 | API response for a Tier B crop contains no yield field | pytest |
| AC-8 | Monthly climatology failure → "unavailable", no ranking, no fallback numbers | pytest |
| AC-9 | After D4, the four "too harsh" spot checks are re-run and the change is reported, good or bad | report |
| AC-10 | After D5, Model D reports pinball loss and P10–P90 coverage on held-out continents; implausible baselines are gone | `model_card.json` |
| AC-11 | Region test set (≥ 12 sites across ≥ 6 continents, 20+ well-known crop/site pairs) hit rate reported per continent | pytest + report |
| AC-12 | `npm run build`, `npm test`, `pytest -q`, Playwright all green, real output pasted in `CHANGELOG.md` | CI |

---

## 9. Runbook (one commit + tag per phase)

**Q0 Truth baseline.** Tag `pre-v3.2`. Run the commands in section 1 and paste real output into `CHANGELOG.md`.

**Q1 Test hygiene (T1–T3).** Gate AC-4.

**Q2 Confirm fix (C1).** Add `confirmBoundary`, remove the `setTimeout`. Turn `stale.repro.test.tsx` into the regression test described in section 2. Gate AC-1 (unit part).

**Q3 Drawing hygiene (C2).** Adopt `extractBoundary`, signature check, finish-action filter, Finish shape button, freeze on Confirm, Edit boundary button. Add Playwright. Gates AC-1 to AC-3.

**Q4 Import the data pack.** Copy files, rebuild the registry, run the new tests. Gate AC-5, AC-6.

**Q5 Climatology + recommender integration (section 7.1).** Gates AC-7, AC-8.

**Q6 Results UI for 1,600 crops (section 7.2).**

**Q7 External data and calibration (D1–D4).** Run on a machine with internet. Gate AC-9.

**Q8 Retrain Tier A (D5) and intercropping (D6).** Gates AC-10, AC-11.

**Q9 Docs and release.** README, `documentation/api_reference.md`, data-sources page with licences, `CHANGELOG.md` with real outputs, tag `v3.2.0`.

Rollback: `git reset --hard <previous-tag>`. Q1–Q3 are independent of Q4–Q8.

---

## 10. Kickoff prompt for Antigravity (paste as-is)

> Read `PRD_v3.2_Confirm_Fix_and_Global_Crops.md` completely and unzip `geoagri_data_pack.zip` over the repo root only when you reach Q4. Run Q0 first and record real output. Execute Q1 → Q9 in order; after each phase run its gate and commit and tag. Fix the Confirm bug exactly as section 2 describes before anything else, and verify it in a real browser with Playwright. Never invent crop, yield, climate or soil values; if a data source cannot be reached, stop and tell me which one. Do not train models on EcoCrop alone. Report `NOT RUN` or `DID NOT FINISH` for anything you did not observe.
