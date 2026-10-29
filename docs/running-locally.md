# GeoAgri AI Execution & Run Guide (v3.1.0)

## Quick Start (Two Terminals)

### Terminal 1: Backend API (FastAPI)
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```
- API Documentation: http://localhost:8000/docs
- Health Status: http://localhost:8000/api/v1/health

### Terminal 2: Frontend App (Vite + React)
```bash
cd frontend
npm run dev
```
- Web Application: http://localhost:3000/ (or port assigned by Vite)

---

## 5-Step Workflow

1. **Step 1: Workspace (`#home`)**
   - High-level overview of planetary agricultural intelligence.
   - Click **"Draw your land →"** to access Boundary Studio.

2. **Step 2: Boundary Studio (`#boundary`)**
   - Full-bleed MapLibre GL satellite mapping canvas powered by **TerraDraw** single drawing engine.
   - Interactive vertex placement, midpoint insertion, vertex deletion, and 50-step undo/redo stack (`useBoundaryDraw`).
   - Live geodesic calculation of area (hectares, acres, guntas), perimeter, and vertex count.
   - Real-time validity checks prevent self-intersecting geometries (bow-tie shapes) or out-of-range coordinates.
   - Click **"Confirm Boundary →"** to verify with the backend geodesic engine (`POST /api/v1/field/area`) and unlock Step 3.
   - Editing geometry after confirmation automatically re-locks subsequent steps and invalidates stale reports.

3. **Step 3: Field Intelligence (`#analysis`)**
   - Displays confirmed field extent on read-only preview map.
   - Executes live Sentinel-1/2 vegetation indices, ISRIC/OpenLandMap 3D soil depth profiles, NASA POWER meteorology, and land-class gating.
   - Enforces land classification gating: Non-arable parcels (water bodies, dense urban, barren rock, reserved forest) receive `NOT_IRRIGABLE` verdicts with explicit limiting reasons, bypassing crop models while preserving telemetry integrity (missing values are nullable, never fabricated).

4. **Step 4: Crop Prediction (`#crops`)**
   - Ranks suitable primary crops and companion intercrop pairings with P10/P50/P90 quantile yield predictions.

5. **Step 5: Executive Report (`#report`)**
   - Synthesizes environmental scorecard, irrigation requirements, climate risks, and downloadable PDF dossier.

---

## Test & Verification Commands

```bash
# 1. Backend test suite (117 tests, 100% offline with socket blocking, < 1 min)
cd backend
PYTHONPATH=. venv/bin/python -m pytest -q

# 2. Field area validation unit tests
PYTHONPATH=. venv/bin/python -m pytest tests/test_field_area_validation.py -v

# 3. Frontend unit tests (Vitest: boundary math, hooks, payload builder, area verification)
cd ../frontend
npm test

# 4. Frontend production bundle build (optimized chunking: < 65 kB initial gzip, 0 chunk warnings)
npm run build
```

---

## PRD v3.1 Gate Verification

Run these commands from the project root to verify all architectural invariants:

```bash
# Zero default coordinates or preset regions
grep -rnE "PRESET_REGIONS|DEFAULT_LAT|DEFAULT_LON" frontend/src

# Zero boundary file import backdoors
grep -rnE "importGeoJSON|handleImportPolygon|zzz\.GeoJSON" frontend/src

# Zero hardcoded hex / rgba colors outside centralized palette (G-T1)
grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(" frontend/src --include="*.tsx" | grep -v "src/theme/palette.ts"

# Strict inline style budget (≤ 40 dynamic-only styles) (G-T2)
grep -rn "style={{" frontend/src --include="*.tsx" | wc -l

# Enforced backend detection gating defaults
grep -rn "LAND_DETECTION_MODE: str = \"enforce\"\|LAND_GATE_MODE: str = \"enforce\"" backend/app/core/config.py

# Zero silent exception swallows in API handlers
grep -rn "except Exception:\s*$" -A1 backend/app/api | grep -n "pass"
```

