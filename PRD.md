# GeoAgri AI — PRD v3.1: Audit Fixes + Full Implementation of Boundary Studio, Premium UI and Detection Gate

**Version:** 3.1 · **Date:** 2026-10-24 · **Supersedes:** PRD v3.0 for every item marked ❌ or ⚠ below. v3.0 items marked ✅ stay as built. PRD v2.1 (data honesty, evidence gate, no scraping, no personal data) stays in force.
**Audited build:** `GeoAgri-integrate-detection.zip` · **Tool:** Antigravity

---

## 0. Rules for the coding agent (non-negotiable)

1. **Report only what you observed.** If a command was not run or did not finish, write `NOT RUN` / `DID NOT FINISH` plus the reason in `CHANGELOG.md`. Never write "done", "restyled" or "N passed" for something you did not run. (The current changelog claims a full restyle and "116 passed"; the restyle did not happen, §2.)
2. **No hidden defaults** for location, area, soil, weather, or satellite values anywhere, including inside error/"not irrigable" responses.
3. **Tested code must be shipped code.** A unit test may only cover a module the app actually imports at runtime. Dead code is deleted, not tested.
4. **A gate is a command, not an opinion.** A phase is complete only when its listed command prints the stated result.
5. Do not change ML models, `agronomic_rules.yaml` thresholds, or scraping policy. Do not scrape Bhoomi / e-Swathu / Dishaank / K-GIS.
6. One commit + one git tag per phase (§12). Run `npm run build`, `npm test`, and the backend tests that apply before each commit.

---

## 1. What I ran

| Check | Result (observed) |
|---|---|
| `npm ci` | OK. `maplibre-gl 6.10.0`, `terra-draw ^1.38`, `terra-draw-maplibre-gl-adapter ^1.5` all install. (The v3.0 worry about the maplibre version is closed.) |
| `npm run build` | **Passes.** Single JS chunk **1 994 kB** (561 kB gzip); Vite warns >500 kB. No code splitting. |
| `npm test` | **7 passed** (2 files: `boundaryMath`, `useBoundaryDraw`). |
| `pytest tests/test_field_area_validation.py` | **6 passed.** |
| Full `pytest tests` | **DID NOT FINISH** in my sandbox after ~8 min (no output, process still running). The changelog's "116 passed in 72 s" is therefore **unverified**. Likely cause: tests that reach the network (detection/remote COG/tiles). Must be fixed: §6 B7. |
| Lighthouse / axe / Playwright | NOT RUN (none exist in the repo). |

---

## 2. Audit result — v3.0 gates

| Gate | Result | Evidence |
|---|---|---|
| G-D1 no preset/default coordinates in app code | ✅ | Matches only in `*.test.ts`. Gate command must exclude tests. |
| G-D2 no file import, no `zzz.GeoJSON` | ✅ | Handler, button and file removed. |
| G-D3 Leaflet removed | ✅ | Not in `package.json`, `index.html` or `src`. |
| **G-T1** no raw colours in TSX | ❌ | **384** matches (e.g. `new maplibregl.Marker({ color: '#22c58b' })`). |
| **G-T2** inline styles ≤ 40 | ❌ | **865** `style={{` occurrences. |
| G-B1 backend area validation | ✅ | 6 tests pass; 422 codes implemented. |
| AC-9 / theme work (P6) | ❌ | `index.css` is **unchanged** (3 816 lines) and uses **0** new tokens. `tokens.css` only aliases old names to new ones. Only `WorkspacePage` and the new Studio use the new look. The changelog line "Phase P6 & P7 Restyle" overstates this. |
| Code-splitting / perf (§6.7) | ❌ | No `React.lazy`; one 1.99 MB chunk. |
| Accessibility checks | ❌ | Not run; no live region, no axe run. |

---

## 3. Audit result — Boundary Studio defects

| ID | Sev | Defect | Where |
|---|---|---|---|
| **S1** | HIGH | **Terra Draw is installed but never imported.** `BoundaryMap.tsx` (545 lines) is a hand-rolled click/mouse engine with its own history stack. PRD §5.2 asked for Terra Draw (or a documented fallback). | `BoundaryMap.tsx`, `package.json` |
| **S2** | HIGH | **`useBoundaryDraw.ts` and its 3 tests are dead code.** No component imports it. The shipped undo/redo (`undoTrigger`/`redoTrigger` counters inside `BoundaryMap`) is untested. | `useBoundaryDraw.*` |
| **S3** | HIGH | **Missing editing features:** no midpoint insert (FR-B2), no vertex delete (FR-B2/B14: Delete/Backspace/long-press), no Enter-to-finish, Esc only switches tool (does not cancel an in-progress shape), no Move-whole-polygon tool, no snapping to first vertex/existing vertices (FR-B4), no rubber-band edge, no single-polygon replace prompt (FR-B8), no per-edge length labels. | `BoundaryMap.tsx`, `BoundaryStudioPage.tsx` |
| **S4** | HIGH | **Server validation failure is swallowed.** `handleConfirm` catches every `fetchFieldArea` error with `console.warn` and proceeds with the client estimate. A server 422 (`SELF_INTERSECTION`, `TOO_LARGE`…) therefore does **not** block Confirm, and "unverified" is not stored or shown in the report. | `BoundaryStudioPage.tsx` |
| **S5** | HIGH | **Error code is lost.** FastAPI returns `{"detail":{"code","message"}}`; `fetchFieldArea` reads `errData.code` (undefined) and then stringifies `errData.detail`, so `AreaValidationError.code` is never set and the user would see raw JSON. | `api/client.ts`, `api/v1/field.py` |
| **S6** | MED | **A polygon vertex is sent as the "point".** On confirm: `pointPt: pinCoords \|\| polygonCoords[0]`. The first drawn corner then drives lat/lon for weather/soil/climate. The same bug exists in the context helper (`polygonPts[0]`). Must be the polygon **centroid**. | `BoundaryStudioPage.tsx`, `WorkflowContext.tsx` |
| **S7** | MED | **Editing after confirm does not re-lock later steps** (AC-7). Context is updated only on Confirm, so a stale report stays reachable while the user edits. | `BoundaryStudioPage.tsx`, context |
| **S8** | MED | **`plot_name` and `boundary_source` never leave the browser.** Only a type field exists in `client.ts`; the payload builder does not send them, so `boundary_source:"drawn"` / the "Boundary drawn by user" report line cannot work. (Backend computes `boundary_source` itself from `polygon`/`point`.) | `client.ts`, context |
| **S9** | MED | **Step 3 gate = "any polygon with ≥3 points"**, not `confirmed`. Currently safe only because context is written on Confirm; fragile. | `WorkflowContext.tsx` |
| **S10** | LOW | Circle uses **32** vertices (PRD said 64). Freehand simplification/200-vertex cap, 500-vertex output cap, antimeridian rejection: not found. Pin marker colour is a raw hex. | `BoundaryMap.tsx` |
| **S11** | LOW | No live-region announcement, no `aria-pressed` verification, no keyboard help popover (`?`). | Studio |
| **S12** | LOW | Frontend tests cover only math + the dead hook. No context-gating test, no Playwright smoke test. | `src/**/*.test.*` |

## 4. Audit result — Detection / land-intelligence defects

(Build is the "integrate-detection" branch: detection is called from `predict.py` and `land.py`; verdicts depend on two modes.)

| ID | Sev | Defect | Where |
|---|---|---|---|
| **B1** | **CRITICAL** | **Default modes make the feature inert.** `LAND_DETECTION_MODE="shadow"` and `LAND_GATE_MODE="shadow"`. In `shadow`, the classifier ignores detection evidence (`if det_mode == "enforce" …`) and the NOT-IRRIGABLE gate never blocks (`and gate_mode == "enforce"`). Out of the box, forest/urban/water plots still receive crop lists. | `core/config.py`, `predict.py` |
| **B2** | HIGH | **Hidden defaults in the "not irrigable" response:** `ph=s.get("ph", 7.0)`, `rainfall_mm … 0.0`, `temp … 0.0`, `humidity … 0.0`, etc. Missing data is shown as real zeros. Violates v2.1 §0.2/§0.3. | `predict.py` (gate branch) |
| **B3** | HIGH | **Provenance partly invented:** `layers[]` marks WorldCover, DEM, Sentinel-2 and HydroLAKES `"checked"` whenever *any* satellite value is non-empty, rather than from what detection actually queried (`detection.sources`). `observed_feature_share` counts `v != 0.0` as "not observed". Notes claim "derived from 30 m DEM / Sentinel-2" on the same basis. | `land.py` |
| **B4** | HIGH | **Silent failure:** `land.py` wraps detection in `except Exception: pass`; `predict.py` logs a warning and continues as if detection were fine. The user gets a verdict with no sign detection failed. | `land.py`, `predict.py` |
| **B5** | MED | **Blanket 500 with message echo** in `land.py` (`detail=f"Land enquiry error: {str(e)}"`). `predict.py` is better (request id) — make both the same. | `land.py` |
| **B6** | MED | **Blocking I/O in async handlers:** `detection.py` uses `requests.get/post` (lines ~433, 475, 592) inside the request path. One slow source stalls the event loop. | `landclass/detection.py` |
| **B7** | MED | **Full backend suite does not finish offline** (§1). Tests must never touch the network. | `backend/tests` |
| **B8** | MED | **Deprecated shim still exported:** `services/geo/area_check.py` re-exports detection with its own constants (`MAX_SLOPE_DEG=15`, `MAX_ELEVATION_M=4000`, `FOREST_MAX_FRACTION=0.5`) — duplicates thresholds that must live only in YAML (v2.1 D4/D10). | `area_check.py` |
| **B9** | LOW | Starlette deprecation warning (`HTTP_422_UNPROCESSABLE_ENTITY`). | `field.py` |
| ✅ | — | **Fixed since v2.1:** providers no longer return hard-coded `AGRICULTURAL` records; `user_document` no longer defaults to `AGRICULTURAL`; classifier and irrigability read YAML; FOREST_COVER / FOREST_LEGAL separated; plantation guard exists; `to_legacy_area_check` alias returned. Keep. |

---

## 5. Frontend implementation requirements (replaces v3.0 §4–§6 where noted)

### 5.1 Drawing engine — single source of truth (fixes S1–S3, S10)
- **Adopt Terra Draw** (already installed). Delete the hand-rolled click/mousedown/mousemove logic in `BoundaryMap.tsx`. Modes: `polygon`, `rectangle`, `circle`, `freehand`, `select` (draggable features, draggable + deletable coordinates, **midpoints enabled**), `point`.
- `useBoundaryDraw` becomes the **only** owner of boundary state and history (50-step snapshot stack). `BoundaryMap` receives the draw instance via the hook; `BoundaryStudioPage` stops keeping separate `polygonCoords`, `undoTrigger`, `redoTrigger` state.
- Required behaviours (each has a test, §10): click adds vertex with rubber-band edge · click first vertex / double-click / **Enter** closes · **Esc cancels** the in-progress shape (not just changes tool) · midpoint drag inserts vertex · select vertex + `Delete`/`Backspace` removes it (min 3 enforced) · long-press deletes on touch · Move tool drags the whole polygon · snap to first vertex and nearby vertices (10 px, `Alt` disables) · second polygon asks "Replace current boundary?" · circle = **64** vertices · freehand simplified on release and capped at 200 · output ring capped at 500 vertices · antimeridian crossing rejected with a message.
- Live readout: area (ha/acres/guntas), perimeter, vertex count, per-edge length on hover, validity badge with the exact reason.
- If Terra Draw proves unusable, the allowed alternative is keeping the custom engine **only if** every behaviour above is implemented and tested **and** `terra-draw*` is removed from `package.json`. Record the decision.

### 5.2 Confirm flow (fixes S4–S9)
1. **Confirm sends the ring to `/field/area` and waits.**
2. `fetchFieldArea` reads the nested shape: `code = body.detail?.code ?? body.code`, `message = body.detail?.message ?? body.message`; `AreaValidationError.code` is always set for 422.
3. **422 ⇒ block.** Show the specific message ("Edges cross", "Too small (min 0.01 ha)", …) in the summary panel and keep the user in the Studio.
4. **Network error / 5xx ⇒ allowed only if the client geometry is valid**, with a visible amber badge "Area not verified by server" stored as `areaSource:'client-estimate'`; the report must repeat this label.
5. On success store `{polygon, areaHa, areaSource, perimeter_m, centroid, plotName, boundarySource:'drawn', confirmed:true}`. **`pointPt` for a polygon is the server `centroid`** (fallback `@turf/centroid`), never `polygon[0]`. The context lat/lon helper uses the same centroid.
6. Step 3 gate = `confirmed === true`. Any geometry edit after confirm sets `confirmed=false`, **clears report/analysis state, re-locks Steps 4–5**, and shows "Boundary changed — confirm again to re-run analysis".
7. Request payload adds `plot_name` and `boundary_source` (`'drawn'|'demo'`); backend echoes them in `FieldSummary`, and the report/PDF prints "Boundary: drawn by user".
8. Draft restore shows a visible banner with "Clear"; a restored draft is never auto-confirmed.

### 5.3 Premium theme — actually apply it (fixes G-T1/G-T2/AC-9)
The tokens in `styles/tokens.css` ("Terra Noir"/"Ivory") are good; the rest of the app must now **use** them.
1. **Split `index.css`** (3 816 lines) into `styles/components/*.css` (one file per component/page) and rewrite every rule to use tokens (`--bg-*`, `--ink-*`, `--emerald-*`, `--gold-*`, `--glass*`, `--r-*`, `--sp-*`, `--elev-*`, `--t-*`). Delete the alias block in `tokens.css` once nothing uses old names.
2. **Inline-style budget:** convert `style={{…}}` to CSS classes; allowed only for values computed at runtime (positions, progress widths, chart colours). Target **≤ 40**.
3. **Raw colours:** none in TSX. Chart palette and map marker colours come from a single `src/theme/palette.ts` that reads CSS variables (`getComputedStyle`). Target: grep gate G-T1 returns only that file.
4. **Restyle all pages and components** listed in v3.0 §6.4 — Field Analysis, Crop Prediction (incl. the NOT IRRIGABLE banner), Summary/Report, Chatbot drawer, Header/step rail (5 steps with lock tooltips), charts (themed palette, gradient fills, custom tooltip), cards (hover tilt on fine pointers, count-up numbers, skeleton shimmer).
5. **Motion:** step transitions (260 ms), polygon draw-in + soft pulse on close, ambient aurora (paused when tab hidden). `prefers-reduced-motion` disables all of it and uses `jumpTo` instead of `flyTo`.
6. **Theme switch:** first visit follows `prefers-color-scheme`, choice persists to `localStorage`; light and dark both pass WCAG AA contrast (automated check).
7. **Performance:** `React.lazy` + `Suspense` for Boundary Studio, Crop Prediction, Summary and charts; `manualChunks` for `maplibre-gl`, `recharts`, `turf`. **Initial JS ≤ 350 kB gzip**; no chunk warning.
8. **Accessibility:** live region ("Area 2.85 ha, 6 vertices, valid"), `aria-pressed` on tools, `?` shortcuts popover, full keyboard path to draw → confirm.

---

## 6. Backend implementation requirements

| ID | Change |
|---|---|
| **B1** | Make detection real by default. `LAND_DETECTION_MODE` default **`enforce`**; `LAND_GATE_MODE` default **`enforce`**. Keep `shadow` and `off` as explicit opt-in modes, and make every response carry `gate_mode`/`detection_mode`. Add a startup log line stating the active modes. When mode ≠ `enforce`, the frontend shows a visible "Preview mode — land check not enforced" banner. Update `.env.example`, `docker-compose.yml`, `render.yaml`. |
| **B2** | In the gate (NOT_IRRIGABLE) branch, build `EnvironmentSummary` from the profile with **`None` for missing values** (make the schema fields `Optional`), never `0.0`/`7.0`. Frontend renders "—" for null. |
| **B3** | `layers[]` is built **from `detection.sources`** (each entry: `name`, `state: checked\|partial\|unavailable`, `reason`, `source_date`, `licence`). `observed_feature_share` = fraction of features whose value `is not None` (zero is a valid observation). Remove the unconditional "derived from DEM/Sentinel-2" notes; add a note only for sources that were actually queried. |
| **B4** | Detection failure is **visible**: response gets `detection: {state:"unavailable", reason}` and the verdict becomes `UNVERIFIED`/`…_PROVISIONAL` per v2.1 D5. Never `pass`. Log with `logger.exception` and request id. |
| **B5** | One error helper used by `land.py`, `predict.py`, `field.py`: logs the traceback, returns `{code:"INTERNAL", request_id}` — no `str(e)` in the response. |
| **B6** | Move detection network I/O to `httpx.AsyncClient` (or run the existing sync code via `anyio.to_thread.run_sync`), per-source timeout ≤ 6 s, total ≤ 8 s, TTL cache with deep copy (v2.1 D6/D7). |
| **B7** | Tests must be offline: add a session-scoped fixture that **blocks sockets** (e.g. `pytest-socket`'s `disable_socket()`); stub raster/tile readers. A test that needs the network is marked `@pytest.mark.network` and excluded by default. Full suite must finish in < 3 min on a clean machine. |
| **B8** | Delete the threshold constants from `area_check.py` (or delete the shim). All thresholds live in `land_class_rules.yaml` / `irrigability_rules.yaml`; add a test that changing a YAML value changes the verdict. |
| **B9** | Use `status.HTTP_422_UNPROCESSABLE_CONTENT` (or the literal `422`). |
| **B10** | Return the error body flat **and** nested so old clients work: `{"detail": {...}, "code": "...", "message": "..."}` via a small exception handler for `FieldValidationError`. |
| **B11** | `FullReportResponse.field_summary` echoes `plot_name`, `boundary_source`, `area_source`. PDF/report prints them. |

Land-class tests required (no patching of `LandClassifier.classify` or `IrrigabilityEngine.evaluate`): stub only raster/tile readers with synthetic arrays for — lake polygon → `WATER_BODY`; dense building cover (≥30 %) → `URBAN_BUILT`; one farmhouse (<5 %) → stays `AGRICULTURAL` with footprint deducted; coffee/areca plantation on tree cover → `AGRICULTURAL` subclass `agroforestry_plantation`; dense tree cover without plantation signature → `FOREST_COVER`; protected-area hit → `FOREST_LEGAL`; slope 25° bare rock → `WASTELAND`; slope 12° farmland → irrigable, drip/sprinkler only; slope >20° → `NOT_IRRIGABLE`; only DEM answered → `UNVERIFIED` (never "clear"); road beside plot → reported, not rejected.

---

## 7. Acceptance criteria

| ID | Criterion | How verified |
|---|---|---|
| AC-1 | Fresh load: world-view map, no polygon/pin, Confirm disabled, Step 3 locked | Playwright |
| AC-2 | Draw → edit vertex → insert midpoint → delete vertex → undo → redo; metrics update each time | Vitest + Playwright |
| AC-3 | Bow-tie polygon: red state "Edges cross", Confirm disabled | Vitest |
| AC-4 | Server 422 blocks Confirm and shows its message; server down + valid shape → amber "not verified" badge, flow continues, label reaches the report | Vitest (mock fetch) |
| AC-5 | Polygon request carries the **centroid** as `point`, plus `plot_name`, `boundary_source:'drawn'` | Vitest on payload builder |
| AC-6 | Editing after confirm re-locks Steps 4–5 and clears the report | Vitest on context |
| AC-7 | Pin-only path works; area shown as "unknown" | Playwright |
| AC-8 | Lake / dense urban / reserved forest / barren rock ⇒ HTTP 200, `NOT_IRRIGABLE`, `recommended_crops == []`, models skipped, **with default settings** (no env override) | pytest |
| AC-9 | Missing weather/soil in a gated response appear as `null`, not 0 or 7.0 | pytest |
| AC-10 | `layers[]` lists only sources detection actually queried; killing the network yields `state:"unavailable"` and an `UNVERIFIED` verdict | pytest |
| AC-11 | Light + dark pass AA contrast; `prefers-reduced-motion` removes motion | axe + manual |
| AC-12 | Lighthouse (mobile) Performance ≥ 85, Accessibility ≥ 95 | Lighthouse CI |
| AC-13 | `npm run build` no warnings about chunk size; `npm test` green; `pytest` green and < 3 min offline | CI |

---

## 8. Gate commands (exact)

```bash
# Frontend
cd frontend
grep -rnE "PRESET_REGIONS|defaultAreaHa|initialAreaHa|handleImportPolygon|accept=\"\.geojson" src --include=*.ts --include=*.tsx | grep -v "\.test\." # → none
grep -rn "terra-draw" src | wc -l                      # ≥ 1  (or the package is removed from package.json — S1 decision)
grep -rn "useBoundaryDraw" src --include=*.tsx | wc -l # ≥ 1  (S2)
grep -rnE "polygonCoords\[0\]|polygonPts\[0\]" src     # → none (S6)
grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(" src --include=*.tsx | grep -v "src/theme/palette.ts" # → none (G-T1)
grep -rn "style={{" src --include=*.tsx | wc -l        # ≤ 40 (G-T2)
grep -c "var(--" src/index.css                         # index.css deleted or fully tokenised
npm run build 2>&1 | grep -i "larger than 500"         # → none
npm test                                               # all pass
npx playwright test                                    # smoke: draw → confirm → step 3

# Backend
cd backend
python -m pytest -q                                    # finishes < 3 min, no network (B7)
grep -rn "LAND_DETECTION_MODE: str = \"enforce\"\|LAND_GATE_MODE: str = \"enforce\"" app/core/config.py   # 2 matches (B1)
grep -rnE "s\.get\(\"[a-z_]+\", *(0\.0|7\.0)\)|w\.get\(\"[a-z_]+\", *0\.0\)" app/api    # → none (B2)
grep -rn "except Exception:\s*$" -A1 app/api | grep -n "pass"                          # → none (B4)
grep -rnE "requests\.(get|post)" app/services/landclass app/api                         # → none (B6)
grep -rnE "MAX_SLOPE_DEG|MAX_ELEVATION_M|FOREST_MAX_FRACTION" app                      # → none (B8)
```

---

## 9. Phased runbook (one commit + tag per phase)

**R0 — Truth baseline.** Tag `pre-v3.1`. Run all commands in §1. Correct `CHANGELOG.md`: mark the "P6 & P7 restyle" entry as *partial (WorkspacePage + Studio only)* and the "116 passed" line as *unverified until R1*. Record real output.

**R1 — Offline, trustworthy tests (B7, B9).** Add socket blocking + `network` marker; stub readers; get the full suite finishing offline in < 3 min. Gate: `pytest -q` green.

**R2 — Detection defaults and honesty (B1–B6, B8, B10, B11).** Enforce defaults; nullable environment summary; provenance from `detection.sources`; visible failures; async I/O; delete threshold constants; error helper. Add the land-class tests in §6. Gates: AC-8…AC-10 and backend gate commands.

**R3 — Frontend contract fixes (S4–S9).** Fix `fetchFieldArea` error parsing, block on 422, centroid as point, payload fields, `confirmed` gate, re-lock on edit. Vitest for each. Gates AC-4…AC-6.

**R4 — Single drawing engine (S1–S3, S10, S11).** Terra Draw + `useBoundaryDraw` as sole state; all behaviours in §5.1; delete dead code; a11y live region and `?` popover. Gates AC-1…AC-3, AC-7.

**R5 — Tokenise and restyle everything (G-T1, G-T2).** Per §5.3 items 1–6, page by page, with before/after screenshots committed under `documentation/screens/`. Remove alias block. Gate: grep gates G-T1/G-T2 and AC-11.

**R6 — Performance and QA (§5.3 item 7, AC-12, AC-13).** Lazy routes, manual chunks, Lighthouse CI, axe, Playwright smoke. Gate: AC-11…AC-13.

**R7 — Docs and release.** Update `README.md`, `run.md`, `documentation/*`, `.env.example`; changelog with real outputs; tag `v3.1.0`.

**Rollback:** `git reset --hard <previous-tag>`. R1–R3 are independent of R4–R6.

---

## 10. Test list (must exist)

Frontend (Vitest): `boundaryMath` (area units, winding, kinks, antimeridian, vertex caps) · `useBoundaryDraw` (add/close/cancel/insert/delete/min-3/undo/redo/replace) · `fetchFieldArea` (nested 422 body → `code`, network error → typed error) · payload builder (centroid, `plot_name`, `boundary_source`) · context (Step 3 needs `confirmed`; edit after confirm re-locks 4–5 and clears report).
Frontend (Playwright): draw → confirm → Step 3 reachable; bow-tie blocked; reload shows restore banner.
Backend (pytest, offline): everything in §6 land-class list · `field/area` codes through the **HTTP layer** and the flat+nested body · gate response has `null` (not `0.0/7.0`) · detection outage ⇒ `UNVERIFIED` · YAML change changes verdict · meta-test: no test patches `LandClassifier.classify` / `IrrigabilityEngine.evaluate`.

---

## 11. Kickoff prompt for Antigravity (paste as-is)

> Read `PRD_v3.1_Remediation_and_Full_Implementation.md` completely. Execute R0 → R7 in order. Before any code change, run the commands in §1 and record real output in `CHANGELOG.md`; correct any earlier changelog claim you cannot reproduce. After each phase run its gate commands from §8, commit, and tag. Do not claim a pass you did not observe; write `NOT RUN` or `DID NOT FINISH` with the reason. Do not change ML models or scraping policy. Never reintroduce default coordinates, preset fields, file-import for boundaries, or hidden numeric defaults. If a gate cannot pass, stop and tell me which one and why.