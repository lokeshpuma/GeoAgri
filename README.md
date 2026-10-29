# GeoAgri AI

Planetary agricultural intelligence platform combining satellite Earth observation, soil physics, and machine learning for verified field-level crop suitability, water budgeting, and yield benchmarking.

[![CI Status](https://github.com/lokeshpuma29/GeoAgri/actions/workflows/ci.yml/badge.svg)](https://github.com/lokeshpuma29/GeoAgri/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Node 20+](https://img.shields.io/badge/node-20+-green.svg)](https://nodejs.org/)

---

## Table of Contents

1. [System Architecture & Agronomic AI Models](#system-architecture--agronomic-ai-models)
2. [Workflow Overview](#workflow-overview)
3. [Environment Configuration & Security](#environment-configuration--security)
4. [Local Installation & Development](#local-installation--development)
5. [Production Cloud Deployment](#production-cloud-deployment)
   - [Deploying Backend to Render](#deploying-backend-to-render)
   - [Deploying Frontend to Vercel](#deploying-frontend-to-vercel)
6. [Testing & Quality Verification](#testing--quality-verification)
7. [Repository Structure](#repository-structure)
8. [Data Attributions & License](#data-attributions--license)

---

## System Architecture & Agronomic AI Models

GeoAgri AI executes an end-to-end evidence fusion pipeline connecting Earth Observation satellites, climatology models, and agronomic machine learning engines. Every output is strictly grounded in empirical physical observations or validated bioclimatic envelopes.

```
       [ Satellite: Sentinel-2 / SRTM (GEE) ]
       [ Weather: NASA POWER 30-Yr Climatology ]
       [ Soil: ISRIC / OpenLandMap SoilGrids   ]
                          │
                          ▼
            [ Unified Evidence Service ]
          (PRD v3.4 Truthful Data Contract)
                          │
     ┌────────────────────┼────────────────────┐
     ▼                    ▼                    ▼
[ Model A ]          [ Model B ]          [ Model C ]
Land Suitability     Crop Recommender     Water Balance &
& Irrigability       (Tier A & Tier B)    Irrigation Mode
     │                    │                    │
     └────────────────────┬────────────────────┘
                          │
                 ┌────────┴────────┐
                 ▼                 ▼
            [ Model D ]       [ Model E ]
            Probabilistic     Agro-Climatic
            Yield Quantiles   Risk Scorecard
                 │                 │
                 └────────┬────────┘
                          ▼
             [ Executive Agronomic Dossier ]
```

### 1. Model A — Land Suitability & Physical Terrain Classification
* **Input**: 30-meter SRTM Digital Elevation Model (DEM), Sentinel-2 cloud-masked spectral bands, and ESA WorldCover (10m).
* **Computed Metrics**: Elevation, terrain slope, aspect, hillshade, Topographic Wetness Index (TWI), and dominant land classification.
* **Mechanism**: Evaluates mechanical slope limits (slope > 20° excluded from flood/furrow irrigation; slope > 8° restricted to drip) and verifies against water bodies, wetlands, urban settlements, and forest reserves.
* **Output**: Land suitability score (0–100%), classification grade (High, Moderate, Marginal, Non-Arable), and confidence level.

### 2. Model B — Multi-Crop Decision Synthesis & Bioclimatic Matching
* **Global Registry**: Curates over 1,710 crop species across 203 countries with EcoCrop physiological envelopes.
* **Two-Tier Architecture**:
  * **Tier A (ML-Verified Crops)**: Retrained gradient-boosted ensembles (XGBoost & LightGBM) calibrated with regional agricultural training data, yield histories, and 70-layer environmental feature vectors.
  * **Tier B (Bioclimatic Envelope Matches)**: Evaluates monthly temperature, rainfall, and soil pH constraints using FAO EcoCrop rules and 30-year monthly climatologies from NASA POWER.
* **Output**: Ranked recommendation list with suitability index, optimal planting window, category categorization (Cereals, Legumes, Vegetables, Fruits, Cash Crops), and limiting factor diagnostics.

### 3. Model C — Irrigation Feasibility & Dynamic Water Balance
* **Mechanism**: Implements FAO-56 Penman-Monteith reference evapotranspiration ($ET_0$) combined with crop-specific phenological coefficients ($K_c$).
* **Water Budgeting**:
  $$\text{Crop Water Demand } (ET_c) = ET_0 \times K_c$$
  $$\text{Net Irrigation Requirement} = \max(0, ET_c - P_{\text{eff}})$$
* **Output**: Recommended mode (`Rainfed`, `Supplemental Irrigation`, or `Full Irrigation`), seasonal water requirement in cubic meters ($m^3$), effective precipitation ($mm$), and water surplus/deficit balance.

### 4. Model D — Probabilistic Quantile Yield Forecasts
* **Mechanism**: Quantile regression gradient boosting predicting probabilistic yield bounds rather than naive single-point estimates.
* **Forecast Intervals**:
  * **$P_{10}$ (Pessimistic)**: Lower bound expected under unfavorable weather or water stress (90% exceedance probability).
  * **$P_{50}$ (Median Expected)**: Central empirical yield expectation under standard regional management.
  * **$P_{90}$ (Optimistic)**: Upper potential under optimal climate conditions and agronomic inputs.
* **Output**: Metric yield distributions in tonnes per hectare ($t/ha$) and total parcel tonnage. (*Note: Exclusively rendered for Tier A calibrated crops per PRD truthful data constraints.*)

### 5. Model E — Agro-Climatic Vulnerability & Risk Scorecard
* **Mechanism**: Evaluates heat stress days ($T_{\text{max}} > 35^\circ C$), critical dry spells (consecutive days without rain during vegetative/flowering phases), and excess rainfall hazard.
* **Output**: Normalized risk percentages for Drought Stress, Heat Stress, and Excess Precipitation, with an overall agro-climatic resilience rating.

### 6. Symbiotic Intercropping Engine
* **Mechanism**: Botanical taxonomy and agronomic synergy matrices evaluate spatial canopy layering and nitrogen-fixing rhizobial symbiosis.
* **Output**: Companion crop recommendations (e.g. Finger Millet paired with Pigeonpea or Cowpea), spatial planting ratios (e.g. 75% Main : 25% Companion), and estimated yield synergy boost percentage.

---

## Workflow Overview

1. **Workspace Overview (`#workspace`)**: Enter coordinates, select agro-climatic region, and select target cultivation season (`Kharif`, `Rabi`, `Zaid`, `Annual`, `Perennial`).
2. **Boundary Studio (`#boundary`)**: Digitize farm parcels on satellite imagery using geodesic vector drawing tools. Real-time WGS84 ellipsoid geodesic calculations provide acreage and hectare metrics.
3. **Field Analysis (`#analysis`)**: Inspect 8 environmental diagnostics:
   * Satellite: Vegetation Health (NDVI), Canopy Moisture (NDMI), Water Availability (NDWI).
   * Weather: Seasonal Precipitation, Mean Temperature.
   * Soil: Topsoil pH, Organic Carbon (SOC), Soil Texture.
   * Terrain: Elevation, Slope, Topographic Wetness.
4. **Crop Prediction (`#crops`)**: Explore AI-ranked crop cultivars, filter by category tabs, search by common or botanical names, inspect quantile yield comparisons, and review intercropping strategies.
5. **Executive Summary Report (`#report`)**: Complete unified agricultural dossier with water budgets, climate risk scorecards, and high-resolution exportable analysis.

---

## Environment Configuration & Security

> [!CAUTION]
> **Credential Security**: Never commit `.env` or your service account JSON keys to GitHub. Both `backend/.env` and `*.json` key files are permanently ignored in `.gitignore`.

### 1. Backend Environment Setup (`backend/.env`)

Copy the template:
```bash
cp backend/.env.example backend/.env
```

Configure your parameters in `backend/.env`:

```env
# --- Application Mode
ENV=development
ALLOW_SYNTHETIC_DATA=false          # Set true only for offline demo/simulation mode
GEE_MOCK_FALLBACK=false             # Set true to fall back to simulation if GEE fails
LOG_LEVEL=INFO

# --- Google Earth Engine (Noncommercial / Production)
GEE_PROJECT_ID=your-gcp-project-id
GEE_SERVICE_ACCOUNT=your-sa@your-gcp-project-id.iam.gserviceaccount.com
GEE_PRIVATE_KEY_PATH=/absolute/path/to/backend/gee-key.json

# Optional: Raw JSON string for headless cloud deployments (Render, Railway, Docker)
# GEE_KEY_JSON_RAW={"type": "service_account", "project_id": "...", ...}

# --- Weather & Climatology
NASA_POWER_API_URL=https://power.larc.nasa.gov/api/temporal/daily/point
OPEN_METEO_ENABLED=true

# --- Soil Configuration
SOILGRIDS_SOURCE=gee
SOILGRIDS_LOCAL_DIR=backend/ml/data/raw/external/soil/soilgrids

# --- Regulatory & Land Gating
LAND_DETECTION_MODE=enforce
LAND_GATE_MODE=enforce
```

### 2. Earth Engine Setup (Free Noncommercial)

1. **Sign Up**: Register your Google account at [earthengine.google.com/signup](https://earthengine.google.com/signup/) (choose Noncommercial).
2. **Google Cloud Project**:
   * Open [Google Cloud Console](https://console.cloud.google.com/) and note your **Project ID**.
   * Enable the [Earth Engine API](https://console.cloud.google.com/apis/library/earthengine.googleapis.com).
3. **Service Account**:
   * Open [IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts).
   * Create a service account (e.g. `geoagri-sa`) and assign role **Earth Engine Resource Viewer** (or **Earth Engine User**).
   * Under **Actions > Manage Keys**, click **Add Key > Create new key (JSON)**.
   * Save the downloaded file to `backend/gee-key.json`.
4. **Permissions**: Ensure your service account has `Service Usage Consumer` permissions in your project IAM.

> [!TIP]
> **No GEE Key Yet?** You can run GeoAgri immediately in local demo mode by setting `ALLOW_SYNTHETIC_DATA=true` and `GEE_MOCK_FALLBACK=true` in `backend/.env`.

---

## Local Installation & Development

### Prerequisites
* **Python**: 3.11 or higher
* **Node.js**: v20 or higher
* **npm**: v10 or higher
* **Git**: v2.30+

### Step 1: Clone the Repository
```bash
git clone https://github.com/lokeshpuma29/GeoAgri.git
cd GeoAgri
```

### Step 2: Configure & Start Backend
```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate       # On Windows: venv\Scripts\activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create .env from template
cp .env.example .env

# Place your GEE key inside backend/ if you have one
# cp /path/to/downloaded-key.json gee-key.json

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```
Backend API will be running at `http://127.0.0.1:8000` with Swagger documentation at `http://127.0.0.1:8000/docs`.

### Step 3: Configure & Start Frontend
In a new terminal window:
```bash
cd frontend

# Install clean dependencies
npm ci

# Start Vite development server
npm run dev
```
Frontend web interface will be accessible at `http://localhost:3000`.

---

## Production Cloud Deployment

GeoAgri is designed for multi-tier zero-downtime deployment:
* **Backend API**: Hosted on **Render** (Python Web Service).
* **Frontend Web App**: Hosted on **Vercel** (Global Edge CDN).

---

### Deploying Backend to Render

You can deploy the backend using Render's Blueprint (`render.yaml`) or as a standalone Web Service:

#### Option A: Using Render Blueprint (`render.yaml`)
1. Log into your [Render Dashboard](https://dashboard.render.com/).
2. Click **New > Blueprint** and select your `GeoAgri` GitHub repository.
3. Render reads `render.yaml` automatically and configures the `geoagri-backend` service.
4. Click **Apply**.

#### Option B: Manual Web Service Setup
1. In Render, click **New > Web Service**.
2. Connect your GitHub repository.
3. Configure the following fields:
   * **Name**: `geoagri-backend`
   * **Region**: `Oregon (US West)` (or closest to your users)
   * **Root Directory**: `backend`
   * **Runtime**: `Python 3`
   * **Build Command**: `pip install --upgrade pip && pip install -r requirements.txt`
   * **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   * **Health Check Path**: `/api/v1/health`
4. **Environment Variables**:
   * `PYTHON_VERSION`: `3.11.9`
   * `ENV`: `production`
   * `GEE_PROJECT_ID`: Your Google Cloud Project ID
   * `GEE_SERVICE_ACCOUNT`: Your service account email
5. **Adding GEE Credentials on Render**:
   * **Method 1 (Secret File)**: Click **Environment > Secret Files** on Render. Add file filename `gee-key.json` and paste your key contents. Set environment variable `GEE_PRIVATE_KEY_PATH=/etc/secrets/gee-key.json`.
   * **Method 2 (Raw JSON Env Var)**: Add environment variable `GEE_KEY_JSON_RAW` and paste the entire JSON content of your service account key.
   * **Method 3 (Public Demo Mode)**: If deploying without GEE credentials, set `ALLOW_SYNTHETIC_DATA=true` and `GEE_MOCK_FALLBACK=true`.

---

### Deploying Frontend to Vercel

1. Log into [Vercel](https://vercel.com/) and click **Add New > Project**.
2. Import your `GeoAgri` GitHub repository.
3. Configure project settings:
   * **Framework Preset**: `Vite`
   * **Root Directory**: Click Edit and select `frontend`.
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
   * **Install Command**: `npm ci`
4. **Environment Variables**:
   * `VITE_API_BASE_URL`: `https://your-backend-name.onrender.com/api/v1`
5. Click **Deploy**.

Vercel will build and distribute the React application globally. The pre-configured `frontend/vercel.json` automatically handles Single Page Application (SPA) client-side routing rewrites and asset caching headers.

---

## Testing & Quality Verification

GeoAgri enforces four verification gates across code hygiene, CSS consistency, unit logic, and offline data contracts:

### 1. CSS & Token Integrity Gate
Verifies that all design tokens and CSS class names are strictly defined:
```bash
python3 scripts/audit_css_classes.py
```
*Expected: `681 classes used, 0 without a rule` (Exit code 0).*

### 2. Frontend Unit & Regression Suite
Runs Vitest unit tests in jsdom environment:
```bash
npm --prefix frontend test -- --run
```
*Expected: 7 test files, 29/29 tests passed.*

### 3. Frontend Production Build Check
Validates TypeScript compilation and Vite bundling:
```bash
npm --prefix frontend run build
```

### 4. Backend Pytest Suite
Runs 100% offline isolated backend tests:
```bash
rm -rf backend/.cache && PYTHONPATH=backend backend/venv/bin/python -m pytest backend/tests -q
```
*Expected: 158 passed (all external sockets mocked or verified).*

---

## Repository Structure

```
GeoAgri/
├── .github/workflows/ci.yml       # Continuous Integration pipeline
├── .gitignore                     # Security ignore rules (.env, *key*.json)
├── CHANGELOG.md                   # Semantic release history and audits
├── LICENSE                        # MIT License
├── README.md                      # Comprehensive project documentation
├── render.yaml                    # Render Cloud deployment blueprint
├── vercel.json                    # Root Vercel routing configuration
├── backend/
│   ├── .env.example               # Backend environment variables template
│   ├── requirements.txt           # Python dependencies
│   ├── app/
│   │   ├── api/v1/                # REST API routers (field, predict, health, land)
│   │   ├── core/                  # Settings, logging, and security config
│   │   ├── models/                # ML inference models (A, B, C, D, E)
│   │   ├── rules/                 # Agronomic yield ceilings and gating rules
│   │   └── services/              # Satellite (GEE), weather, soil, and land services
│   ├── ml/
│   │   ├── data/processed/        # Calibrated crop registries and crosswalks
│   │   └── training/              # Model training and calibration pipelines
│   └── tests/                     # Pytest offline test suites
├── frontend/
│   ├── package.json               # Node dependencies
│   ├── vite.config.ts             # Vite build configuration
│   ├── vercel.json                # Frontend SPA rewrites and cache headers
│   └── src/
│       ├── api/                   # Typed API client and backend connectors
│       ├── components/            # Reusable UI cards, maps, modals, error boundaries
│       ├── context/               # Workflow state machine and theme providers
│       ├── features/boundary/     # MapLibre GL and Terra Draw boundary studio
│       ├── pages/                 # Step pages (Workspace, Boundary, Analysis, Crops, Report)
│       ├── styles/                # CSS modules, Terra Noir/Ivory tokens, UIKit
│       └── utils/                 # Agronomic formatters, labels, and geometry math
└── scripts/
    ├── audit_css_classes.py       # Automated CSS class validator
    └── cleanup_repo.sh            # Artifact cleanup utility
```

---

## Data Attributions & License

GeoAgri AI is released under the [MIT License](LICENSE).

### Data Attributions:
* **FAO (EcoCrop & FAOSTAT)**: Crop physiological envelope definitions and national baseline yield statistics. (*Governed by FAO CC BY-NC-SA 3.0 IGO terms.*)
* **NASA POWER**: 30-year global solar and meteorological surface data for agro-climatology.
* **ESA & Copernicus**: Sentinel-2 Level-2A multispectral surface reflectance, ESA WorldCover 10m land cover, and Copernicus 30m Digital Elevation Model.
* **ISRIC & OpenLandMap**: Global SoilGrids 250m depth-resolved soil chemical and physical properties.
* **GBIF & WorldClim**: Global biodiversity occurrence records and high-resolution climate surfaces.
