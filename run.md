# GeoAgri AI Execution & Run Guide (v3.0.0)

## Quick Start (Two Terminals)

### Terminal 1: Backend API (FastAPI)
```bash
cd ~/Desktop/GeoAgri/backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```
- API Documentation: http://localhost:8000/docs
- Health Status: http://localhost:8000/api/v1/health

### Terminal 2: Frontend App (Vite + React)
```bash
cd ~/Desktop/GeoAgri/frontend
npm run dev
```
- Web Application: http://localhost:3001/ (or port assigned by Vite)

---

## 5-Step Workflow

1. **Step 1: Workspace (`#home`)**
   - High-level overview of planetary agricultural intelligence.
   - Click **"Draw your land →"** to access Boundary Studio.

2. **Step 2: Boundary Studio (`#boundary`)**
   - Interactive MapLibre GL satellite mapping engine.
   - Place corner vertices or paste latitude/longitude coordinates.
   - Live geodesic calculation of area (hectares, acres, guntas), perimeter, and vertex count.
   - Real-time validity checks prevent self-intersecting geometries or invalid coordinates.
   - Click **"Confirm Boundary →"** to verify with the backend geodesic engine and unlock Step 3.

3. **Step 3: Field Intelligence (`#analysis`)**
   - Displays confirmed field extent on read-only preview map.
   - Executes live Sentinel-1/2 vegetation indices, ISRIC/OpenLandMap 3D soil depth profiles, NASA POWER meteorology, and land-class gating.

4. **Step 4: Crop Prediction (`#crops`)**
   - Ranks suitable primary crops and companion intercrop pairings with P10/P50/P90 quantile yield predictions.

5. **Step 5: Executive Report (`#report`)**
   - Synthesizes environmental scorecard, irrigation requirements, climate risks, and downloadable PDF dossier.

---

## Test & Verification Commands

```bash
# Backend test suite (116 tests)
cd ~/Desktop/GeoAgri/backend
venv/bin/python -m pytest tests -q

# Field area validation unit tests
venv/bin/python -m pytest tests/test_field_area_validation.py -v

# Frontend unit tests (Vitest)
cd ~/Desktop/GeoAgri/frontend
npm test

# Production build check
npm run build
```
