# GeoAgri AI — PRD v3.4: Truthful Data, UI Recovery and a Professional Repository

**Version:** 3.4 · **Date:** 2026-10-28 · **Audited build:** `GeoAgri-main (1)(1).zip` (tag `v3.3.0`) · **Tool:** Antigravity
**Supersedes:** PRD v3.3 for every item below. Earlier PRDs stay in force.
**This file is self-contained:** the two scripts it needs are included in sections 7.2 and 8.

---

## 0. Rules for the coding agent

1. Report only what you ran. Use `NOT RUN` / `DID NOT FINISH` plus the reason. A line in `CHANGELOG.md` that says "verified" without a command and its output is a defect.
2. **A number in a report, a model card or a screen must come from a computation or a source. Never from a literal typed into code.** If it cannot be computed, it is `null` and the screen says "not available".
3. A gate must test the real thing. Deleting code to satisfy a gate is a failure (this happened to the CSS gate, section 2.2).
4. Do not remove a feature to make a test pass. Fix the feature.
5. One commit and one tag per phase (section 10). Run `npm run build`, `npm test`, `npx playwright test`, `pytest -q`, `python scripts/audit_css_classes.py` before each commit.

---

## 1. What I ran on this build

| Check | Result (observed) |
|---|---|
| `npm ci`, `npm run build` | Pass. |
| `npm test` | Pass (23 per changelog; ran green here). |
| `pytest -q`, clean checkout, no `.env`, no `.cache` | **147 passed, 1 failed**: `tests/test_phase7_api.py::test_predict_full_report_e2e` (`assert 0 == 10`). The changelog says 148 passed. |
| CSS class audit (script in 7.2) | **161 classes used by the React code have no CSS rule anywhere** (154 after excluding runtime-built prefixes). |
| `npx playwright test` | NOT RUN by me (no browser in my environment). |
| Your screenshots | GEE error shown next to "Location Analysis Complete", NDVI 0.000, unstyled buttons, ~450 px blank under the map. All four are explained below. |

---

## 2. Defects

### 2.1 Fabricated or misleading results (critical)

| ID | Defect | Evidence |
|---|---|---|
| **H-1** | **Calibration "re-run" is hard-coded.** The four spot-check results are typed into the script, and the report prints them as if measured. | `calibrate_envelopes.py` ~L149–175: `"after": {"score": 0.85 …}`, `0.78`, `0.88`, `0.92`, plus canned status text and `"improved": True`. The changelog says these were "re-ran". |
| **H-2** | **Model B "top-5 hit rate" is a formula, not a measurement.** | `retrain_models.py` L169: `round(min(94.5, 78.0 + coverage * 15.0), 2)`. The values 88–90 % in `model_card.json` come from this. `RandomForestClassifier` is imported but no Model B is trained or evaluated in this script. |
| **H-3** | **Model D has no site information.** Its features are `year` and one-hot `crop`. It cannot react to the user's climate, soil or location. | `retrain_models.py` L126–141 ("Simple feature matrix: year trend + crop dummies"). It is a crop-level yield distribution. Training uses 47 hand-listed countries (`CONTINENT_MAP`). |
| **H-4** | The calibrated registry is not used by the app. | No reference to `registry_calibrated.json` in `backend/app`. Calibration therefore changes nothing the user sees. |
| **H-5** | **Evidence failure returns HTTP 200 full of zeros.** When satellite or weather retrieval fails, `predict.py` builds a complete report with `rainfall 0.0`, `temp 0.0`, `ph 7.0`, `ndvi 0.0`, `elevation 0.0`, `slope 0.0`, `recommended_mode "rainfed"`, `top crop "None (Unverified)" p50 0.0`. `SatelliteFeatures` fields are required floats, so null is impossible. | `predict.py` ~L100–140, `schemas/predict.py` L121. |
| **H-6** | **The UI says "Location Analysis Complete – All 34 satellite, soil, and meteorological layers successfully processed" and "GEE & SoilGrids Verified" unconditionally.** The text is hard-coded, so it appears even when GEE failed. NDVI 0.000 is then shown as "Barren or fallow surface". This is your screenshot. | `FieldAnalysisPage.tsx` L386–389, L419, `interpretNDVI(sat.ndvi)`. |
| **H-7** | Static "Verified" claims elsewhere: "Geodesic Verified", "Verified Field Extent", "WGS84 Geodesic Verified" are printed whether or not the server verified the area. | `SummaryReportPage.tsx` L137, 163, 649; `BoundaryPreviewMap.tsx` L95. |
| **H-8** | **Production runs on mock satellite data.** `render.yaml` sets `GEE_MOCK_FALLBACK: "true"` for the live backend, so the public site can serve simulated values with no label. | `render.yaml` L18. |
| **H-9** | The v3.3 changelog claims for V7/V8 are partly untrue: spot checks "re-ran" (H-1), Model B "validated" (H-2), "148 passed" (1 failure on a clean clone). | `CHANGELOG.md` V7–V9. |

What **is** real and good: the FAOSTAT, GBIF (18,901 points, 72 species) and WorldClim downloads, per-source `SOURCE.md` files, the LOCO validation loop for Model D (pinball loss and coverage are computed from predictions), and plausible baselines now (rice 4.36, maize 3.90, coffee 0.76, cotton 1.75, wheat 2.66, sugarcane 65.7 t/ha).

### 2.2 UI regressions

| ID | Defect | Evidence |
|---|---|---|
| **U-1** | **161 classes have no CSS rule.** Core ones: `btn-primary`, `btn-secondary`, `badge`, `badge-high/low/moderate`, `analysis-complete-banner`, `human-metrics-grid`, `human-metric-*`, `crop-rec-*`, `crop-main-name`, `agri-chatbot-*` (the entire chatbot), `printable-report-area`, `report-table`, `matrix-modal-*`, `pipeline-stage-*`, `processing-*`, `btn-finish-shape`, `btn-edit-boundary`, `btn-replace-yes/no`, `drawing-help-*`. **88 of them were defined in the v3.2.0 stylesheet and were deleted in V6; 73 were never defined** (Tailwind-style utilities such as `mb-2`, `grid-cols-2`, `text-sm`, and a few new component classes). | Audit script, section 7.2. |
| **U-2** | The "index.css under 1,000 lines" gate was met by deleting rules (3,816 → 321 lines) instead of moving them. The duplicate-selector script cannot detect a rule that no longer exists anywhere. | `scripts/check_css_duplicates.py`. |
| **U-3** | **Blank area under the map persists.** `html` and `body` both have `overflow-x: hidden`; that makes `body` the scroll container, so `position: sticky` on `.field-map-column` never sticks. The column scrolls away and leaves empty space beside the long right-hand card. | `styles/base.css` L12, L24; `fieldAnalysis.css` L248–254. |
| **U-4** | Buttons such as "Re-Run Location Analysis" and "Analyse All Crops" render as flat grey rectangles (U-1), and the step bar covers the last lines of content. | Your screenshot. |

### 2.3 Backend and tests

| ID | Defect |
|---|---|
| **K-1** | `test_predict_full_report_e2e` patches the profile but still calls the live climatology service, so it passes only where `backend/.cache/climatology.json` already exists (your machine). Clean clone: fails. |
| **K-2** | Source code contains personal absolute paths: `/Users/lokesh/Desktop/GeoAgri/...` in `irrigability/engine.py`, `landclass/classifier.py`, `landclass/detection.py` (5 places). They leak a username and break on any other machine. |
| **K-3** | Running locally without Earth Engine credentials gives a 200 response full of zeros (H-5) instead of a clear "setup required" state. |

### 2.4 Repository hygiene (what the GitHub page shows)

Root has 17 entries mixed together: three PRD files, `geoagri_data_expansion_training_prompt.md` (an AI prompt), `DATA_GUIDE.md`, `run.md`, both `documentation/` and no `docs/`, an unused `api/` folder (`vercel.json` routes `/api` to Render, so `api/index.py` is dead), no `LICENSE`, 49 tags (most are internal `phase-*` markers), a 600-line emoji README with duplicated numbering (two "### 5."), `file:///Users/lokesh/...` image links in the results docs (broken on GitHub), 12 MB of screenshots, a 10 MB generated `faostat_yields.parquet`, and a 3 MB `registry_calibrated.json` nothing reads.

---

## 3. Fixes — honesty (H-1 to H-9)

### 3.1 Calibration (H-1, H-4)
1. In `calibrate_envelopes.py` **delete the literal `spot_checks` block**. Compute each spot check by calling `score_crop` twice (EcoCrop envelope and calibrated envelope) on the monthly climate of the named place, using the same fixture file as the tests (`backend/tests/fixtures/spot_climates.json`, labelled "approximate textbook climates, test input only").
2. Write the real before/after numbers to `calibration_report.json`, whether they improve, stay or get worse. `"improved"` is computed (`after > before + 0.05`), never typed.
3. The calibration may only widen an envelope when ≥ 100 occurrences and the outside-share is > 15 % **and** the widened value is a GBIF percentile (5th or 95th), recorded per species. Add `envelope_source` and `n_occurrences` to every adjusted species.
4. Decide, and record in the report: **either** wire `registry_calibrated.json` into `get_global_registry()` behind `USE_CALIBRATED_ENVELOPES=true` (default true after the spot checks are real and no previously correct check gets worse), **or** delete the calibrated file and the claim. No half state.
5. Test: `grep -n '"score": 0\.' backend/ml/training/*.py` returns nothing.

### 3.2 Model D and Model B (H-2, H-3)
**Model D.** Choose one and record it in the model card:
- **(a) Relabel now (required).** In the API and UI it is "Regional yield benchmark (FAOSTAT, crop-level)", not a field-specific forecast. The yield card shows the P10/P50/P90 range with a one-line explanation "based on national statistics for this crop; not adjusted to your field".
- **(b) Make it site-aware (stretch, only if it passes the gate).** Add country-level climate covariates (WorldClim BIO1, BIO12 at each country's cropland centroid) and soil. Accept only if the new model beats the crop-and-year baseline by ≥ 5 % mean pinball loss under leave-one-continent-out, and P10–P90 coverage stays within 75–85 %.
- Remove the hand-picked `CONTINENT_MAP` of 47 countries: map every FAOSTAT area with `pycountry-convert` or a committed UN M49 table; list unmapped areas in the report.

**Model B.** Delete the formula. Replace it with a real metric, computed:
1. For each country with ≥ 5 reported crops, take the country's 5 crops with the largest mean harvested area (1990–latest).
2. Score every crop for that country's cropland-centroid monthly climate with `score_crop` (WorldClim monthly `tavg`, `prec`), rank, and compute **top-5 hit rate** and **mean reciprocal rank** against step 1.
3. Report per continent, plus the same metric for a trivial baseline ("globally most-grown crops") so the number has context.
4. If Model B is not trained, say so: the model card lists it as "rule-based envelope ranking", and `crop_recommendation_model.joblib` is either re-trained in the script with its metrics computed, or removed from the repo and from the API's `model_status`.
5. Test: a model card builder test that fails if any metric is assigned from a numeric literal or a formula of other metrics.

### 3.3 Evidence failure contract (H-5, K-3)
1. Make every numeric field in `EnvironmentSummary`, `SatelliteFeatures`, `YieldSummary`, `ProductionSummary`, `IrrigationSummary`, `ClimateRiskSummary` `Optional` (`None`).
2. Add `analysis_status: Literal["complete","partial","unavailable"]` and `sources: list[{name, state: "ok"|"failed"|"skipped", reason, fetched_at}]` to `FullReportResponse`.
3. If satellite/weather/soil retrieval fails: **HTTP 200** only when at least one source succeeded (`partial`, with nulls for what failed). If nothing could be retrieved: **HTTP 503** with `{"code":"EVIDENCE_UNAVAILABLE","missing_sources":[...],"setup_hint":"..."}` where `setup_hint` for Earth Engine names the environment variables to set (section 3.5). Never a zero, never `ph 7.0`, never `"rainfed"` as a default.
4. Tests: with Earth Engine unavailable, the response has `analysis_status != "complete"`, no field equals `0.0` that was not measured, and a 503 carries the setup hint. A scan test fails on the literals `ph=7.0`, `ndvi=0.0`, `rainfall_mm=0.0` inside `app/api`.

### 3.4 Truthful UI text (H-6, H-7)
1. Remove the hard-coded banner. Generate it from the response:
   - `complete`: "Analysis complete. {n_ok} of {n_total} data layers retrieved for {lat}°N, {lon}°E."
   - `partial`: amber "Partial analysis. {n_failed} data layers could not be retrieved: {names}." with a Retry button.
   - `unavailable`: red "Analysis unavailable" card with the `setup_hint`, no numbers, no "Analyse All Crops" button.
2. Replace "GEE & SoilGrids Verified" with a row of source chips built from `sources[]` (green ok, red failed, grey skipped) with a tooltip of the reason and fetch time.
3. `MetricCard` renders "Not available" for a `null` value and never calls `interpretNDVI` on it.
4. "Geodesic Verified" / "Verified Field Extent" appear only when `areaSource === 'server'`; otherwise "Area estimated in browser".
5. Playwright: with the API mocked to fail, the page shows the red card, no `0.000` anywhere, and no "Complete".

### 3.5 Data mode and the live site (H-8)
1. Add `data_mode: "live" | "demo_synthetic"` to the report (`demo_synthetic` iff `GEE_MOCK_FALLBACK` or `ALLOW_SYNTHETIC_DATA` produced any value).
2. When `demo_synthetic`, show a persistent amber ribbon on every page: "Demo data: satellite values are simulated and not real measurements." The PDF report carries the same line on every page.
3. `render.yaml`: remove `GEE_MOCK_FALLBACK: "true"`. Either configure a real service account (`GEE_SERVICE_ACCOUNT_EMAIL` plus `GEE_PRIVATE_KEY_JSON` as a Render secret, never in git), or set the demo flag explicitly **and** accept the ribbon. Document both in the README.
4. Local run without credentials shows the red "Analysis unavailable" card with the exact variables to set; a developer who wants to explore the UI can set `ALLOW_SYNTHETIC_DATA=true` in `backend/.env` and sees the demo ribbon.

### 3.6 Changelog (H-9)
Add a correction entry at the top of `CHANGELOG.md` listing H-1, H-2, H-3, H-9 and what was actually measured. Do not edit history; append.

---

## 4. Fixes — UI recovery (U-1 to U-4)

### 4.1 Restore the missing rules (U-1, U-2)
1. Recover the 88 deleted rules from the last good stylesheet: `git show v3.2.0:frontend/src/index.css > /tmp/old-index.css` (also `git show v3.2.0:frontend/src/styles/components/*.css` if present).
2. Port each rule for a class reported by `scripts/audit_css_classes.py` into the matching file under `frontend/src/styles/components/` (e.g. `chatbot.css`, `fieldAnalysis.css`, `cropCards.css`, `report.css`, `modal.css`), rewriting colours, radii, spacing and shadows to the tokens in `styles/tokens.css`. No raw hex values.
3. The 73 never-defined classes: replace Tailwind-style utilities (`mb-2`, `p-4`, `grid-cols-2`, `text-sm`, `font-bold`, `uppercase`, `flex-wrap`, `gap-2`, `shrink-0`, …) with semantic classes, **or** add a small `styles/utilities.css` that defines exactly the utilities in use (spacing scale from the `--sp-*` tokens, text sizes from the type scale, weights, flex/grid helpers). Define the new component classes: `btn-finish-shape`, `btn-edit-boundary`, `btn-replace-yes`, `btn-replace-no`, `drawing-help-banner`, `drawing-help-content`, `boundary-preview-canvas`, `metric-icon-slot`, `theme-toggle-label`, `printable-report-area`, `animate-spin`, `text-muted`, `text-capitalize`.
4. Runtime-built classes (`ui-btn-${variant}`, `badge-${level}`, `rank-${n}`, `detection-badge-${x}`, `ui-toast-${kind}`, `ui-icon-btn-${size}`): list every value the code can produce in the component's test and assert a rule exists for each.
5. **Gate:** `python scripts/audit_css_classes.py` exits 0. Add it to `.github/workflows/ci.yml` and to `scripts/verify.sh`. Delete `scripts/check_css_duplicates.py` (replaced).
6. Visual regression: Playwright screenshots of `#boundary`, `#analysis`, `#crops`, `#report` at 1440×900 and 390×844, compared to the baselines committed in `docs/screenshots/` (threshold 1 %).

### 4.2 Screen fit (U-3, U-4)
1. In `styles/base.css` **remove `overflow-x: hidden` from `html`**, and replace it on `body` with `overflow-x: clip` (does not create a scroll container, so sticky works). Fix any real horizontal overflow at its source instead.
2. **Do not depend on sticky for the Field Analysis layout.** Restructure `FieldAnalysisPage`:
   - **Row 1:** `.top-grid` with two columns that always have equal height: the map (left) and the Selected Field panel (right). `align-items: stretch`; the map column is `display:flex; flex-direction:column`; the map container is `flex:1; min-height: 460px`. The footer line "N corners · X ha · Edit Boundary" sits under the map.
   - **Row 2 and below:** everything else (Land Suitability, status banner, environmental metrics, tables) in **full-width** sections stacked under row 1. Nothing is placed beside a tall card, so no empty column can appear at any viewport width.
3. `padding-bottom: calc(var(--step-bar-h) + 24px)` on the page container so the floating step bar never covers the last line.
4. Boundary Studio keeps the `100dvh - var(--app-header-h)` rules from v3.3 §3.5.
5. Playwright (four viewports): no horizontal scrollbar; on `#analysis` the map's bottom edge and the Selected Field panel's bottom edge differ by < 24 px; the last element on every page is fully visible above the step bar.

---

## 5. Fixes — backend and tests (K-1, K-2)

1. `test_predict_full_report_e2e`: patch `app.api.v1.predict.fetch_monthly_climatology` with a fixture result (source `"TEST_FIXTURE"`). Run the whole suite with `backend/.cache` deleted and with `unshare -n` or the socket block active. Gate: `rm -rf backend/.cache && pytest -q` passes.
2. Replace every `/Users/lokesh/...` path with paths relative to `Path(__file__).resolve().parents[n]`, or with a setting (`GEOAGRI_DATA_ROOT`, default `backend/ml/data`). Gate: `grep -rn "/Users/\|C:\\\\Users" backend frontend/src scripts .github` returns nothing.
3. Add `GET /api/v1/health/sources` returning the state of each data source (Earth Engine credentials present and initialised, NASA POWER reachable, SoilGrids reachable, rule files loaded, registry loaded, model files loaded) with no secrets. The Workspace page shows these as chips, so a missing credential is visible before the user draws anything.
4. CI: run from a clean clone, Python 3.11 and 3.12, Node 20.

---

## 6. Acceptance criteria

| ID | Criterion | Verified by |
|---|---|---|
| AC-1 | `grep -n '"score": 0\.' backend/ml/training/*.py` → nothing; calibration before/after is computed and reproducible | script + report |
| AC-2 | `model_card.json` has no metric produced by a literal or by a formula of other metrics; Model B hit rate has a baseline next to it | pytest |
| AC-3 | Model D is labelled "Regional yield benchmark" everywhere unless it passes the 5 % gate in 3.2(b) | grep + Playwright |
| AC-4 | With Earth Engine unavailable: API returns 503 `EVIDENCE_UNAVAILABLE` with a setup hint (nothing succeeded) or `partial` with nulls (something succeeded); no invented zeros | pytest |
| AC-5 | UI never shows "complete" or "Verified" when a source failed; no `0.000` for missing data | Playwright with mocked failure |
| AC-6 | `data_mode: demo_synthetic` shows the persistent ribbon on every page and in the PDF | Playwright |
| AC-7 | `render.yaml` has no mock flag unless the ribbon is accepted and documented | grep |
| AC-8 | `python scripts/audit_css_classes.py` exits 0; CI runs it | CI |
| AC-9 | Screenshot comparison at 1440×900 and 390×844 for four pages within 1 % of the committed baselines | Playwright |
| AC-10 | `#analysis` at 1280×720, 1440×900, 1920×1080, 390×844: no horizontal scroll, map and Selected Field heights within 24 px, no empty column | Playwright |
| AC-11 | `rm -rf backend/.cache && pytest -q` passes; no `/Users/` path anywhere | CI |
| AC-12 | Repository structure matches section 8 exactly; root has ≤ 12 entries | script + `ls` |
| AC-13 | README matches the outline in 8.3 and every command in it was run | review |
| AC-14 | `npm run build`, `npm test`, `npx playwright test`, `pytest -q` all green; real output in `CHANGELOG.md` | CI |

---

## 7. Scripts

### 7.1 Nothing to install
Both scripts use only Python 3 and bash.

### 7.2 `scripts/audit_css_classes.py` (tested: prints the 154 missing classes today, exits 1)
```python
#!/usr/bin/env python3
"""
Fail if a CSS class used in the React code has no rule in any stylesheet.
Run from the repo root:  python scripts/audit_css_classes.py
"""
import re, sys
from pathlib import Path

SRC = Path("frontend/src")
# Classes built at runtime from a prefix (e.g. `ui-btn-${variant}`): checked by the Playwright run instead.
DYNAMIC_PREFIXES = ("ui-btn-", "ui-badge-", "ui-toast-", "ui-icon-btn-", "badge-", "rank-", "detection-badge-")

css = "".join(p.read_text(errors="ignore") for p in SRC.rglob("*.css"))
defined = set(re.findall(r"\.([A-Za-z_][\w-]*)", css))

used = {}
for p in SRC.rglob("*.tsx"):
    text = p.read_text(errors="ignore")
    for m in re.finditer(r'className=(?:"([^"]+)"|\{`([^`]+)`\})', text):
        raw = re.sub(r"\$\{[^}]*\}", " ", m.group(1) or m.group(2))
        for c in raw.split():
            if re.fullmatch(r"[A-Za-z_][\w-]*", c) and c not in DYNAMIC_PREFIXES:
                used.setdefault(c, set()).add(p.name)

missing = {c: f for c, f in used.items() if c not in defined}
for c in sorted(missing):
    print(f"MISSING  .{c:36s} {', '.join(sorted(missing[c]))}")
print(f"\n{len(used)} classes used, {len(missing)} without a rule")
sys.exit(1 if missing else 0)
```

---

## 8. Repository clean-up

### 8.1 Target structure
```
GeoAgri/
├── .github/workflows/ci.yml
├── .gitignore
├── CHANGELOG.md
├── LICENSE                     (new; section 8.4)
├── README.md                   (rewritten; section 8.3)
├── docker-compose.yml
├── render.yaml
├── vercel.json
├── backend/                    (app/, ml/, tests/, requirements.txt, Dockerfile, .env.example)
├── frontend/                   (src/, e2e/, package.json, ...)
├── docs/
│   ├── architecture.md
│   ├── api_reference.md
│   ├── data-guide.md
│   ├── running-locally.md
│   ├── model-cards/
│   ├── results/                (with assets/, relative image links)
│   ├── screenshots/            (4 curated images, each under 250 KB)
│   └── prd/                    (project history: PRD v1, v3.2, v3.3, v3.4)
└── scripts/                    (verify.sh, audit_css_classes.py, download_faostat.py, probe_external_sources.py)
```
Root goes from 17 entries to 10 files and folders.

### 8.2 `scripts/cleanup_repo.sh` (dry-run tested on a copy of this repo: it ran clean, renames show as `R` in `git status`)
Save as `scripts/cleanup_repo.sh`, run **once** from the repo root on a clean working tree, review `git status`, then commit. It uses `git mv` and `git rm` only.
```bash
#!/usr/bin/env bash
# GeoAgri repository clean-up. Run from the repository root on a clean git tree.
# Safe: uses git mv / git rm only, stops on the first error, and changes nothing outside git's index.
set -euo pipefail

[ -d .git ] || { echo "Run from the repository root (no .git here)"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "Commit or stash your changes first"; exit 1; }

mv_if() { [ -e "$1" ] && { mkdir -p "$(dirname "$2")"; git mv "$1" "$2"; echo "moved  $1 -> $2"; } || echo "skip   $1 (not found)"; }
rm_if() { [ -e "$1" ] && { git rm -rq "$1"; echo "removed $1"; } || echo "skip   $1 (not found)"; }

# 1. Planning documents leave the root and become project history
mkdir -p docs/prd
mv_if PRD.md                                          docs/prd/PRD_v1_baseline.md
mv_if PRD_v3.2_Confirm_Fix_and_Global_Crops.md        docs/prd/PRD_v3.2_Confirm_Fix_and_Global_Crops.md
mv_if PRD_v3.3_Audit_Fixes_Layout_and_Recommender.md  docs/prd/PRD_v3.3_Audit_Fixes_Layout_and_Recommender.md

# 2. Guides move under docs/
mv_if DATA_GUIDE.md   docs/data-guide.md
mv_if run.md          docs/running-locally.md

# 3. "documentation/" becomes "docs/" (one documentation folder, not two)
for f in architecture.md api_reference.md; do mv_if "documentation/$f" "docs/$f"; done
mv_if documentation/model_cards docs/model-cards
mv_if documentation/result      docs/results
mv_if documentation/screens     docs/screenshots

# 4. Files that are AI prompts, not project documentation
rm_if geoagri_data_expansion_training_prompt.md

# 5. Dead code: vercel.json sends /api to Render, so this Vercel function is never used
rm_if api

# 6. Generated or unused artefacts that should not live in git
rm_if backend/ml/data/processed/faostat_yields.parquet     # 10 MB, rebuilt by load_faostat.py
rm_if backend/ml/data/processed/registry_calibrated.json   # 3 MB, not read by the app

# 7. Local-machine image links in the results docs become relative links
if [ -d docs/results ]; then
  grep -rl "file:///Users/" docs/results | while read -r f; do
    sed -i.bak -E 's#file:///Users/[^)]*/documentation/result/assets/#assets/#g' "$f" && rm -f "$f.bak"
    echo "fixed  image links in $f"
  done
fi

# 8. Keep generated files out of git from now on
{
  echo ""
  echo "# Generated data (rebuild with backend/ml/training/*)"
  echo "backend/ml/data/processed/*.parquet"
  echo "backend/ml/data/processed/registry_calibrated.json"
  echo "backend/.cache/"
  echo "frontend/test-results/"
  echo "frontend/playwright-report/"
} >> .gitignore
git add .gitignore

echo ""; git status --short | head -60
echo "Now run: git commit -m 'chore: professional repository structure'"
```
**References the script cannot fix; the agent must update them in the same commit:**
- `backend/ml/training/generate_result_charts.py` lines 4 and 22: `documentation/result/assets` → `docs/results/assets`.
- `frontend/e2e/layout-fit.spec.ts` line 11: `../documentation/screens` → `../docs/screenshots`.
- `backend/ml/data/scripts/download_datasets.py` lines 15, 209, 211: `DATA_GUIDE.md` → `docs/data-guide.md`.
- `README.md` line 566 and the whole README (section 8.3); `docs/data-guide.md` first lines ("next to `PRD.md`").
- `backend/ml/training/load_faostat.py` and `retrain_models.py`: if the parquet is missing, print "Run `python backend/ml/training/load_faostat.py` first" instead of a stack trace.

### 8.3 README rewrite (the "update README.md" step)
Replace the current 600-line README with at most **250 lines**, plain headings (no emoji in headings), in this order. Every command in it must be run by the agent and pasted into `CHANGELOG.md`.
1. **Title, one-sentence description, badges** (CI status, licence, Python, Node), and one screenshot (`docs/screenshots/…boundary…`).
2. **What it does** (5 bullets): draw a field, check what the land is, irrigability verdict, crop ranking for any country, yield benchmark and risk, PDF report.
3. **Screenshots** (3 images in a row, from `docs/screenshots/`).
4. **How it works**: the 5-step flow and a short architecture diagram (Mermaid), linking to `docs/architecture.md`.
5. **Data and models, honestly**: a table of every source (EcoCrop, FAOSTAT, GBIF, WorldClim, NASA POWER, SoilGrids, ESA WorldCover, Copernicus DEM, Earth Engine datasets) with licence and what it is used for; a **Limitations** list: crop suitability is an envelope screen, yields are national benchmarks (until 3.2(b)), drawn boundaries are not survey boundaries, results need real satellite credentials, demo mode is simulated.
6. **Quick start** (local, 6 commands): clone, backend venv + `pip install`, copy `.env.example`, start API, `npm ci`, `npm run dev`. Then **Run with Docker** (2 commands).
7. **Configuration**: one table of environment variables (name, required, default, meaning) including `GEE_SERVICE_ACCOUNT_EMAIL`, `GEE_PRIVATE_KEY_JSON`, `ALLOW_SYNTHETIC_DATA`, `GEE_MOCK_FALLBACK`, `LAND_DETECTION_MODE`, `LAND_GATE_MODE`, `VITE_*`; and a short **Earth Engine setup** (create service account, enable Earth Engine API, register the project, set two variables), plus "No credentials? Set `ALLOW_SYNTHETIC_DATA=true` to explore with clearly labelled demo data."
8. **Project structure**: the tree from 8.1 (accurate, 25 lines max).
9. **API**: the three main endpoints with one request/response example each, link to `docs/api_reference.md`.
10. **Testing**: the four commands (`pytest -q`, `npm test`, `npx playwright test`, `python scripts/audit_css_classes.py`) and what each covers.
11. **Deployment**: Render (backend) and Vercel (frontend) in ten lines, link to `docs/running-locally.md`.
12. **Project history**: link to `docs/prd/` and `CHANGELOG.md`.
13. **Licence and acknowledgements**: licence name, data attributions (FAO, GBIF, WorldClim, ESA, ISRIC, NASA, Copernicus), and a note that FAOSTAT-derived files are under CC BY-NC-SA 3.0 IGO.
Rules: no marketing adjectives, no claim without a source, no counts that can drift (no "148 tests", no "78 layers" unless generated from code), no absolute paths, no screenshots larger than 250 KB.

### 8.4 Other repository tasks
1. **LICENSE.** Add one. The author chooses; MIT or Apache-2.0 are the usual choices for the code. State in the README that data files keep their own licences, and that **FAOSTAT-derived data (CC BY-NC-SA 3.0 IGO) restricts commercial use**; decide whether the trained yield artefacts can be shared under the project licence, and record the decision.
2. **Screenshots.** Keep four: boundary, analysis, crops (1440×900) and one mobile (390×844). Compress each to under 250 KB (`oxipng -o4 --strip all`, or convert to WebP). Delete the other eight from `docs/screenshots/`. Playwright writes its comparison baselines under `frontend/e2e/__screenshots__/` instead.
3. **Tags.** Keep the release tags (`v1.0.0` … `v3.3.0`, `v3.4.0`). Delete the internal `phase-*`, `pre-*` tags locally and on GitHub: `git tag -l 'phase-*' 'pre-*' | xargs -r git tag -d` then `git tag -l 'phase-*' 'pre-*' | xargs -r -n1 git push origin --delete`. Write `docs/releases.md` mapping each kept tag to one line.
4. **Commit messages from now on:** `type(scope): subject` (`fix(ui): …`), no "file" or "chore: minor script formatting" without a subject.
5. **GitHub repository page:** set the description to one sentence, add the website link, keep the topics, enable Issues, add a short `CONTRIBUTING.md` (setup, tests, commit style) and a `SECURITY.md` ("never commit keys; report privately").
6. **Secrets check:** run `git log -p | grep -iE "private_key|BEGIN PRIVATE|apikey|secret"`; if anything appears, rotate it. Confirm `backend/.env` and any service-account JSON are not tracked.
7. **Large files:** after step 2 of the script no file in git exceeds 3 MB. Model files (`*.joblib`, 6 MB) may stay; if they grow, move to Git LFS.

---

## 9. Test list that must exist

Backend (offline, clean clone): calibration spot checks computed, no literal scores; model-card builder rejects literal metrics; Model B top-5 metric with baseline on a small fixture; evidence-failure contract (503 with hint, `partial` with nulls, no invented zeros); scan test for `ph=7.0`/`0.0` literals in `app/api`; `data_mode` flag; `/health/sources` shape; no `/Users/` strings; the e2e predict test with the fixture climatology.
Frontend (Vitest): banner text per `analysis_status`; `MetricCard` null rendering; "Verified" shown only for server area; every dynamic class variant has a rule.
Playwright: failure mock shows the red card; demo ribbon; four viewports on `#analysis`; screenshot comparison; the existing drawing scenarios.

---

## 10. Runbook (one commit and one tag per phase)

**W0 Truth baseline.** Tag `pre-v3.4`. Clean clone, no `.env`, no `.cache`; run every command in section 1 and paste real output, including the failing test.

**W1 Honesty in the training scripts (3.1, 3.2, 3.6).** Computed calibration, real Model B metric, Model D relabel, corrected changelog. AC-1 to AC-3.

**W2 Evidence contract and truthful UI (3.3, 3.4, 3.5).** AC-4 to AC-7.

**W3 CSS recovery (4.1).** Audit script green; screenshots. AC-8, AC-9.

**W4 Layout (4.2).** AC-10.

**W5 Backend and tests (section 5).** AC-11.

**W6 Repository clean-up (8.1, 8.2, 8.4).** Run `scripts/cleanup_repo.sh`, update the listed references, LICENSE, screenshots, tags. AC-12.

**W7 README and docs (8.3).** AC-13.

**W8 Optional: site-aware Model D (3.2b).** Only if time permits; accept or reject by the gate and say which.

**W9 Release.** All gates green, real output in `CHANGELOG.md`, tag `v3.4.0`, GitHub release notes.

Rollback: `git reset --hard <previous-tag>`; W3 to W5 do not depend on W1, W2 or W6.

---

## 11. Kickoff prompt for Antigravity (paste as-is)

> Read `PRD_v3.4_Truthful_Data_UI_Recovery_and_Repo_Cleanup.md` completely. Run W0 first from a clean clone (no `backend/.env`, no `backend/.cache`) and record real results, including the one failing test. Then execute W1 to W9 in order; after each phase run its gate, commit and tag. Never type a result, a score or a metric into code and present it as measured: delete the hard-coded calibration spot checks and the Model B hit-rate formula, and compute real values or write `null`. Never return zeros for data that could not be retrieved; use the evidence contract in section 3.3. Restore the 161 missing CSS rules from `git show v3.2.0:frontend/src/index.css` into the component stylesheets using design tokens, and make `python scripts/audit_css_classes.py` exit 0. Fix the Field Analysis layout exactly as section 4.2 says (no reliance on `position: sticky`). Run `scripts/cleanup_repo.sh` once on a clean tree, then fix the references listed in 8.2. Rewrite `README.md` to the outline in 8.3 and run every command you put in it. Report `NOT RUN` or `DID NOT FINISH` for anything you did not observe.
