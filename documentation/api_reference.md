# GeoAgri AI API Reference (v3.1)

Base URL: `/api/v1`

---

## Endpoints

### 1. `POST /api/v1/predict/full-report`
Primary agronomic decision-support and land analysis endpoint.

#### Request Schema
```json
{
  "polygon": [
    [75.7460, 13.3170],
    [75.7540, 13.3170],
    [75.7540, 13.3230],
    [75.7460, 13.3230],
    [75.7460, 13.3170]
  ],
  "point": [75.7500, 13.3200],
  "area_ha": 2.85,
  "season": "kharif",
  "limit": 10,
  "irrigation_preference": "rainfed",
  "manual_soil": {
    "ph": 6.8,
    "organic_carbon_g_kg": 12.0
  },
  "plot_name": "My Field",
  "boundary_source": "drawn",
  "survey_ref": null
}
```

#### Response Structure
- `field_summary`: Area, centroid coordinates, boundary source, polygon validity.
- `land_suitability`: FAO land suitability grade, score, and limiting factors.
- `environment`: Weather and soil physical/chemical parameters. If data is unavailable or when the request is gated, missing values are returned as `null` (strictly never fabricated as `0.0` or `7.0`).
- `satellite_features`: Spectral indices (NDVI, NDWI, EVI, SAVI, NDMI), elevation, slope, TWI, SAR VV/VH.
- `climatology_status`: `available` or `unavailable` (NASA POWER 12-month long-term climatology verified).
- `climatology_message`: Description of climatology status or reason for unreachability.
- `recommended_crops`: Ranked crop species from the global 2,033-crop registry:
  - `confidence_tier`: `"A"` (ML-modeled probabilistic yield quantiles) or `"B"` (EcoCrop bioclimatic envelope match).
  - `method`: `"ml_model"` or `"ecocrop_envelope"`.
  - `scientific_name`: Botanical taxonomic name.
  - `limiting_factor`: Active Liebig limiting factor (e.g., rainfall, temperature, pH).
  - `best_planting_month`: Recommended month (1–12) for optimum bioclimatic envelope match.
  - `expected_yield_t_ha`: Probabilistic yield bounds (`p10`, `p50`, `p90`) for Tier A crops (`null` for Tier B crops).
  - `expected_production_t`: Field-scale production bounds (`p10`, `p50`, `p90`) for Tier A crops (`null` for Tier B crops).
  - `suitability_score`: Normalized envelope suitability score (0.0 to 1.0).
  - `suitability_grade`: FAO suitability grade (`Excellent`, `Good`, `Moderate`, `Unsuitable`).
  - `irrigation_mode`: Permitted irrigation regime (`rainfed`, `supplemental`, `full`).
  - `water_need_mm`: Annual or growing-season water requirement.
  - `climate_risk_score`: Climatic risk index (0–100%).
  - `intercrop_options`: Companion crop pairing options with estimated boost (for Tier A crops).
  - Gating: If land is gated as `NOT_IRRIGABLE` or site is over open ocean / missing climatology, crop models are bypassed and `recommended_crops` is `[]`.
- `land_class`: Dominant land class (`AGRICULTURAL`, `FOREST_LEGAL`, `FOREST_COVER`, `WASTELAND`, `URBAN_BUILT`, `WATER_BODY`, `UNKNOWN`), class shares, subclass, confidence.
- `irrigability`: Verdict (`IRRIGABLE`, `CONDITIONALLY_IRRIGABLE`, `NOT_IRRIGABLE`, `NOT_IRRIGABLE_PROVISIONAL`, `UNVERIFIED`), reasons, usable area, irrigation options.
- `detection`: Physical surface detector output for forest, buildings, roads, water, and terrain, plus query sources telemetry.
- `gate_mode`: Operational gating mode (`off`, `shadow`, `enforce`).
- `area_check`: Legacy backward-compatible donor area check schema.
- `imputed_features`: List of feature names imputed inside model wrapper (if any).

---

### 2. `POST /api/v1/land/inquiry` & `GET /api/v1/land/inquiry?lat=&lon=`
Quick land regulatory, classification, and physical feature inquiry without running full crop ML models.

#### Response Structure
- `query`: Coordinate and area metadata.
- `admin`: State, district, taluk, village administrative boundaries.
- `land_class`: Dominant class and class shares.
- `irrigability`: Verdict and legal/physical limiting reasons.
- `land_records`: Verified official and user records found.
- `detection`: Exact multi-feature detection metrics.
- `gate_mode`: Runtime gating switch.
- `layers`: Status and licensing of contributing spatial layers.

---

### 3. `GET /api/v1/map-layers`
Honest map and detection layers telemetry endpoint (PRD v2.1 M10, M24).

#### Response Example
```json
{
  "layers": [
    {
      "id": "esa_worldcover_2021",
      "name": "ESA WorldCover 2021 v200",
      "type": "raster",
      "status": "ready",
      "reason": null,
      "licence": "CC BY 4.0",
      "source_date": "2021",
      "attribution": "ESA WorldCover 10m 2021"
    },
    {
      "id": "copernicus_dem_glo30",
      "name": "Copernicus DEM GLO-30",
      "type": "raster",
      "status": "ready",
      "reason": null,
      "licence": "Open Access",
      "source_date": "2021",
      "attribution": "Copernicus DEM GLO-30"
    }
  ],
  "total_layers": 10,
  "ready_count": 8,
  "unavailable_count": 2,
  "checked_at": "2026-10-24T02:00:00Z"
}
```

---

### 4. `POST /api/v1/land/records/upload`
Uploads land record documents (PDF, image, text) for parsing extent and land classification.
- Strips PII (Aadhaar, PAN, phone, owner names).
- Session-isolated with TTL retention (`UPLOAD_RETENTION_SECONDS`).
- Word-boundary matching for irrigation facilities.

---

### 5. `GET /api/v1/land/providers`
Returns health and availability of registered land record providers (`user_document`, `ksrsac_official`, `bhuvan_wms`, `open_layers`).

---

### 6. `POST /api/v1/field/area` (PRD v3.0 §7)
Validates polygon boundary geometry using Shapely and computes geodesic area in hectares on the WGS84 ellipsoid.

#### Request Schema
```json
{
  "polygon": [
    [75.7500, 13.3200],
    [75.7510, 13.3200],
    [75.7510, 13.3210],
    [75.7500, 13.3210],
    [75.7500, 13.3200]
  ],
  "point": null
}
```

#### Success Response (`200 OK`)
```json
{
  "area_ha": 1.2345,
  "perimeter_m": 445.2,
  "centroid": [75.7505, 13.3205],
  "centroid_lon": 75.7505,
  "centroid_lat": 13.3205,
  "polygon_valid": true,
  "boundary_source": "user_drawn",
  "area_method": "geodesic"
}
```
*Note: Point-only requests return `{"area_ha": null, "polygon_valid": false, "centroid": [lon, lat]}`.*

#### Error Response (`422 Unprocessable Content`)
Returns a structured error detail object with `{ code, message }`:
- `SELF_INTERSECTION`: Edges cross each other (bow-tie shape).
- `TOO_SMALL`: Area is less than `0.01` ha (~100 m²).
- `TOO_LARGE`: Area exceeds `1000.0` ha.
- `NOT_CLOSED`: First vertex does not match last vertex.
- `TOO_FEW_VERTICES`: Less than 3 distinct corners.
- `OUT_OF_RANGE`: Coordinates outside standard WGS84 latitude/longitude bounds.

---

### 7. `GET /api/v1/health`
Checks operational telemetry for upstream data providers, PostGIS database, and Earth Engine.

