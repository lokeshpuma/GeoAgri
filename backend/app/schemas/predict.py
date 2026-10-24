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
    limit: int = Field(default=10, ge=1, le=250)
    irrigation_preference: Literal["rainfed", "supplemental", "full"] | None = "rainfed"
    manual_soil: ManualSoilInput | None = None
    survey_ref: dict[str, Any] | None = None


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
    category: str = "general"
    recommendation_score: float = 0.0
    canonical_id: str | None = None
    suitability_score: float
    suitability_grade: str = "Moderate"
    expected_yield_t_ha: QuantileValue
    expected_production_t: QuantileValue
    irrigation_mode: Literal["rainfed", "supplemental", "full"]
    water_need_mm: float
    climate_risk_score: float
    climate_risk_note: str
    intercrop_options: list[IntercropOption] = []
    rationale: str
    data_confidence: Literal["high", "medium", "low"]
    regional_agronomic_prior: float = 1.0
    intercrop_data_available: bool = True


class FieldSummary(BaseModel):
    area_ha: float | None = None
    centroid_lon: float
    centroid_lat: float
    polygon_valid: bool
    boundary_source: str = "user_drawn"


class LandSuitability(BaseModel):
    grade: str
    score: float
    confidence: float
    limiting_factors: list[str]


class EnvironmentSummary(BaseModel):
    rainfall_mm: float
    temp_max_c: float
    temp_min_c: float
    temp_mean_c: float
    humidity_pct: float
    solar_radiation_mj_m2: float
    ph: float
    organic_carbon_g_kg: float
    nitrogen_g_kg: float
    phosphorus_ppm: float | None = None
    potassium_ppm: float | None = None
    texture_clay_pct: float
    texture_sand_pct: float
    texture_silt_pct: float


class SatelliteFeatures(BaseModel):
    ndvi: float
    ndwi: float
    evi: float
    savi: float
    ndmi: float
    elevation: float
    slope: float
    twi: float
    vv: float
    vh: float


class YieldSummary(BaseModel):
    top_recommended_crop: str
    p10_t_ha: float
    p50_t_ha: float
    p90_t_ha: float


class ProductionSummary(BaseModel):
    top_recommended_crop: str
    p10_t: float
    p50_t: float
    p90_t: float
    area_ha: float | None = None


class IrrigationSummary(BaseModel):
    recommended_mode: str
    total_water_demand_m3: float
    effective_rainfall_mm: float


class ClimateRiskSummary(BaseModel):
    overall_risk_level: str
    drought_risk_score: float
    heat_risk_score: float
    excess_rain_risk_score: float
    note: str


class IntercropSummary(BaseModel):
    top_pair: str
    estimated_production_boost_t: float
    disclaimer: str = "Intercrop yield boost is an estimate dependent on field management practices."


class ModelStatus(BaseModel):
    model_a: Literal["ok", "fallback", "skipped_not_irrigable"] = "ok"
    model_b: Literal["ok", "fallback", "skipped_not_irrigable"] = "ok"
    model_c: Literal["ok", "fallback", "skipped_not_irrigable"] = "ok"
    model_d: Literal["ok", "fallback", "skipped_not_irrigable"] = "ok"
    model_e: Literal["ok", "fallback", "skipped_not_irrigable"] = "ok"


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
    field_summary: FieldSummary
    land_suitability: LandSuitability
    environment: EnvironmentSummary
    satellite_features: SatelliteFeatures
    recommended_crops: list[RecommendedCrop]
    yield_summary: YieldSummary
    production_summary: ProductionSummary
    irrigation_summary: IrrigationSummary
    climate_risk_summary: ClimateRiskSummary
    intercrop_summary: IntercropSummary
    model_status: ModelStatus
    land_class: LandClassification | None = None
    irrigability: Irrigability | None = None
    land_records: LandRecordSummary | None = None
    eligibility: dict[str, Any] | None = None
    detection: dict[str, Any] | None = None
    gate_mode: str | None = None
    area_check: dict[str, Any] | None = None
    imputed_features: list[str] | None = None
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

