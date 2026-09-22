/**
 * GeoAgri AI API Client.
 * Connects React frontend to FastAPI backend service.
 */

function resolveApiBaseUrl(): string {
  const metaEnv = (import.meta as any)?.env;
  const envUrl =
    (metaEnv?.VITE_API_BASE_URL as string) ||
    (metaEnv?.VITE_API_URL as string) ||
    (metaEnv?.NEXT_PUBLIC_API_URL as string);

  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    const clean = envUrl.trim().replace(/\/+$/, '');
    return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
  }

  // When deployed on custom domains or Vercel with API proxies, fallback to relative path
  if (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return '/api/v1';
  }

  return 'http://localhost:8000/api/v1';
}

const API_BASE_URL = resolveApiBaseUrl();

export interface PredictRequestPayload {
  polygon?: [number, number][];
  point?: [number, number];
  season: "kharif" | "rabi" | "zaid" | "annual" | "perennial";
  limit?: number;
  area_ha?: number;
  irrigation_preference?: "rainfed" | "supplemental" | "full" | null;
  manual_soil?: {
    ph?: number | null;
    organic_carbon?: number | null;
    nitrogen?: number | null;
    phosphorus?: number | null;
    potassium?: number | null;
    texture_clay_pct?: number | null;
    texture_sand_pct?: number | null;
    texture_silt_pct?: number | null;
  } | null;
}

export interface FullReportResponse {
  field_summary: {
    area_ha: number;
    centroid_lon: number;
    centroid_lat: number;
    polygon_valid: boolean;
    used_fallback_buffer: boolean;
  };
  land_suitability: {
    grade: "High" | "Moderate" | "Low" | "Not Suitable" | string;
    score: number;
    confidence: number;
    limiting_factors: string[];
  };
  environment: {
    rainfall_mm: number;
    temp_max_c: number;
    temp_min_c: number;
    temp_mean_c: number;
    humidity_pct: number;
    solar_radiation_mj_m2: number;
    ph: number;
    organic_carbon_g_kg: number;
    nitrogen_g_kg: number;
    phosphorus_ppm: number;
    potassium_ppm: number;
    texture_clay_pct: number;
    texture_sand_pct: number;
    texture_silt_pct: number;
  };
  satellite_features: {
    ndvi: number;
    ndwi: number;
    evi: number;
    savi: number;
    ndmi: number;
    elevation: number;
    slope: number;
    twi: number;
    vv: number;
    vh: number;
  };
  recommended_crops: Array<{
    crop_id: string;
    crop_name: string;
    category: string;
    recommendation_score: number;
    suitability_score: number;
    expected_yield_t_ha: { p10: number; p50: number; p90: number };
    expected_production_t: { p10: number; p50: number; p90: number };
    irrigation_mode: "rainfed" | "supplemental" | "full";
    water_need_mm: number;
    climate_risk_score: number;
    climate_risk_note: string;
    intercrop_options: Array<{
      companion_crop_id: string;
      companion_crop_name: string;
      yield_boost_pct: number;
      companion_share_factor: number;
      rationale: string;
    }>;
    rationale: string;
    data_confidence: "high" | "medium" | "low";
  }>;
  yield_summary: {
    top_recommended_crop: string;
    p10_t_ha: number;
    p50_t_ha: number;
    p90_t_ha: number;
  };
  production_summary: {
    top_recommended_crop: string;
    p10_t: number;
    p50_t: number;
    p90_t: number;
    area_ha: number;
  };
  irrigation_summary: {
    recommended_mode: string;
    total_water_demand_m3: number;
    effective_rainfall_mm: number;
  };
  climate_risk_summary: {
    overall_risk_level: string;
    drought_risk_score: number;
    heat_risk_score: number;
    excess_rain_risk_score: number;
    note: string;
  };
  intercrop_summary: {
    top_pair: string;
    estimated_production_boost_t: number;
    disclaimer: string;
  };
  model_status: {
    model_a: "ok" | "fallback";
    model_b: "ok" | "fallback";
    model_c: "ok" | "fallback";
    model_d: "ok" | "fallback";
    model_e: "ok" | "fallback";
  };
}

export async function fetchFullReport(payload: PredictRequestPayload): Promise<FullReportResponse> {
  const response = await fetch(`${API_BASE_URL}/predict/full-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchFieldArea(polygon: [number, number][]): Promise<{ area_ha: number; polygon_valid: boolean }> {
  const response = await fetch(`${API_BASE_URL}/field/area`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ polygon })
  });
  if (!response.ok) {
    throw new Error(`Area API error: ${response.statusText}`);
  }
  return response.json();
}
