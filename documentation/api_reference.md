# GeoAgri AI API Reference (v2.1)

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
  "point": null,
  "area_ha": 2.85,
  "season": "kharif",
  "limit": 10,
  "irrigation_preference": "rainfed",
  "manual_soil": {
    "ph": 6.8,
    "organic_carbon_g_kg": 12.0
  },
  "survey_ref": null
}
```

#### Response Structure
- `field_summary`: Area, centroid coordinates, boundary source, polygon validity.
- `land_suitability`: FAO land suitability grade, score, and limiting factors.
- `environment`: Weather and soil physical/chemical parameters.
- `satellite_features`: Spectral indices (NDVI, NDWI, EVI, SAVI, NDMI), elevation, slope, TWI, SAR VV/VH.
- `recommended_crops`: Ranked crop species with quantile yield (P10/P50/P90), production, water needs, and companion intercrop options.
- `land_class`: Dominant land class (`AGRICULTURAL`, `FOREST_LEGAL`, `FOREST_COVER`, `WASTELAND`, `URBAN_BUILT`, `WATER_BODY`, `UNKNOWN`), class shares, subclass, confidence.
- `irrigability`: Verdict (`IRRIGABLE`, `CONDITIONALLY_IRRIGABLE`, `NOT_IRRIGABLE`, `NOT_IRRIGABLE_PROVISIONAL`, `UNVERIFIED`), reasons, usable area, irrigation options.
- `detection`: Physical surface detector output for forest, buildings, roads, water, and terrain.
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

### 6. `POST /api/v1/field/area`
Calculates WGS84 geodesic area in hectares for interactive polygon geometries.

---

### 7. `GET /api/v1/health`
Checks operational telemetry for upstream data providers, PostGIS database, and Earth Engine.
