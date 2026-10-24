# GeoAgri AI — PRD v3.0: Boundary Studio (interactive polygon) + Premium UI Overhaul

**Version:** 3.0 · **Date:** 2026-10-24 · **Amends:** PRD v2.1 (FR-1 polygon import, FR-21 demo presets). Everything in v2.1 not mentioned here stays in force (data honesty, evidence gate, no scraping, no personal data).
**Target repo:** `GeoAgri-main` (zip: `GeoAgri-after_new_prd.zip`). **Tool:** Antigravity.
**Scope:** (A) replace downloaded-GeoJSON boundaries with a **user-drawn polygon on the map, in its own section ("Boundary Studio")**; (B) replace the current look with a **premium, interactive design system**; (C) ordered runbook with grep/test gates.

---

## 0. Instructions to the coding agent (non-negotiable)

1. This PRD wins over code. Log every deviation in `CHANGELOG.md`.
2. **No fabricated location data.** After this change there must be **no default polygon, default centroid, preset field or sample GeoJSON** reaching a prediction request. A user must draw (or pin) before anything runs.
3. Do not touch backend modelling, land-class, irrigability or land-record logic. Backend changes are limited to §7 (polygon validation).
4. One commit per phase in §14; run `npm run build` (frontend) and `pytest -v` (backend) before each commit. Report real results; write `NOT RUN` + reason if a command cannot run.
5. No new network calls from the browser except: map tiles, the geocoder in §5.6, and the existing GeoAgri API.
6. Verify every dependency version against npm before installing (see §10 note on `maplibre-gl`).
7. Accessibility and `prefers-reduced-motion` are requirements, not polish (§9.7).

---

## 1. Audit of the current code (what exists, what is wrong)

Read from the uploaded zip.

### 1.1 Polygon / location flow today
| # | Finding | File |
|---|---|---|
| P1 | Boundary comes from **file import** (`<input accept=".geojson,.json">`), `handleImportPolygon` reads only `features[0]` and `coordinates[0]` (first ring of first feature; multi-feature, MultiPolygon, holes silently dropped). | `components/MapSelector/MapSelector.tsx` |
| P2 | A sample file `zzz.GeoJSON` ships in repo root (Karnataka rectangle, "North Field Farm Parcel"). | repo root |
| P3 | **Hidden default polygon:** `initialPolygon = PRESET_REGIONS[0].polygon` and `initialAreaHa = 2.85` (Karnataka), also `formData` default in context (`polygonPts: PRESET_REGIONS[0].polygon`, `areaHa: PRESET_REGIONS[0].defaultAreaHa`). A user who does nothing still submits a Karnataka field. Violates v2.1 §0.2/§0.3. | `MapSelector.tsx`, `context/WorkflowContext.tsx` |
| P4 | **Hidden coordinate defaults:** `lat … \|\| 14.0`, `lon … \|\| 75.75` in context; `PRESET_REGIONS[0].centroid` as map start. | `WorkflowContext.tsx`, `MapSelector.tsx` |
| P5 | `PRESET_REGIONS` (6 hard-coded fields with invented `defaultAreaHa`) duplicated in **both** `MapSelector.tsx` and `WorkflowContext.tsx`; gated only by `VITE_DEMO_MODE`. | both |
| P6 | Map **click replaces polygon with a point** (`setPolygonPts([])`). There is no vertex drawing, editing, undo, snapping or validation. | `MapSelector.tsx` |
| P7 | `fetchFieldArea` swallows backend errors and returns `{area_ha: null}`; import path then does `areaRes?.area_ha ?? 0`, so a failure shows **0 ha** as if valid. | `api/client.ts`, `MapSelector.tsx` |
| P8 | The map lives inside Step 2 (`FieldAnalysisPage`) mixed with analysis UI; there is no dedicated boundary step. `Dashboard.tsx` also embeds `MapSelector` but is not routed in `App.tsx` (dead code). | `FieldAnalysisPage.tsx`, `Dashboard.tsx`, `App.tsx` |
| P9 | Base map is **raster only** (OSM / Esri / OpenTopoMap); no vector labels, no dark style, no 3D terrain. `index.html` also loads Leaflet CSS from unpkg and `package.json` ships `leaflet` + `react-leaflet` although the map is MapLibre. | `MapSelector.tsx`, `index.html`, `package.json` |

### 1.2 Theme today
| # | Finding |
|---|---|
| T1 | `index.css` is **one 3 816-line file**, mixing tokens, layout and per-component rules; inline `style={{…}}` is used heavily in TSX (e.g. MapSelector header). Hard to re-theme. |
| T2 | Tokens are minimal (`--bg-primary`, `--accent-green`, …) with a `[data-theme="light"]` override block. No spacing, type, elevation, motion or z-index scale. |
| T3 | Look = generic dark "glass card" + ambient orbs. Emerald-on-navy with Plus Jakarta/Outfit; no distinctive identity, no motion language, no micro-interactions. |
| T4 | `WorkspacePage` is a long marketing scroll (How it works / pipeline / data sources) that delays the actual task (selecting land). |

---

## 2. Goals and non-goals

### 2.1 Goals
- **G1** The only ways to define land are: **draw a polygon**, or **drop a pin** (point-only enquiry, already supported by backend). No file download/upload needed.
- **G2** A dedicated **Boundary Studio** section (own step/page) where the user draws, edits, measures and confirms the plot **before** analysis.
- **G3** Premium visual identity and interaction quality across the whole app, light + dark.
- **G4** Zero hidden defaults: empty state until the user acts.
- **G5** Keep every existing backend contract working (`polygon: [[lng,lat],…]`, `/field/area`).

### 2.2 Non-goals
- No cadastral/survey-grade accuracy claim. Drawn boundaries are **user-asserted**; UI must say "Drawn by you — not a legal survey boundary".
- No multi-parcel / MultiPolygon / holes in v3.0 (single outer ring). Explicitly rejected with a clear message, not silently trimmed.
- No change to ML/land-class logic. No accounts/backend persistence of plots in v3.0.

---

## 3. New user flow (steps)

Current: `1 Workspace (landing) → 2 Field Analysis (map + data) → 3 Crop Prediction → 4 Summary`.

New: **five steps**

| Step | Page | Hash | Gate |
|---|---|---|---|
| 1 | `WorkspacePage` (slimmed landing, one hero + CTA "Draw your land") | `#home` | open |
| 2 | **`BoundaryStudioPage` (new)** | `#boundary` | open |
| 3 | `FieldAnalysisPage` (no map editing; read-only mini-map of confirmed boundary) | `#analysis` | **boundary confirmed** (valid polygon or pin) |
| 4 | `CropPredictionPage` | `#crops` | analysis complete (existing rule) |
| 5 | `SummaryReportPage` | `#report` | crop analysis complete (existing rule) |

Required code changes: `StepNumber` → `1|2|3|4|5` in `WorkflowContext.tsx`; update `STEP_HASHES`, `HASH_TO_STEP`, `isStepAccessible`, `goToStep`, `BottomWorkflowNav`, `PageHeader` step indicator, `App.tsx` switch. Old hashes (`#analysis` etc.) must still resolve to the right new step; unknown hash → step 1.

---

## 4. Boundary Studio — functional requirements

### 4.1 Layout
Full-bleed map (≥ 70 vh on desktop, full-screen on mobile) with floating glass panels:
- **Left rail (tool dock):** Pan, Draw polygon, Rectangle, Circle→polygon, Freehand, Edit vertices, Move, Delete vertex, Undo, Redo, Clear.
- **Top-center search bar:** place search + "lat, lng" paste + Locate me.
- **Right panel "Plot Summary":** live metrics (area ha / acres / guntas, perimeter, vertices, centroid lat/lng, validity badge), plot name field, **Confirm boundary** primary button.
- **Bottom-left:** base-map switcher (Satellite default for drawing · Streets · Terrain · Dark) + opacity slider for labels.
- **Empty state:** centered coach card "Find your land, then click to place the first corner" with 3 micro-steps; disappears at first vertex.

### 4.2 Drawing and editing (FR-B)
| ID | Requirement |
|---|---|
| FR-B1 | Click to add vertices; live rubber-band edge to cursor; **click first vertex, double-click, or Enter** closes the polygon; **Esc** cancels the in-progress shape. |
| FR-B2 | After closing: drag vertices; **midpoint handles insert** a vertex; select a vertex + `Delete`/`Backspace` removes it (min 3 stays enforced); drag body to move whole polygon (Move tool). |
| FR-B3 | **Undo/Redo** (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z), at least 50 steps; buttons mirror shortcuts. |
| FR-B4 | **Snapping** to first vertex (closing) and to existing vertices within 10 px; hold `Alt` to disable. |
| FR-B5 | Rectangle (2 clicks) and Circle (center + radius, converted to a 64-vertex polygon) produce ordinary editable polygons. Freehand is simplified on release (Turf `simplify`, tolerance ≈ 1 m at current zoom) and capped at 200 vertices. |
| FR-B6 | **Live measurements** while drawing and editing: area (ha, acres, guntas = 1/40 acre), perimeter (m/km), vertex count, per-edge length labels on hover. Computed client-side with `@turf/area`/`@turf/length` for instant feedback; **the confirmed value is re-computed by the backend** (`/field/area`) and the backend value is the one stored and displayed after confirm. Show a small "server-verified ✓" tick. |
| FR-B7 | **Live validity:** self-intersection (`@turf/kinks`), < 3 vertices, area below min (default 0.01 ha / ~100 m²) or above max (default 1 000 ha) , ring not closed, coordinates out of range. Invalid ⇒ red outline, specific message, **Confirm disabled**. |
| FR-B8 | **Single polygon only.** A second polygon attempt asks "Replace current boundary?" (no silent replacement). |
| FR-B9 | **Pin mode:** alternative tool "Drop pin" for point-only enquiry (existing `onPointChange`). Pin and polygon are mutually exclusive; switching asks for confirmation if one exists. Banner under pin mode: "Pin only — area unknown; results are less specific." (matches v2.1 point behaviour: `area_ha: null`.) |
| FR-B10 | **Confirm boundary** writes polygon (`[[lng,lat],…]`, closed, 5-decimal precision, counter-clockwise outer ring) to context, sets `boundaryConfirmed = true`, unlocks Step 3, and navigates there. Editing after confirm resets `boundaryConfirmed` and re-locks later steps (existing "inputs changed ⇒ re-run" behaviour must be preserved). |
| FR-B11 | **Draft persistence:** current in-progress/confirmed boundary saved to `localStorage` key `geoagri.boundary.v1` (try/catch, tolerate empty/corrupt) and restored on reload with a toast "Restored your last boundary — Clear". Never restore silently into a prediction. |
| FR-B12 | **Export (output only):** "Copy GeoJSON" and "Download GeoJSON" of the *drawn* boundary, for the user's own records. No import UI in v3.0 (see §4.4). |
| FR-B13 | Keyboard operable: tools focusable, shortcuts listed in a `?` popover (D draw, R rectangle, E edit, M move, P pin, Enter finish, Esc cancel, Ctrl+Z/Shift+Ctrl+Z). |
| FR-B14 | Touch: tap to add vertex, long-press vertex to delete, two-finger pan/zoom never adds a vertex; on-screen "Finish" and "Undo" buttons on mobile. |

### 4.3 Search and positioning (FR-S)
- **FR-S1** Place search via geocoder (§5.6) with debounce 400 ms, 5 results, keyboard navigable; selecting flies to the place (zoom 15–17).
- **FR-S2** Paste "13.3200, 75.7500" or "13.32°N 75.75°E" → parse, validate range, fly there and drop a *search marker* (not a pin/boundary).
- **FR-S3** "Locate me" uses browser geolocation; denial shows a non-blocking toast.
- **FR-S4** Initial camera: **world view** (zoom ≈ 2) — not Karnataka. If a restored draft exists, fit to it.

### 4.4 Removal of file-based boundaries (the user's explicit ask)
- Delete `zzz.GeoJSON`, the `handleImportPolygon` function, the hidden `<input type="file">`, and the "Import Polygon" button.
- Delete `PRESET_REGIONS` from **both** `MapSelector.tsx` and `WorkflowContext.tsx` and the `VITE_DEMO_MODE` preset row. If demo mode is still wanted for sales demos, move one clearly-labelled sample into `frontend/src/demo/` loaded only when `VITE_DEMO_MODE==='true'` via a visible "Load demo plot" button (never automatic) and the resulting boundary is flagged `source: "demo"` in the request so the backend/report can label it.
- Keep GeoJSON **export** (FR-B12) only.
- `README.md`/`run.md`: remove any instruction that tells users to import GeoJSON.

---

## 5. Technical design — Boundary Studio

### 5.1 Components (new folder `frontend/src/features/boundary/`)
```
BoundaryStudioPage.tsx        // page shell + layout
BoundaryMap.tsx               // MapLibre instance, basemaps, camera
useBoundaryDraw.ts            // Terra Draw wiring, history, validity
ToolDock.tsx                  // left tool rail
PlotSummaryPanel.tsx          // right glass panel, metrics, Confirm
SearchBar.tsx                 // geocoder + coordinate parser
BasemapSwitcher.tsx
CoachCard.tsx                 // empty state
boundaryTypes.ts              // BoundaryState, ValidityIssue
boundaryMath.ts               // turf wrappers: area, perimeter, kinks, units, winding
boundaryStorage.ts            // localStorage (try/catch)
```
`components/MapSelector/MapSelector.tsx` is **deleted**; `FieldAnalysisPage` gets a small read-only `BoundaryPreviewMap.tsx` (non-interactive MapLibre, fitBounds, outline only). `pages/Dashboard.tsx` (unrouted) is deleted.

### 5.2 Drawing engine
Use **Terra Draw** (`terra-draw` + `terra-draw-maplibre-gl-adapter`) with modes: `polygon`, `rectangle`, `circle`, `freehand`, `select` (with `draggable`, `coordinates.midpoints`, `coordinates.draggable`, `coordinates.deletable`), `point`. Rationale: actively maintained, MapLibre adapter, built-in midpoint/vertex editing, no dependency on mapbox-gl internals. If Antigravity finds Terra Draw unsuitable, the fallback is `@mapbox/mapbox-gl-draw` with the MapLibre CSS-class patch — record the decision in `CHANGELOG.md`. Undo/redo is implemented in `useBoundaryDraw` as a snapshot stack of the feature's coordinates (Terra Draw does not provide it).

### 5.3 State (extend `WorkflowContext`)
```ts
interface BoundaryState {
  mode: 'none' | 'polygon' | 'pin';
  polygon: [number, number][] | null;   // closed ring, [lng,lat]
  pin: [number, number] | null;
  name: string;                         // user plot name
  areaHa: number | null;                // server-verified; null for pin or unverified
  areaSource: 'server' | 'client-estimate' | null;
  confirmed: boolean;
  source: 'drawn' | 'demo';
}
```
Defaults: `mode:'none'`, everything else `null/false`. **No fallback coordinates anywhere**; any code that builds a request (`runPrediction`, lat/lon helpers around lines 277-278) must throw/disable the button if neither a confirmed polygon nor pin exists.

### 5.4 Geometry rules (`boundaryMath.ts`)
- Output ring: closed (first = last), CCW, coordinates rounded to 5 decimals, ≤ 500 vertices (simplify if more, then re-validate).
- Area: `turf.area` m² → ha (`/10 000`), acres (`/4 046.8564224`), guntas (`acres × 40`).
- Validity: `turf.kinks` empty, `turf.booleanValid` true if available, lat ∈ [−90, 90], lng ∈ [−180, 180], not crossing the antimeridian (reject with message in v3.0).

### 5.5 Map styles
Replace the raster-only style with a style set built in one `mapStyles.ts`:
- **Satellite (default for Studio):** Esri World Imagery raster + vector labels overlay.
- **Streets / Dark:** vector style. Preferred: self-hosted or OpenFreeMap-compatible style via `VITE_MAP_STYLE_URL` (already honoured by current code). Check provider terms before shipping; record in `SOURCE.md`.
- **Terrain:** OpenTopoMap raster (keep) — optional hillshade/3D terrain if a terrain-RGB source is configured via env; feature-flagged `VITE_ENABLE_3D_TERRAIN` (default false).
- Attribution control always visible (OSM/Esri/OpenTopoMap licences).
- Keep a `loadError` + retry state (existing behaviour).

### 5.6 Geocoder
Configurable by env: `VITE_GEOCODER_URL` (default empty ⇒ search bar shows only coordinate parsing and a hint "Search not configured"). Documented options: Photon (self-hosted or public), MapTiler Geocoding (key), Nominatim **only** if the usage policy is respected (no autocomplete on the public instance). Never hard-code a key; keys in `frontend/.env` (git-ignored) and listed in `.env.example`. Attribution shown beside results.

### 5.7 Data sent to backend
Unchanged shape: `PredictRequestPayload.polygon?: [number, number][]`, plus optional `plot_name?: string` and `boundary_source?: 'drawn' | 'demo'`. Backend must accept and ignore/echo the two new optional fields without breaking old clients.

---

## 6. Premium UI / theme — "Terra Noir" design system

### 6.1 Direction
Dark, deep-forest **obsidian** surfaces with warm **gold** and luminous **emerald** accents; editorial display serif for headlines, refined sans for UI, mono for coordinates. Feel: expensive field-intelligence instrument, not a SaaS template. A matching **"Ivory"** light theme (warm paper whites, deep green ink, same gold accent). Theme switch persists to `localStorage`, honours `prefers-color-scheme` on first visit, switches with a 250 ms colour transition (disabled under reduced motion).

### 6.2 Tokens (single source: `src/styles/tokens.css`)
```css
:root[data-theme="dark"] {
  /* surfaces */
  --bg-0:#05090a;  --bg-1:#0a1112;  --bg-2:#101a1a;  --bg-3:#172524;
  --glass:rgba(16,26,26,.62); --glass-strong:rgba(16,26,26,.86); --glass-border:rgba(255,255,255,.08);
  /* ink */
  --ink-1:#f3f1ea; --ink-2:#b9c2bd; --ink-3:#7f8d87;
  /* accents */
  --emerald-500:#22c58b; --emerald-300:#7be8bd; --emerald-glow:rgba(34,197,139,.35);
  --gold-500:#d9ad4f;   --gold-300:#f0cf85;   --gold-glow:rgba(217,173,79,.30);
  --danger:#ff6b6b; --warn:#ffb454; --info:#6cb6ff; --ok:#22c58b;
  /* gradients */
  --grad-brand:linear-gradient(135deg,#22c58b 0%,#d9ad4f 100%);
  --grad-surface:radial-gradient(120% 120% at 10% 0%,#13302b 0%,#05090a 60%);
}
:root[data-theme="light"] {
  --bg-0:#f6f3ea; --bg-1:#fbf9f3; --bg-2:#ffffff; --bg-3:#efeadc;
  --glass:rgba(255,255,255,.72); --glass-strong:rgba(255,255,255,.92); --glass-border:rgba(20,40,30,.10);
  --ink-1:#0f2a22; --ink-2:#3e5a4f; --ink-3:#6c8378;
  --emerald-500:#0f9b6a; --emerald-300:#47c79a; --emerald-glow:rgba(15,155,106,.25);
  --gold-500:#b8862b; --gold-300:#d7a94c; --gold-glow:rgba(184,134,43,.22);
  --danger:#d64545; --warn:#c77a16; --info:#2563eb; --ok:#0f9b6a;
}
:root {
  --font-display:'Fraunces','Cormorant Garamond',Georgia,serif;
  --font-ui:'Plus Jakarta Sans',system-ui,sans-serif;
  --font-mono:'JetBrains Mono',ui-monospace,monospace;
  --r-xs:6px; --r-sm:10px; --r-md:16px; --r-lg:24px; --r-pill:999px;
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:24px; --sp-6:32px; --sp-7:48px; --sp-8:72px;
  --elev-1:0 1px 2px rgba(0,0,0,.25);
  --elev-2:0 8px 24px rgba(0,0,0,.35);
  --elev-3:0 24px 64px rgba(0,0,0,.5), 0 0 0 1px var(--glass-border);
  --ease-out:cubic-bezier(.22,1,.36,1); --ease-spring:cubic-bezier(.34,1.56,.64,1);
  --t-fast:140ms; --t-med:260ms; --t-slow:520ms;
  --z-map:0; --z-panel:20; --z-header:40; --z-modal:80; --z-toast:100;
}
```
All colours in components must come from tokens (grep gate G-T1). Contrast: body text ≥ 4.5:1, large text/controls ≥ 3:1 in **both** themes (verify with an automated check, e.g. `axe` or Lighthouse).

### 6.3 Typography
Display (hero, step titles, big numbers): **Fraunces** 600, optical size on. UI: **Plus Jakarta Sans** 400/500/600/700 (already loaded). Numbers/coordinates: **JetBrains Mono** with `font-variant-numeric: tabular-nums`. Load fonts with `display=swap`; self-host in `public/fonts` for production if CSP forbids Google Fonts.
Scale: 12 / 14 / 16 / 18 / 22 / 28 / 40 / 56 (clamp-based fluid for hero).

### 6.4 Component restyle list
Every component in `src/components/*` and every page is restyled onto the tokens. Specific requirements:
- **Glass panels:** `backdrop-filter: blur(18px) saturate(140%)`, 1 px `--glass-border`, top-edge highlight gradient, `--elev-2`. Provide a no-blur fallback via `@supports not (backdrop-filter…)`.
- **Buttons:** primary = brand gradient with soft glow and 1.5 % scale-up on hover, press-in on active; secondary = glass with border; icon buttons 40 px hit area minimum; visible `:focus-visible` ring (2 px emerald + 2 px offset).
- **Cards (MetricCard, CropRecommendationCard, …):** subtle tilt-on-hover (max 4°, pointer-fine only), animated number count-up on first view, skeleton shimmer while loading.
- **Charts (Recharts):** theme-aware palette (emerald, gold, info, danger), rounded bars, gradient area fills, custom dark tooltip.
- **NOT IRRIGABLE banner** (from v2.1): unmistakable danger treatment (red/amber glass, large icon, reasons list); fix A12 (`verdict.replaceAll('_',' ')`).
- **Header / step nav:** 5-step progress rail with animated connector, completed steps show check, locked steps show lock with tooltip explaining the gate.
- **Chatbot drawer:** same glass language; no layout overlap with the Studio tool dock (z-index tokens).
- **Toasts, tooltips, popovers, skeletons, empty states** implemented once in `src/ui/` and reused.

### 6.5 Motion language
- Page transitions: 260 ms fade + 12 px rise between steps (Motion `AnimatePresence`, or CSS only if Motion is not added).
- Map: `flyTo` with `speed ≈ 1.2`; completed polygon plays a 600 ms outline "draw-in" and a soft emerald pulse; area number animates.
- Ambient background: replace orbs with a very slow (60 s) aurora gradient + faint topographic-contour SVG pattern; paused when tab hidden and under reduced motion.
- Hover/press micro-interactions on all interactive elements (≤ 180 ms).
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables parallax, tilt, aurora, count-ups, flyTo (uses `jumpTo`).

### 6.6 Landing page (`WorkspacePage`)
Cut to a single immersive hero (above the fold): display headline, one sentence, **"Draw your land →"** CTA to Step 2, plus a muted looping satellite-contour visual (CSS/SVG, no video). Move "How it works / Pipeline / Data sources" into collapsible sections below ("See how it works"), lazy-rendered. Remove the claim text that conflicts with reality (e.g. data sources not actually wired); copy must match README.

### 6.7 Accessibility and performance
- WCAG 2.2 AA; full keyboard path through Studio; ARIA labels on tools (`aria-pressed` for active tool); live region announcing "Area 2.85 ha, 6 vertices, valid"; map canvas has descriptive `aria-label`.
- Bundle: lazy-load `BoundaryStudioPage` and chart pages; MapLibre in its own chunk; Lighthouse Performance ≥ 85 mobile, Accessibility ≥ 95.
- Remove unused deps: `leaflet`, `react-leaflet`, `@types/leaflet`, Leaflet `<link>` in `index.html` (confirm with a grep first).

---

## 7. Backend changes (minimal)

1. `POST /api/v1/field/area` — add polygon validation using `shapely` (already in the geo stack; add to requirements if absent): closed ring, ≥ 4 points, `is_valid`, not self-intersecting, area between `FIELD_MIN_HA` (0.01) and `FIELD_MAX_HA` (1000) from settings. Return **HTTP 422** with `{code, message}` (`SELF_INTERSECTION`, `TOO_SMALL`, `TOO_LARGE`, `OUT_OF_RANGE`, `NOT_CLOSED`) instead of silently returning null.
2. Return `{ area_ha, perimeter_m, centroid:[lng,lat], polygon_valid:true, area_method:"geodesic" }` (extra fields are additive).
3. `PredictRequest` accepts optional `plot_name`, `boundary_source`; echoed in `FieldSummary`. The report/PDF shows "Boundary: drawn by user" and, when applicable, "Boundary: demo sample".
4. `client.ts`: `fetchFieldArea` must **throw a typed error** on 4xx/5xx/network failure (fix P7). The Studio shows "Couldn't verify area on server — using estimate" (`areaSource:'client-estimate'`) and still allows Confirm only if the client geometry is valid; the report states the area was unverified.
5. Add tests in `backend/tests/test_field_area_validation.py`: valid square, bow-tie (self-intersecting) → 422, 2-point ring → 422, 0.001 ha → 422, 5 000 ha → 422, point-only → `area_ha is None`.

---

## 8. Acceptance criteria (must all pass)

| ID | Criterion |
|---|---|
| AC-1 | Fresh load: map at world view, **no polygon, no pin, "Confirm" disabled, step 3 locked.** |
| AC-2 | User draws a 5-vertex polygon, edits a vertex, inserts a midpoint, deletes a vertex, undoes and redoes — area/perimeter/vertex count update live each time. |
| AC-3 | Drawing a bow-tie shows a red invalid state with "Edges cross" and Confirm stays disabled. |
| AC-4 | Confirm sends exactly the drawn ring; backend-verified area is shown with ✓; Step 3 unlocks. |
| AC-5 | Pin-only path works; report shows area "unknown" (no invented value). |
| AC-6 | Reload restores the draft with a visible notice; "Clear" removes it; nothing auto-submits. |
| AC-7 | Editing the boundary after analysis re-locks Steps 4–5 and shows "Boundary changed — re-run analysis". |
| AC-8 | No file-import control exists; `zzz.GeoJSON` and `PRESET_REGIONS` are gone (grep gates). |
| AC-9 | Light and dark themes both pass AA contrast; all colours via tokens. |
| AC-10 | Keyboard-only user can draw, finish, edit and confirm a polygon. |
| AC-11 | `prefers-reduced-motion` removes all non-essential motion. |
| AC-12 | `npm run build` and `pytest -v` green (real results recorded in `CHANGELOG.md`). |

---

## 9. Grep / test gates

```bash
# G-D1 no hidden location defaults
grep -rnE "PRESET_REGIONS|75\.75|13\.32|14\.0\b.*lat|defaultAreaHa|initialAreaHa" frontend/src            # → no matches
# G-D2 no file-import boundary
grep -rniE "handleImportPolygon|accept=\"\.geojson|Import Polygon" frontend/src                            # → no matches
test ! -e zzz.GeoJSON && echo OK
# G-D3 dead map stacks removed
grep -rnE "react-leaflet|from 'leaflet'|leaflet.css" frontend/src frontend/index.html frontend/package.json # → no matches
# G-T1 no raw colours in components (tokens only; tokens.css excluded)
grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(" frontend/src --include=*.tsx                                       # → only chart palette constants file
# G-T2 inline styles budget
grep -rn "style={{" frontend/src --include=*.tsx | wc -l                                                    # ≤ 40 (was far higher)
# G-B1 backend validation
pytest backend/tests/test_field_area_validation.py -v
```
Frontend tests (Vitest + Testing Library, add if absent): `boundaryMath` (area units, winding, kinks), `useBoundaryDraw` undo/redo stack, context gating (step 3 locked until `confirmed`), and one Playwright smoke test (draw → confirm → step 3 reachable).

---

## 10. Dependencies

Add: `terra-draw`, `terra-draw-maplibre-gl-adapter`, `@turf/area`, `@turf/length`, `@turf/kinks`, `@turf/simplify`, `@turf/centroid`, `@turf/boolean-valid` (replace the monolithic `@turf/turf` once imports are split), optionally `motion` (Framer Motion successor) for transitions, `vitest`, `@testing-library/react`, `@playwright/test` (dev).
Remove: `leaflet`, `react-leaflet`, `@types/leaflet`.
**Check first:** `package.json` pins `maplibre-gl ^6.10.0`. Confirm that version exists on npm and that the Terra Draw adapter supports it; if not, pin the newest version both support. Pin exact versions, commit the lockfile, and note versions in `CHANGELOG.md`.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Users draw rough boundaries; area differs from records | Persistent label "Drawn by you — not a survey boundary"; optional later: compare with land-record extent when available (v2.1 providers). |
| Geocoder terms / cost | Env-configurable, off by default, coordinate parsing always works. |
| Large CSS rewrite regresses pages | Phase the theme (§12 P2–P4), screenshot-diff each page before/after, keep class names stable where possible. |
| Terra Draw API changes | Pin exact versions; isolate in `useBoundaryDraw.ts`. |
| Satellite tiles (Esri) usage limits | Provide `VITE_SATELLITE_TILES_URL` override; keep attribution; document in `SOURCE.md`. |

---

## 12. Out of scope (future)
Multi-parcel plots, holes, KML/Shapefile import, saved plots with accounts, sharing a plot by link, comparing drawn boundary with cadastral extent, time-series satellite scrubber on the map.

---

## 13. Docs to update
`README.md` (new flow + screenshots), `run.md`, `documentation/api_reference.md` (`/field/area` 422 codes, new optional fields), `documentation/architecture.md` (Boundary Studio data flow), `CHANGELOG.md` (one entry per phase), `frontend/.env.example` (`VITE_GEOCODER_URL`, `VITE_SATELLITE_TILES_URL`, `VITE_MAP_STYLE_URL`, `VITE_ENABLE_3D_TERRAIN`, `VITE_DEMO_MODE`).

---

## 14. Antigravity runbook (do in this order; one commit + git tag per phase)

**P0 — Baseline.** `git status` clean; tag `pre-v3`. Run `npm ci && npm run build` and `pytest -v`; record real results (or `NOT RUN` + reason) in `CHANGELOG.md`.

**P1 — Remove defaults and file import (no new UI yet).** Delete `zzz.GeoJSON`, `PRESET_REGIONS` (both files), import button/handler; make context defaults empty; guard `runPrediction` and lat/lon helpers; fix `fetchFieldArea` to throw. Delete `Dashboard.tsx`. Gates G-D1, G-D2. App must still build; Step 2 shows a temporary "Draw a boundary first" empty state.

**P2 — Design tokens + base styles.** Create `src/styles/{tokens,base,typography,motion,utilities}.css`; import in `main.tsx`; add theme toggle + persistence; map old variable names (`--accent-green` etc.) to new tokens as **temporary aliases** so nothing breaks. Self-check: both themes render.

**P3 — UI kit.** `src/ui/`: Button, IconButton, GlassPanel, Badge, Tooltip, Toast, Skeleton, Tabs, Slider, Toggle, Popover, EmptyState, StatNumber (count-up). Storybook optional; otherwise a hidden `/#kit` route behind `VITE_DEMO_MODE`.

**P4 — Boundary Studio.** Implement §4–§5 in `features/boundary/`; add step 2 to context/nav/header (§3); wire Confirm → context → Step 3; `BoundaryPreviewMap` in Field Analysis. Add Vitest tests. Gates AC-1…AC-8, AC-10.

**P5 — Backend validation.** §7 changes + tests. Gate G-B1; AC-4, AC-5.

**P6 — Restyle all pages/components.** Landing (§6.6), Field Analysis, Crop Prediction (incl. NOT IRRIGABLE banner + A12 fix), Summary/Report, Chatbot, Header/Nav, Charts. Remove temporary aliases; split/trim `index.css` until only component-scoped CSS modules or small files remain. Gates G-T1, G-T2.

**P7 — Motion, a11y, performance.** §6.5, §6.7; Lighthouse + axe run; Playwright smoke; reduced-motion check. Gates AC-9, AC-11.

**P8 — Cleanup and docs.** Remove unused deps (G-D3), update docs (§13), final full `npm run build` + `pytest -v`; tag `v3.0.0`.

**Rollback:** each phase tag allows `git revert`/`git reset --hard <tag>`; P1–P3 are safe to ship independently; do not start P4 before P1 and P2 pass their gates.

---

## 15. Antigravity kickoff prompt (paste as-is)

> Read `PRD_v3.0_Boundary_Studio_and_Premium_UI.md` end to end, then `PRD.md` §0 and §5–§7 for the data-honesty rules. Execute the runbook in §14 strictly in order (P0 → P8). After each phase: run the gates listed for it, update `CHANGELOG.md` with real command output (or `NOT RUN` + reason), commit, and tag. Do not modify land-class, irrigability, land-record or ML code. Never reintroduce default coordinates, preset fields, sample GeoJSON or file-import for boundaries. Stop and ask me if a dependency version in §10 cannot be installed or a gate cannot pass.