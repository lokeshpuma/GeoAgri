# GeoAgri AI – India Edition
## Architecture & Technical Specification

### 1. System Overview
GeoAgri AI is a location-driven agricultural decision-support platform designed specifically for Indian agro-ecological zones. It processes field polygon boundaries (WGS84) to extract multi-modal satellite, meteorological, soil, and topographical features. It executes a 5-model parallel predictive stack with resilient fallbacks, fusing the outputs into a multi-attribute crop plan optimized for land suitability, yield, water conservation, and climate risk resilience.

---

### 2. End-to-End Data Pipeline
```
[User Field Polygon / Point]
             │
             ▼
┌────────────────────────────────────────┐
│ Geodesic Polygon Area & Buffer Service │ (pyproj / shapely)
└────────────────────┬───────────────────┘
                     │ Centroid & WGS84 Ring
                     ▼
┌────────────────────────────────────────┐
│ Unified Environmental Profile Builder   │
├────────────────────┬───────────────────┤
│ • GEE Client       │ Sentinel-1/2 & SRTM (34 base layers)
│ • NASA POWER API   │ Weather (Rainfall, Temp, Solar, RH)
│ • ISRIC SoilGrids  │ Topsoil 0-5cm (pH, SOC, N, Texture)
└────────────────────┬───────────────────┘
                     │ Raw Environmental Attributes
                     ▼
┌────────────────────────────────────────┐
│ 78-Layer Engineered Feature Pipeline   │ (feature_manifest.json)
└────────────────────┬───────────────────┘
                     │ 78-Dimensional Feature Vector
                     ▼
┌────────────────────────────────────────┐
│ Parallel 5-Model Execution Router      │ (asyncio.gather)
├──────────┬──────────┬──────────┬───────┤
│ Model A  │ Model B  │ Model C  │ Model D│ Model E
│ Suitability Rec.   │ Irrig.   │ Yield  │ Risk
└──────────┴──────────┴──────────┴───────┘
                     │ Model Outputs & Fallback Statuses
                     ▼
┌────────────────────────────────────────┐
│ Multi-Attribute Decision Fusion Engine │ (Weighted Normalization)
└────────────────────┬───────────────────┘
                     │ Ranked 100+ Crop Plan
                     ▼
┌────────────────────────────────────────┐
│ REST API & React Interactive Dashboard │ (FastAPI + Vite/Leaflet)
└────────────────────────────────────────┘
```

---

### 3. Feature Pipeline (78 Layers)
- **Base Spectral & Terrain (34)**:
  - Terrain (5): Elevation, Slope, Aspect, Hillshade, TWI.
  - S2 Indices (8): NDVI, NDWI, EVI, SAVI, NDMI, NBR, GNDVI, NDSI.
  - S2 Raw Bands (17): B1-B12, B8A, B8/B4 temporal means and std.
  - S1 Radar (4): VV, VH, VV/VH ratio, RVI.
- **Environmental & Soil (14)**: Rainfall, Tmax, Tmin, Tmean, RH, Solar Radiation, pH, SOC, Nitrogen, P, K, Clay %, Sand %, Silt %.
- **Temporal Aggregation (30)**: Seasonal min, max, std stats for key spectral bands and moisture indices.

---

### 4. Five-Model Stack & Fallback Table
| Model | Name | Baseline Method | Fallback Strategy |
|---|---|---|---|
| **Model A** | Land Suitability | Gradient Boosted / Spectral Scorer | NDVI + Slope + pH Rule Filter |
| **Model B** | Crop Recommendation | Two-stage Scorer (ML + Agronomic Rules) | Agronomic Rule Filter Only |
| **Model C** | Irrigation Feasibility | Water Balance (ET0 x Kc vs Precip) | Rainfall vs Requirement Thresholding |
| **Model D** | Quantile Yield | Quantile Model (P10, P50, P90) | Historical Crop Registry Quantiles |
| **Model E** | Climate Risk | Drought / Heat / Excess Rain Evaluator | Baseline Drought/Heat Rule Score |

---

### 5. Multi-Attribute Decision Fusion Formula
$$\text{FusionScore} = w_1 \cdot \text{LandSuit} + w_2 \cdot \text{CropRec} - w_3 \cdot \text{IrrigCost}_{\text{norm}} + w_4 \cdot \text{Yield}_{\text{norm}} - w_5 \cdot \text{Risk}_{\text{norm}}$$

Default weights: $w_1=0.20, w_2=0.25, w_3=0.15, w_4=0.25, w_5=0.15$.
