"""
Prediction & Land Intelligence Request and Response Schemas (PRD v2.0 §10).
Defines Pydantic models for land classification, irrigability, records enquiry, and crop reports.
"""
from __future__ import annotations

from typing import Literal, Any
from pydantic import BaseModel, Field


class ManualSoilInput(BaseModel):
    ph: float | None = None
    organic_carbon: float | None = None
    nitrogen: float | None = None
    phosphorus: float | None = None
    potassium: float | None = None
    texture_clay_pct: float | None = None
    texture_sand_pct: float | None = None
    texture_silt_pct: float | None = None


class PredictRequest(BaseModel):
    polygon: list[list[float]] | None = None
    point: list[float] | None = None
    area_ha: float | None = None
    season: Literal["kharif", "rabi", "zaid", "annual", "perennial"] = "kharif"
    limit: int = Field(default=20, ge=1, le=250)
    irrigation_preference: Literal["rainfed", "supplemental", "full"] | None = "rainfed"
    manual_soil: ManualSoilInput | None = None
    survey_ref: dict[str, Any] | None = None
    plot_name: str | None = None
    boundary_source: str | None = None
    area_source: str | None = None


class SourceStatus(BaseModel):
    name: str
    state: Literal["ok", "failed", "skipped"]
    reason: str | None = None
    fetched_at: str | None = None


class QuantileValue(BaseModel):
    p10: float
    p50: float
    p90: float


class IntercropOption(BaseModel):
    companion_crop_id: str = ""
    companion_crop_name: str = ""
    yield_boost_pct: float = 0.0
    companion_share_factor: float = 0.25
    rationale: str = ""
    companion_crop: str | None = None
    synergy_type: str | None = None
    water_competition: str | None = None
    expected_yield_boost_pct: float | None = None


class RecommendedCrop(BaseModel):
    crop_id: str = ""
    crop_name: str
    scientific_name: str | None = None
    category: str = "general"
    recommendation_score: float = 0.0
    canonical_id: str | None = None
    suitability_score: float | None = None
    suitability_grade: str | None = None
    expected_yield_t_ha: QuantileValue | None = None
    expected_production_t: QuantileValue | None = None
    irrigation_mode: Literal["rainfed", "supplemental", "full"] = "rainfed"
    water_need_mm: float | None = None
    climate_risk_score: float | None = None
    climate_risk_note: str | None = None
    yield_note: str | None = None
    score_source: str | None = None
    intercrop_options: list[IntercropOption] = []
    rationale: str = ""
    data_confidence: Literal["high", "medium", "low"] = "medium"
    regional_agronomic_prior: float = 1.0
    intercrop_data_available: bool = True
    confidence_tier: Literal["A", "B"] = "A"
    method: str = "ml_model"
    score: float | None = None
    score_rainfed: float | None = None
    score_irrigated: float | None = None
    season_months: int | None = None
    limiting_factor: str | None = None
    best_planting_month: int | None = None
    notes: list[str] = []


class FieldSummary(BaseModel):
    area_ha: float | None = None
    centroid_lon: float
    centroid_lat: float
    polygon_valid: bool
    boundary_source: str = "user_drawn"
    plot_name: str | None = None
    area_source: str | None = None


class LandSuitability(BaseModel):
    grade: str
    score: float | None = None
    confidence: float | None = None
    limiting_factors: list[str] = []


class EnvironmentSummary(BaseModel):
    rainfall_mm: float | None = None
    temp_max_c: float | None = None
    temp_min_c: float | None = None
    temp_mean_c: float | None = None
    humidity_pct: float | None = None
    solar_radiation_mj_m2: float | None = None
    ph: float | None = None
    organic_carbon_g_kg: float | None = None
    nitrogen_g_kg: float | None = None
    phosphorus_ppm: float | None = None
    potassium_ppm: float | None = None
    texture_clay_pct: float | None = None
    texture_sand_pct: float | None = None
    texture_silt_pct: float | None = None


class SatelliteFeatures(BaseModel):
    ndvi: float | None = None
    ndwi: float | None = None
    evi: float | None = None
    savi: float | None = None
    ndmi: float | None = None
    elevation: float | None = None
    slope: float | None = None
    twi: float | None = None
    vv: float | None = None
    vh: float | None = None


class YieldSummary(BaseModel):
    top_recommended_crop: str | None = None
    p10_t_ha: float | None = None
    p50_t_ha: float | None = None
    p90_t_ha: float | None = None


class ProductionSummary(BaseModel):
    top_recommended_crop: str | None = None
    p10_t: float | None = None
    p50_t: float | None = None
    p90_t: float | None = None
    area_ha: float | None = None


class IrrigationSummary(BaseModel):
    recommended_mode: str | None = None
    total_water_demand_m3: float | None = None
    effective_rainfall_mm: float | None = None


class ClimateRiskSummary(BaseModel):
    overall_risk_level: str | None = None
    drought_risk_score: float | None = None
    heat_risk_score: float | None = None
    excess_rain_risk_score: float | None = None
    note: str | None = None


class IntercropSummary(BaseModel):
    top_pair: str | None = None
    estimated_production_boost_t: float | None = None
    disclaimer: str = "Intercrop yield boost is an estimate dependent on field management practices."


class ModelStatus(BaseModel):
    model_a: Literal["ok", "fallback", "skipped_not_irrigable", "skipped_unavailable"] = "ok"
    model_b: Literal["ok", "fallback", "skipped_not_irrigable", "skipped_unavailable"] = "ok"
    model_c: Literal["ok", "fallback", "skipped_not_irrigable", "skipped_unavailable"] = "ok"
    model_d: Literal["ok", "fallback", "skipped_not_irrigable", "skipped_unavailable"] = "ok"
    model_e: Literal["ok", "fallback", "skipped_not_irrigable", "skipped_unavailable"] = "ok"


class LandClassification(BaseModel):
    dominant: Literal[
        "AGRICULTURAL",
        "FOREST_LEGAL",
        "FOREST_COVER",
        "WASTELAND",
        "URBAN_BUILT",
        "WATER_BODY",
        "UNKNOWN"
    ]
    class_shares: dict[str, float]
    subclass: str | None = None
    legal_forest_status: str = "unknown"
    confidence: float
    conflict: bool = False
    conflict_reason: str | None = None


class Irrigability(BaseModel):
    verdict: Literal[
        "IRRIGABLE",
        "CONDITIONALLY_IRRIGABLE",
        "NOT_IRRIGABLE",
        "NOT_IRRIGABLE_PROVISIONAL",
        "UNVERIFIED"
    ]
    reasons: list[dict[str, Any]] = []
    reclaimable: str | None = None
    irrigable_area_ha: float | None = None
    irrigation_options: list[str] = []
    crop_models: Literal["evaluated", "skipped_not_irrigable"] = "evaluated"


class LandRecordSummary(BaseModel):
    providers: list[dict[str, Any]] = []
    record: dict[str, Any] | None = None


class FullReportResponse(BaseModel):
    analysis_status: Literal["complete", "partial", "unavailable"] = "complete"
    sources: list[SourceStatus] = []
    data_mode: Literal["live", "demo_synthetic"] = "live"
    field_summary: FieldSummary
    land_suitability: LandSuitability
    environment: EnvironmentSummary
    satellite_features: SatelliteFeatures | None = None
    recommended_crops: list[RecommendedCrop] = []
    excluded_crops: list[dict[str, Any]] = []
    yield_summary: YieldSummary | None = None
    production_summary: ProductionSummary | None = None
    irrigation_summary: IrrigationSummary | None = None
    climate_risk_summary: ClimateRiskSummary | None = None
    intercrop_summary: IntercropSummary | None = None
    model_status: ModelStatus
    land_class: LandClassification | None = None
    irrigability: Irrigability | None = None
    land_records: LandRecordSummary | None = None
    eligibility: dict[str, Any] | None = None
    detection: dict[str, Any] | None = None
    gate_mode: str | None = None
    area_check: dict[str, Any] | None = None
    imputed_features: list[str] | None = None
    climatology_status: str = "available"
    climatology_message: str | None = None
    disclaimer: str = "Decision-support only. Not a legal land record, conversion certificate or survey."


class LandInquiryResponse(BaseModel):
    query: dict[str, Any]
    admin: dict[str, Any]
    land_class: LandClassification
    irrigability: Irrigability
    land_records: LandRecordSummary
    layers: list[dict[str, Any]] = []
    data_quality: dict[str, Any] = {"observed_feature_share": 0.0, "notes": []}
    detection: dict[str, Any] | None = None
    gate_mode: str | None = None
    area_check: dict[str, Any] | None = None
    disclaimer: str = "Decision-support only. Not a legal land record, conversion certificate or survey."
    assessment_timestamp: str

