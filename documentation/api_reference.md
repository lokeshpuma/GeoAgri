# GeoAgri AI API Reference

## Endpoints Summary

### 1. `POST /api/v1/predict/full-report`
Primary decision-support endpoint.

#### Request Example
```json
{
  "polygon": [
    [78.4850, 17.3850],
    [78.4870, 17.3850],
    [78.4870, 17.3870],
    [78.4850, 17.3870],
    [78.4850, 17.3850]
  ],
  "season": "kharif",
  "limit": 10,
  "irrigation_preference": "rainfed",
  "manual_soil": {
    "ph": 6.8,
    "organic_carbon": 12.0
  }
}
```

#### Response Example
```json
{
  "field_summary": {
    "area_ha": 2.35,
    "centroid_lon": 78.4860,
    "centroid_lat": 17.3850,
    "polygon_valid": true,
    "used_fallback_buffer": false
  },
  "land_suitability": {
    "grade": "High",
    "score": 0.85,
    "confidence": 0.90,
    "limiting_factors": []
  },
  "recommended_crops": [
    {
      "crop_id": "maize",
      "crop_name": "Maize",
      "category": "cereals",
      "recommendation_score": 0.82,
      "suitability_score": 0.80,
      "expected_yield_t_ha": { "p10": 2.4, "p50": 3.6, "p90": 5.5 },
      "expected_production_t": { "p10": 5.64, "p50": 8.46, "p90": 12.92 },
      "irrigation_mode": "rainfed",
      "water_need_mm": 600.0,
      "climate_risk_score": 15.0,
      "climate_risk_note": "Low climatic risk profile during active growing window.",
      "intercrop_options": [
        {
          "companion_crop_id": "pigeonpeas",
          "companion_crop_name": "Pigeon Pea (Arhar)",
          "yield_boost_pct": 0.18,
          "companion_share_factor": 0.25,
          "rationale": "Combining Maize with Pigeon Pea optimizes nitrogen uptake."
        }
      ],
      "rationale": "Maize ranks well due to high agronomic compatibility; minimal supplementary water overhead.",
      "data_confidence": "high"
    }
  ],
  "model_status": {
    "model_a": "ok",
    "model_b": "ok",
    "model_c": "ok",
    "model_d": "ok",
    "model_e": "ok"
  }
}
```

---

### 2. `POST /api/v1/field/area`
Quick area computation helper.

---

### 3. `GET /api/v1/crops`
List crop profiles in the crop registry.

---

### 4. `GET /api/v1/health`
Service health & liveness check.
