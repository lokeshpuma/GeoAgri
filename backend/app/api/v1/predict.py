"""
Prediction Router Endpoint (PRD v2.0 §7, §10).
`POST /api/v1/predict/full-report`
Orchestrates profile retrieval, feature extraction, land classification,
irrigability gating, parallel model execution, fusion, and production math.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from app.schemas.predict import (
    PredictRequest, FullReportResponse, QuantileValue, IntercropOption,
    RecommendedCrop, FieldSummary, LandSuitability, EnvironmentSummary,
    SatelliteFeatures, YieldSummary, ProductionSummary, IrrigationSummary,
    ClimateRiskSummary, IntercropSummary, ModelStatus
)
from app.services.features.profile import build_environmental_profile
from app.services.features.pipeline import get_feature_pipeline
from app.models.registry import get_model_registry
from app.services.fusion.engine import run_decision_fusion
from app.services.landclass.classifier import get_land_classifier
from app.services.irrigability.engine import get_irrigability_engine
from app.services.landrecords.manager import get_land_record_manager

router = APIRouter()


@router.post("/predict/full-report", response_model=FullReportResponse)
async def generate_full_report(req: PredictRequest):
    try:
        manual_soil_dict = req.manual_soil.model_dump() if req.manual_soil else None
        
        # 1. Build environmental profile (geodesic geometry, weather, soil, satellite)
        profile = await build_environmental_profile(
            polygon_pts=req.polygon,
            point_pt=req.point,
            season=req.season,
            manual_soil=manual_soil_dict
        )

        # 2. Extract 78-layer feature vector
        pipeline = get_feature_pipeline()
        vector = pipeline.extract_feature_vector(profile)

        # 3. Land Intelligence Layer (Records, Classification, Irrigability)
        lon = profile["field_summary"]["centroid_lon"]
        lat = profile["field_summary"]["centroid_lat"]
        record_mgr = get_land_record_manager()
        record_summary = await record_mgr.get_summary(lon, lat, req.survey_ref)

        classifier = get_land_classifier()
        land_class = classifier.classify(vector, record=record_summary.record)

        engine = get_irrigability_engine()
        gross_area = req.area_ha if (req.area_ha is not None and req.area_ha > 0) else profile["field_summary"]["area_ha"]
        irrigability = engine.evaluate(land_class, vector, area_ha=gross_area, record=record_summary.record)

        # Update field summary with boundary source
        profile["field_summary"]["boundary_source"] = "user_drawn" if req.polygon else ("point_only" if req.point else "user_provided")
        profile["field_summary"]["area_ha"] = gross_area

        w = profile["weather"]
        s = profile["soil"]
        sat = profile["satellite"]

        # 4. PREDICTION GATING (PRD v2.0 §7.2, §10, M6):
        # Non-irrigable plots return ZERO crops, red verdict, and BYPASS Models A-E execution completely.
        if irrigability.verdict in ["NOT_IRRIGABLE", "NOT_IRRIGABLE_PROVISIONAL"]:
            limiting = [r["reason"] for r in irrigability.reasons]
            return FullReportResponse(
                field_summary=FieldSummary(**profile["field_summary"]),
                land_suitability=LandSuitability(
                    grade="Not Suitable",
                    score=0.0,
                    confidence=land_class.confidence,
                    limiting_factors=limiting
                ),
                environment=EnvironmentSummary(
                    rainfall_mm=w.get("rainfall_mm", 0.0),
                    temp_max_c=w.get("temp_max_c", 0.0),
                    temp_min_c=w.get("temp_min_c", 0.0),
                    temp_mean_c=w.get("temp_mean_c", 0.0),
                    humidity_pct=w.get("humidity_pct", 0.0),
                    solar_radiation_mj_m2=w.get("solar_radiation_mj_m2", 0.0),
                    ph=s.get("ph", 7.0),
                    organic_carbon_g_kg=s.get("organic_carbon_g_kg", 0.0),
                    nitrogen_g_kg=s.get("nitrogen_g_kg", 0.0),
                    phosphorus_ppm=s.get("phosphorus_ppm"),
                    potassium_ppm=s.get("potassium_ppm"),
                    texture_clay_pct=s.get("texture_clay_pct", 0.0),
                    texture_sand_pct=s.get("texture_sand_pct", 0.0),
                    texture_silt_pct=s.get("texture_silt_pct", 0.0)
                ),
                satellite_features=SatelliteFeatures(
                    ndvi=sat.get("ndvi", 0.0),
                    ndwi=sat.get("ndwi", 0.0),
                    evi=sat.get("evi", 0.0),
                    savi=sat.get("savi", 0.0),
                    ndmi=sat.get("ndmi", 0.0),
                    elevation=sat.get("elevation", 0.0),
                    slope=sat.get("slope", 0.0),
                    twi=sat.get("twi", 0.0),
                    vv=sat.get("vv", 0.0),
                    vh=sat.get("vh", 0.0)
                ),
                recommended_crops=[],
                yield_summary=YieldSummary(
                    top_recommended_crop="None (Not Irrigable)",
                    p10_t_ha=0.0,
                    p50_t_ha=0.0,
                    p90_t_ha=0.0
                ),
                production_summary=ProductionSummary(
                    top_recommended_crop="None (Not Irrigable)",
                    p10_t=0.0,
                    p50_t=0.0,
                    p90_t=0.0,
                    area_ha=gross_area
                ),
                irrigation_summary=IrrigationSummary(
                    recommended_mode="Not Applicable",
                    total_water_demand_m3=0.0,
                    effective_rainfall_mm=round(w["rainfall_mm"] * 0.75, 1)
                ),
                climate_risk_summary=ClimateRiskSummary(
                    overall_risk_level="Critical",
                    drought_risk_score=100.0,
                    heat_risk_score=100.0,
                    excess_rain_risk_score=100.0,
                    note=f"Plot verdict is {irrigability.verdict} ({land_class.dominant}). Agronomic crop recommendation bypassed."
                ),
                intercrop_summary=IntercropSummary(
                    top_pair="None",
                    estimated_production_boost_t=0.0,
                    disclaimer="Not applicable for non-irrigable land."
                ),
                model_status=ModelStatus(
                    model_a="skipped_not_irrigable",
                    model_b="skipped_not_irrigable",
                    model_c="skipped_not_irrigable",
                    model_d="skipped_not_irrigable",
                    model_e="skipped_not_irrigable"
                ),
                land_class=land_class,
                irrigability=irrigability,
                land_records=record_summary
            )

        # 5. Parallel Models A-E execution (For Irrigable and Conditionally Irrigable plots)
        model_reg = get_model_registry()
        model_outputs = await model_reg.run_models_parallel(vector, season=req.season)

        # 6. Decision Fusion & Crop Ranking
        recs = run_decision_fusion(
            model_outputs=model_outputs,
            irrigation_preference=req.irrigation_preference or "rainfed",
            limit=req.limit
        )

        # Usable effective area (after building footprint / setback deductions)
        effective_area_ha = irrigability.irrigable_area_ha if irrigability.irrigable_area_ha is not None else gross_area
        calc_area = effective_area_ha if effective_area_ha is not None else 0.0

        # 7. Production & Intercrop Math
        formatted_recs = []
        for r in recs:
            p10_yield = r["expected_yield_t_ha"]["p10"]
            p50_yield = r["expected_yield_t_ha"]["p50"]
            p90_yield = r["expected_yield_t_ha"]["p90"]

            prod_p10 = round(p10_yield * calc_area, 2)
            prod_p50 = round(p50_yield * calc_area, 2)
            prod_p90 = round(p90_yield * calc_area, 2)

            intercrop_opts = [
                IntercropOption(**opt) for opt in r.get("intercrop_options", [])
            ]

            rec_crop = RecommendedCrop(
                crop_id=r["crop_id"],
                crop_name=r["crop_name"],
                category=r["category"],
                recommendation_score=r["recommendation_score"],
                suitability_score=r["suitability_score"],
                expected_yield_t_ha=QuantileValue(p10=p10_yield, p50=p50_yield, p90=p90_yield),
                expected_production_t=QuantileValue(p10=prod_p10, p50=prod_p50, p90=prod_p90),
                irrigation_mode=r["irrigation_mode"],
                water_need_mm=r["water_need_mm"],
                climate_risk_score=r["climate_risk_score"],
                climate_risk_note=r["climate_risk_note"],
                intercrop_options=intercrop_opts,
                rationale=r["rationale"],
                data_confidence=r["data_confidence"],
                regional_agronomic_prior=r.get("regional_agronomic_prior", 1.0),
                intercrop_data_available=r.get("intercrop_data_available", True)
            )
            formatted_recs.append(rec_crop)

        top_rec = formatted_recs[0] if formatted_recs else None

        # Intercrop boost math for top crop
        top_pair_str = "None (Sole Cropping)"
        intercrop_boost_t = 0.0
        if top_rec and top_rec.intercrop_options:
            opt = top_rec.intercrop_options[0]
            top_pair_str = f"{top_rec.crop_name} + {opt.companion_crop_name}"
            intercrop_boost_t = round(top_rec.expected_production_t.p50 * opt.yield_boost_pct * opt.companion_share_factor, 3)

        mod_a = model_outputs["model_a"]

        return FullReportResponse(
            field_summary=FieldSummary(**profile["field_summary"]),
            land_suitability=LandSuitability(
                grade=mod_a.get("grade", "Moderate"),
                score=mod_a.get("score", 0.70),
                confidence=mod_a.get("confidence", 0.85),
                limiting_factors=mod_a.get("limiting_factors", [])
            ),
            environment=EnvironmentSummary(
                rainfall_mm=w.get("rainfall_mm", 0.0),
                temp_max_c=w.get("temp_max_c", 0.0),
                temp_min_c=w.get("temp_min_c", 0.0),
                temp_mean_c=w.get("temp_mean_c", 0.0),
                humidity_pct=w.get("humidity_pct", 0.0),
                solar_radiation_mj_m2=w.get("solar_radiation_mj_m2", 0.0),
                ph=s.get("ph", 7.0),
                organic_carbon_g_kg=s.get("organic_carbon_g_kg", 0.0),
                nitrogen_g_kg=s.get("nitrogen_g_kg", 0.0),
                phosphorus_ppm=s.get("phosphorus_ppm"),
                potassium_ppm=s.get("potassium_ppm"),
                texture_clay_pct=s.get("texture_clay_pct", 0.0),
                texture_sand_pct=s.get("texture_sand_pct", 0.0),
                texture_silt_pct=s.get("texture_silt_pct", 0.0)
            ),
            satellite_features=SatelliteFeatures(
                ndvi=sat.get("ndvi", 0.0),
                ndwi=sat.get("ndwi", 0.0),
                evi=sat.get("evi", 0.0),
                savi=sat.get("savi", 0.0),
                ndmi=sat.get("ndmi", 0.0),
                elevation=sat.get("elevation", 0.0),
                slope=sat.get("slope", 0.0),
                twi=sat.get("twi", 0.0),
                vv=sat.get("vv", 0.0),
                vh=sat.get("vh", 0.0)
            ),
            recommended_crops=formatted_recs,
            yield_summary=YieldSummary(
                top_recommended_crop=top_rec.crop_name if top_rec else "N/A",
                p10_t_ha=top_rec.expected_yield_t_ha.p10 if top_rec else 0.0,
                p50_t_ha=top_rec.expected_yield_t_ha.p50 if top_rec else 0.0,
                p90_t_ha=top_rec.expected_yield_t_ha.p90 if top_rec else 0.0,
            ),
            production_summary=ProductionSummary(
                top_recommended_crop=top_rec.crop_name if top_rec else "N/A",
                p10_t=top_rec.expected_production_t.p10 if top_rec else 0.0,
                p50_t=top_rec.expected_production_t.p50 if top_rec else 0.0,
                p90_t=top_rec.expected_production_t.p90 if top_rec else 0.0,
                area_ha=effective_area_ha
            ),
            irrigation_summary=IrrigationSummary(
                recommended_mode=top_rec.irrigation_mode if top_rec else "rainfed",
                total_water_demand_m3=round(top_rec.water_need_mm * 10.0 * calc_area, 1) if top_rec else 0.0,
                effective_rainfall_mm=round(w["rainfall_mm"] * 0.75, 1)
            ),
            climate_risk_summary=ClimateRiskSummary(
                overall_risk_level="Low" if (top_rec and top_rec.climate_risk_score < 35) else ("Moderate" if (top_rec and top_rec.climate_risk_score < 60) else "High"),
                drought_risk_score=round(top_rec.climate_risk_score * 0.4, 1) if top_rec else 15.0,
                heat_risk_score=round(top_rec.climate_risk_score * 0.3, 1) if top_rec else 10.0,
                excess_rain_risk_score=round(top_rec.climate_risk_score * 0.3, 1) if top_rec else 10.0,
                note=top_rec.climate_risk_note if top_rec else "Low climatic risk profile."
            ),
            intercrop_summary=IntercropSummary(
                top_pair=top_pair_str,
                estimated_production_boost_t=intercrop_boost_t,
                disclaimer="Intercrop yield boost is an estimate dependent on field management practices."
            ),
            model_status=ModelStatus(**model_outputs["model_status"]),
            land_class=land_class,
            irrigability=irrigability,
            land_records=record_summary
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Prediction pipeline error: {str(e)}")
