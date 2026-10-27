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

  // When deployed on production (e.g. Vercel, custom domain), default to live Render backend
  if (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return 'https://geoagri-backend.onrender.com/api/v1';
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
  plot_name?: string | null;
  boundary_source?: string | null;
  area_source?: string | null;
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

export interface LandClassification {
  dominant: "AGRICULTURAL" | "FOREST_LEGAL" | "FOREST_COVER" | "WASTELAND" | "URBAN_BUILT" | "WATER_BODY" | "UNKNOWN";
  class_shares: Record<string, number>;
  subclass?: string | null;
  legal_forest_status?: string;
  confidence: number;
}

export interface IrrigabilityReason {
  rule_id: string;
  verdict: string;
  reason: string;
  layer: string;
}

export interface Irrigability {
  verdict: "IRRIGABLE" | "CONDITIONALLY_IRRIGABLE" | "NOT_IRRIGABLE" | "NOT_IRRIGABLE_PROVISIONAL" | "UNVERIFIED";
  reasons: IrrigabilityReason[];
  reclaimable?: string | null;
  irrigable_area_ha?: number | null;
  irrigation_options: string[];
  crop_models: "evaluated" | "skipped_not_irrigable";
}

export interface LandRecordSummary {
  providers: Array<{ id: string; name: string; status: string; records_found: number }>;
  record?: Record<string, any> | null;
}

export interface LandInquiryResponse {
  query: Record<string, any>;
  admin: Record<string, any>;
  land_class: LandClassification;
  irrigability: Irrigability;
  land_records: LandRecordSummary;
  layers: Array<Record<string, any>>;
  data_quality: { observed_feature_share: number; notes: string[] };
  detection?: Record<string, any> | null;
  gate_mode?: string | null;
  area_check?: Record<string, any> | null;
  disclaimer: string;
  assessment_timestamp: string;
}

export interface FullReportResponse {
  field_summary: {
    area_ha: number | null;
    centroid_lon: number;
    centroid_lat: number;
    polygon_valid: boolean;
    boundary_source?: string;
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
    intercrop_data_available?: boolean;
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
    model_a: "ok" | "fallback" | "skipped_not_irrigable";
    model_b: "ok" | "fallback" | "skipped_not_irrigable";
    model_c: "ok" | "fallback" | "skipped_not_irrigable";
    model_d: "ok" | "fallback" | "skipped_not_irrigable";
    model_e: "ok" | "fallback" | "skipped_not_irrigable";
  };
  land_class?: LandClassification | null;
  irrigability?: Irrigability | null;
  land_records?: LandRecordSummary | null;
  detection?: Record<string, any> | null;
  gate_mode?: string | null;
  area_check?: Record<string, any> | null;
  imputed_features?: string[] | null;
  disclaimer?: string;
}

export async function fetchFullReport(payload: PredictRequestPayload): Promise<FullReportResponse> {
  const controller = new AbortController();
  // Allow up to 90 seconds in case Render free tier is waking up from sleep mode
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  try {
    const response = await fetch(`${API_BASE_URL}/predict/full-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorDetail = "";
      try {
        const errJson = await response.json();
        if (Array.isArray(errJson.detail)) {
          errorDetail = errJson.detail.map((d: any) => `${d.loc?.slice(-1)[0] || 'field'}: ${d.msg}`).join("; ");
        } else if (typeof errJson.detail === 'object') {
          errorDetail = JSON.stringify(errJson.detail);
        } else {
          errorDetail = errJson.detail || errJson.message || "";
        }
      } catch {
        // Not JSON
      }
      if (!errorDetail && response.status === 405) {
        errorDetail = "Endpoint returned 405 (Method Not Allowed). Check backend routing.";
      }
      throw new Error(
        errorDetail
          ? `Server error (${response.status}): ${errorDetail}`
          : `HTTP ${response.status} ${response.statusText || 'Backend server response failed'}`
      );
    }

    return await response.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error("Request timed out. The Render backend may be waking up from sleep mode (this can take ~45s on the free tier). Please click 'Retry Field Analysis'.");
    }
    throw err;
  }
}

export class AreaValidationError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number = 500, code?: string) {
    super(message);
    this.name = "AreaValidationError";
    this.status = status;
    this.code = code;
  }
}

export interface AreaResponse {
  area_ha: number | null;
  perimeter_m?: number;
  centroid?: [number, number];
  polygon_valid: boolean;
  area_method?: string;
}

export async function fetchFieldArea(polygon: [number, number][]): Promise<AreaResponse> {
  const response = await fetch(`${API_BASE_URL}/field/area`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ polygon })
  });
  if (!response.ok) {
    let errCode: string | undefined;
    let errMsg = `Area API error: ${response.statusText}`;
    try {
      const errData = await response.json();
      errCode = errData?.detail?.code ?? errData?.code ?? 'AREA_CALCULATION_FAILED';
      errMsg = errData?.detail?.message ?? (typeof errData?.detail === 'string' ? errData.detail : null) ?? errData?.message ?? `Area API error: ${response.statusText}`;
    } catch {
      // ignore json parse error
    }
    throw new AreaValidationError(errMsg, response.status, errCode);
  }
  return await response.json();
}

export async function fetchLandInquiry(payload: {
  polygon?: [number, number][];
  point?: [number, number];
  survey_ref?: Record<string, any>;
}): Promise<LandInquiryResponse> {
  const response = await fetch(`${API_BASE_URL}/land/inquiry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`Land Inquiry error: ${response.statusText}`);
  }
  return await response.json();
}

export async function uploadLandRecord(file: File): Promise<{ doc_token: string; summary: Record<string, any> }> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE_URL}/land/records/upload`, {
    method: "POST",
    body: formData
  });
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }
  return await response.json();
}
