"""
Prediction Router Endpoint (PRD v2.0 §7, §10).
`POST /api/v1/predict/full-report`
Orchestrates profile retrieval, feature extraction, land classification,
irrigability gating, parallel model execution, fusion, and production math.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
import logging
import uuid
from app.schemas.predict import (
    PredictRequest, FullReportResponse, QuantileValue, IntercropOption,
    RecommendedCrop, FieldSummary, LandSuitability, EnvironmentSummary,
    SatelliteFeatures, YieldSummary, ProductionSummary, IrrigationSummary,
    ClimateRiskSummary, IntercropSummary, ModelStatus, LandClassification,
    Irrigability, LandRecordSummary
)
from app.core.config import get_settings
from app.services.features.profile import build_environmental_profile
from app.services.features.pipeline import get_feature_pipeline
from app.models.registry import get_model_registry
from app.services.fusion.engine import run_decision_fusion
from app.services.landclass.classifier import get_land_classifier
from app.services.irrigability.engine import get_irrigability_engine
from app.services.landrecords.manager import get_land_record_manager
from app.services.landclass.evidence import collect_evidence
from app.services.landclass.detection import to_legacy_area_check
from app.services.weather.climatology import fetch_monthly_climatology
from app.services.crops.envelope_suitability import Site, rank_crops
from app.api.errors import handle_internal_error

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/predict/full-report", response_model=FullReportResponse)
async def generate_full_report(req: PredictRequest):
    settings = get_settings()
    det_mode = settings.LAND_DETECTION_MODE.lower()
    gate_mode = settings.LAND_GATE_MODE.lower()

    # Validation per M26
    if req.polygon is not None:
        if len(req.polygon) < 3:
            raise HTTPException(status_code=400, detail="Invalid polygon geometry: polygon must have at least 3 points.")
        for pt in req.polygon:
            if not isinstance(pt, (list, tuple)) or len(pt) < 2:
                raise HTTPException(status_code=400, detail="Invalid polygon geometry: invalid coordinate point format.")
            lon_val, lat_val = pt[0], pt[1]
            if not (-180.0 <= lon_val <= 180.0 and -90.0 <= lat_val <= 90.0):
                raise HTTPException(status_code=400, detail=f"Invalid polygon geometry: coordinate out of bounds ({lon_val}, {lat_val}).")

    try:
        manual_soil_dict = req.manual_soil.model_dump() if req.manual_soil else None
        
        # 1. Build environmental profile with exception containment per M26
        try:
            profile = await build_environmental_profile(
                polygon_pts=req.polygon,
                point_pt=req.point,
                season=req.season,
                manual_soil=manual_soil_dict
            )
        except Exception as ev_err:
            logger.warning("Upstream environmental profile/evidence exception: %s", ev_err)
            c_lon = req.point[0] if req.point else (req.polygon[0][0] if req.polygon else 0.0)
            c_lat = req.point[1] if req.point else (req.polygon[0][1] if req.polygon else 0.0)
            unknown_class = LandClassification(
                dominant="UNKNOWN",
                class_shares={"UNKNOWN": 1.0},
                subclass="insufficient_evidence",
                legal_forest_status="unknown",
                confidence=0.0
            )
            unverified_irrigability = Irrigability(
                verdict="UNVERIFIED",
                reasons=[{
                    "rule_id": "upstream_evidence_failure",
                    "verdict": "UNVERIFIED",
                    "reason": f"External evidence services encountered an error: {str(ev_err)}",
                    "layer": "evidence_pipeline"
                }],
                reclaimable="unknown",
                irrigable_area_ha=None,
                irrigation_options=[],
                crop_models="skipped_not_irrigable"
            )
            return FullReportResponse(
                field_summary=FieldSummary(
                    area_ha=req.area_ha,
                    centroid_lon=c_lon,
                    centroid_lat=c_lat,
                    polygon_valid=bool(req.polygon),
                    boundary_source="user_drawn" if req.polygon else "point_only"
                ),
                land_suitability=LandSuitability(
                    grade="Not Evaluated",
                    score=0.0,
                    confidence=0.0,
                    limiting_factors=[f"Evidence retrieval warning: {str(ev_err)}"]
                ),
                environment=EnvironmentSummary(
                    rainfall_mm=0.0, temp_max_c=0.0, temp_min_c=0.0, temp_mean_c=0.0,
                    humidity_pct=0.0, solar_radiation_mj_m2=0.0, ph=7.0,
                    organic_carbon_g_kg=0.0, nitrogen_g_kg=0.0, texture_clay_pct=0.0,
                    texture_sand_pct=0.0, texture_silt_pct=0.0
                ),
                satellite_features=SatelliteFeatures(
                    ndvi=0.0, ndwi=0.0, evi=0.0, savi=0.0, ndmi=0.0, elevation=0.0,
                    slope=0.0, twi=0.0, vv=0.0, vh=0.0
                ),
                recommended_crops=[],
                yield_summary=YieldSummary(
                    top_recommended_crop="None (Unverified)", p10_t_ha=0.0, p50_t_ha=0.0, p90_t_ha=0.0
                ),
                production_summary=ProductionSummary(
                    top_recommended_crop="None (Unverified)", p10_t=0.0, p50_t=0.0, p90_t=0.0, area_ha=req.area_ha
                ),
                irrigation_summary=IrrigationSummary(
                    recommended_mode="rainfed", total_water_demand_m3=0.0, effective_rainfall_mm=0.0
                ),
                climate_risk_summary=ClimateRiskSummary(
                    overall_risk_level="Unknown", drought_risk_score=0.0, heat_risk_score=0.0,
                    excess_rain_risk_score=0.0, note="Evidence retrieval warning"
                ),
                intercrop_summary=IntercropSummary(top_pair="N/A", estimated_production_boost_t=0.0),
                model_status=ModelStatus(
                    model_a="skipped_not_irrigable", model_b="skipped_not_irrigable",
                    model_c="skipped_not_irrigable", model_d="skipped_not_irrigable",
                    model_e="skipped_not_irrigable"
                ),
                land_class=unknown_class,
                irrigability=unverified_irrigability,
                land_records=LandRecordSummary(providers=[], record=None),
                detection=None,
                gate_mode=gate_mode,
                area_check=None,
                imputed_features=None
            )

        # 2. Extract 78-layer feature vector
        pipeline = get_feature_pipeline()
        vector = pipeline.extract_feature_vector(profile)
        _, imputed_features = pipeline.impute_for_model(vector)

        # 3. Land Intelligence Layer (Records, Classification, Detection, Irrigability)
        lon = profile["field_summary"]["centroid_lon"]
        lat = profile["field_summary"]["centroid_lat"]
        record_mgr = get_land_record_manager()
        record_summary = await record_mgr.get_summary(lon, lat, req.survey_ref)

        evidence = None
        detection_dict = None
        area_check_alias = None

        if det_mode != "off":
            try:
                evidence = collect_evidence(
                    lat=lat,
                    lon=lon,
                    polygon=req.polygon,
                    rtc_record=record_summary.record,
                    features=vector
                )
                detection_dict = evidence.detection
                area_check_alias = to_legacy_area_check(evidence.detection, lat=lat, lon=lon)
            except Exception as det_err:
                logger.warning("Detection collection error: %s", det_err)

        classifier = get_land_classifier()
        if det_mode == "enforce" and evidence is not None:
            land_class = classifier.classify(evidence=evidence, record=record_summary.record)
        else:
            land_class = classifier.classify(vector, record=record_summary.record)

        engine = get_irrigability_engine()
        gross_area = req.area_ha if (req.area_ha is not None and req.area_ha > 0) else profile["field_summary"]["area_ha"]
        irrigability = engine.evaluate(land_class, vector, area_ha=gross_area, record=record_summary.record)

        # Update field summary with boundary source, plot_name, and area_source
        profile["field_summary"]["boundary_source"] = req.boundary_source or ("user_drawn" if req.polygon else ("point_only" if req.point else "user_provided"))
        profile["field_summary"]["area_ha"] = gross_area
        profile["field_summary"]["plot_name"] = req.plot_name
        profile["field_summary"]["area_source"] = req.area_source or ("manual" if req.area_ha is not None and req.area_ha > 0 else "calculated")

        w = profile["weather"]
        s = profile["soil"]
        sat = profile["satellite"]

        # 4. PREDICTION GATING (PRD v2.1 §5A.7, §7.2, §10, M6):
        # Non-irrigable plots return ZERO crops, red verdict, and BYPASS Models A-E execution completely
        # ONLY when gate_mode == "enforce". In shadow or off mode, continue and compute recommendations.
        if irrigability.verdict in ["NOT_IRRIGABLE", "NOT_IRRIGABLE_PROVISIONAL"] and gate_mode == "enforce":
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
                    rainfall_mm=w.get("rainfall_mm"),
                    temp_max_c=w.get("temp_max_c"),
                    temp_min_c=w.get("temp_min_c"),
                    temp_mean_c=w.get("temp_mean_c"),
                    humidity_pct=w.get("humidity_pct"),
                    solar_radiation_mj_m2=w.get("solar_radiation_mj_m2"),
                    ph=s.get("ph"),
                    organic_carbon_g_kg=s.get("organic_carbon_g_kg"),
                    nitrogen_g_kg=s.get("nitrogen_g_kg"),
                    phosphorus_ppm=s.get("phosphorus_ppm"),
                    potassium_ppm=s.get("potassium_ppm"),
                    texture_clay_pct=s.get("texture_clay_pct"),
                    texture_sand_pct=s.get("texture_sand_pct"),
                    texture_silt_pct=s.get("texture_silt_pct")
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
                    effective_rainfall_mm=round((w.get("rainfall_mm") or 0.0) * 0.75, 1)
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
                land_records=record_summary,
                detection=detection_dict,
                gate_mode=gate_mode,
                area_check=area_check_alias,
                imputed_features=imputed_features,
                climatology_status="unavailable" if land_class.dominant == "WATER_BODY" else "available",
                climatology_message="Site is over water body." if land_class.dominant == "WATER_BODY" else None
            )

        # 5. Climatology Evaluation (PRD v3.2 §3, AC-7, AC-8)
        c_lon, c_lat = profile["centroid"]
        climatology = profile.get("climatology") or await fetch_monthly_climatology(c_lat, c_lon)

        # Climatology failure handling: open ocean or unreachable service (AC-8)
        if not climatology.available or (land_class.dominant == "WATER_BODY" and gate_mode == "enforce"):
            unavail_msg = (
                "Site is over open water / water body."
                if land_class.dominant == "WATER_BODY"
                else (climatology.status_message or "Climatology service unavailable.")
            )
            return FullReportResponse(
                field_summary=FieldSummary(**profile["field_summary"]),
                land_suitability=LandSuitability(
                    grade="Unavailable",
                    score=0.0,
                    confidence=0.0,
                    limiting_factors=[unavail_msg]
                ),
                environment=EnvironmentSummary(
                    rainfall_mm=w.get("rainfall_mm"),
                    temp_max_c=w.get("temp_max_c"),
                    temp_min_c=w.get("temp_min_c"),
                    temp_mean_c=w.get("temp_mean_c"),
                    humidity_pct=w.get("humidity_pct"),
                    solar_radiation_mj_m2=w.get("solar_radiation_mj_m2"),
                    ph=s.get("ph"),
                    organic_carbon_g_kg=s.get("organic_carbon_g_kg"),
                    nitrogen_g_kg=s.get("nitrogen_g_kg"),
                    phosphorus_ppm=s.get("phosphorus_ppm"),
                    potassium_ppm=s.get("potassium_ppm"),
                    texture_clay_pct=s.get("texture_clay_pct"),
                    texture_sand_pct=s.get("texture_sand_pct"),
                    texture_silt_pct=s.get("texture_silt_pct")
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
                    top_recommended_crop="None (Climatology Unavailable)",
                    p10_t_ha=0.0,
                    p50_t_ha=0.0,
                    p90_t_ha=0.0
                ),
                production_summary=ProductionSummary(
                    top_recommended_crop="None (Climatology Unavailable)",
                    p10_t=0.0,
                    p50_t=0.0,
                    p90_t=0.0,
                    area_ha=gross_area
                ),
                irrigation_summary=IrrigationSummary(
                    recommended_mode="Not Applicable",
                    total_water_demand_m3=0.0,
                    effective_rainfall_mm=round((w.get("rainfall_mm") or 0.0) * 0.75, 1)
                ),
                climate_risk_summary=ClimateRiskSummary(
                    overall_risk_level="Unknown",
                    drought_risk_score=0.0,
                    heat_risk_score=0.0,
                    excess_rain_risk_score=0.0,
                    note=unavail_msg
                ),
                intercrop_summary=IntercropSummary(top_pair="N/A", estimated_production_boost_t=0.0),
                model_status=ModelStatus(
                    model_a="skipped_unavailable",
                    model_b="skipped_unavailable",
                    model_c="skipped_unavailable",
                    model_d="skipped_unavailable",
                    model_e="skipped_unavailable"
                ),
                land_class=land_class,
                irrigability=irrigability,
                land_records=record_summary,
                detection=detection_dict,
                gate_mode=gate_mode,
                area_check=area_check_alias,
                imputed_features=imputed_features,
                climatology_status="unavailable",
                climatology_message=unavail_msg
            )

        # 6. Water Mode Enforcement & Site Initialization (PRD v3.2 AC-7)
        is_irrigated = (
            irrigability.verdict != "NOT_IRRIGABLE"
            and req.irrigation_preference in ["supplemental", "full"]
        )
        effective_mode = (
            "full" if (is_irrigated and req.irrigation_preference == "full")
            else ("supplemental" if is_irrigated else "rainfed")
        )

        site = Site(
            monthly_temp_c=climatology.monthly_temp_c,
            monthly_rain_mm=climatology.monthly_rain_mm,
            ph=s.get("ph"),
            irrigated=is_irrigated
        )
        envelope_rankings = rank_crops(site, top_n=max(req.limit or 20, 100))
        envelope_by_id = {c.crop_id: c for c in envelope_rankings}

        # 7. Parallel Models A-E execution (For Irrigable, Conditionally Irrigable, or Shadow-mode plots)
        model_reg = get_model_registry()
        model_outputs = await model_reg.run_models_parallel(vector, season=req.season)

        # 8. Decision Fusion & Crop Ranking
        recs = run_decision_fusion(
            model_outputs=model_outputs,
            irrigation_preference=effective_mode,
            limit=req.limit
        )

        # Usable effective area (after building footprint / setback deductions)
        effective_area_ha = irrigability.irrigable_area_ha if irrigability.irrigable_area_ha is not None else gross_area
        calc_area = effective_area_ha if effective_area_ha is not None else 0.0

        # 9. Format Tier A & Merge Tier B crops (PRD v3.2 §3, AC-7)
        formatted_recs = []
        tier_a_crop_ids = set()

        for r in recs:
            cid = r["crop_id"]
            tier_a_crop_ids.add(cid)
            env_c = envelope_by_id.get(cid)

            suit_score = round(env_c.score, 3) if env_c else r["suitability_score"]
            lim_factor = env_c.limiting_factor if env_c else "climatic_envelope"
            best_month = env_c.best_planting_month if env_c else 6
            sci_name = env_c.scientific_name if env_c else None

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
                crop_id=cid,
                crop_name=r["crop_name"],
                scientific_name=sci_name,
                category=r["category"],
                recommendation_score=r["recommendation_score"],
                suitability_score=suit_score,
                suitability_grade=env_c.grade.capitalize() if env_c else "Moderate",
                expected_yield_t_ha=QuantileValue(p10=p10_yield, p50=p50_yield, p90=p90_yield),
                expected_production_t=QuantileValue(p10=prod_p10, p50=prod_p50, p90=prod_p90),
                irrigation_mode=effective_mode,
                water_need_mm=r["water_need_mm"],
                climate_risk_score=r["climate_risk_score"],
                climate_risk_note=r["climate_risk_note"],
                intercrop_options=intercrop_opts,
                rationale=r["rationale"],
                data_confidence=r["data_confidence"],
                regional_agronomic_prior=r.get("regional_agronomic_prior", 1.0),
                intercrop_data_available=r.get("intercrop_data_available", True),
                confidence_tier="A",
                method="ml_model",
                score=round(env_c.score, 3) if env_c else suit_score,
                score_rainfed=round(env_c.score_rainfed, 3) if env_c else suit_score,
                score_irrigated=round(env_c.score_irrigated, 3) if env_c else suit_score,
                season_months=env_c.season_months if env_c else 4,
                limiting_factor=lim_factor,
                best_planting_month=best_month,
                notes=env_c.notes if env_c else [],
            )
            formatted_recs.append(rec_crop)

        tier_b_crops = []
        # Merge Tier B crops (EcoCrop global registry without yield numbers per AC-7)
        for env_c in envelope_rankings:
            if env_c.crop_id in tier_a_crop_ids or env_c.confidence_tier != "B":
                continue
            if env_c.score < 0.15:  # skip unsuitable
                continue

            rec_crop = RecommendedCrop(
                crop_id=env_c.crop_id,
                crop_name=env_c.common_name.title(),
                scientific_name=env_c.scientific_name,
                category=env_c.category,
                recommendation_score=round(env_c.score * 100, 1),
                suitability_score=round(env_c.score, 3),
                suitability_grade=env_c.grade.capitalize(),
                expected_yield_t_ha=None,       # NO yield numbers for Tier B (AC-7)
                expected_production_t=None,     # NO yield numbers for Tier B (AC-7)
                irrigation_mode=effective_mode,
                water_need_mm=round(sum(site.monthly_rain_mm), 1),
                climate_risk_score=round((1.0 - env_c.score) * 100, 1),
                climate_risk_note=f"Limiting factor: {env_c.limiting_factor}. Best planting month: month {env_c.best_planting_month}.",
                intercrop_options=[],
                rationale=f"EcoCrop climatic envelope match ({env_c.grade}).",
                data_confidence="low",
                regional_agronomic_prior=1.0,
                intercrop_data_available=False,
                confidence_tier="B",
                method="ecocrop_envelope",
                score=round(env_c.score, 3),
                score_rainfed=round(env_c.score_rainfed, 3),
                score_irrigated=round(env_c.score_irrigated, 3),
                season_months=env_c.season_months,
                limiting_factor=env_c.limiting_factor,
                best_planting_month=env_c.best_planting_month,
                notes=env_c.notes,
            )
            tier_b_crops.append(rec_crop)

        # Sort individual partitions
        formatted_recs.sort(key=lambda c: (c.suitability_score, c.recommendation_score), reverse=True)
        tier_b_crops.sort(key=lambda c: (c.suitability_score, c.recommendation_score), reverse=True)

        # PRD §7.1 / §7.2: Guarantee both Tier A ML-verified and Tier B envelope matches
        total_limit = req.limit or 20
        target_a = min(len(formatted_recs), max(5, total_limit // 2))
        target_b = max(0, total_limit - target_a)

        # PRD §7.1 / §7.2: Present ML-verified Tier A recommendations with expected yields,
        # followed by Tier B EcoCrop envelope matches.
        merged = formatted_recs[:target_a] + tier_b_crops[:target_b]
        formatted_recs = merged

        top_rec = formatted_recs[0] if formatted_recs else None

        # Intercrop boost math for top crop
        top_pair_str = "None (Sole Cropping)"
        intercrop_boost_t = 0.0
        if top_rec and top_rec.intercrop_options and top_rec.expected_production_t:
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
                rainfall_mm=w.get("rainfall_mm"),
                temp_max_c=w.get("temp_max_c"),
                temp_min_c=w.get("temp_min_c"),
                temp_mean_c=w.get("temp_mean_c"),
                humidity_pct=w.get("humidity_pct"),
                solar_radiation_mj_m2=w.get("solar_radiation_mj_m2"),
                ph=s.get("ph"),
                organic_carbon_g_kg=s.get("organic_carbon_g_kg"),
                nitrogen_g_kg=s.get("nitrogen_g_kg"),
                phosphorus_ppm=s.get("phosphorus_ppm"),
                potassium_ppm=s.get("potassium_ppm"),
                texture_clay_pct=s.get("texture_clay_pct"),
                texture_sand_pct=s.get("texture_sand_pct"),
                texture_silt_pct=s.get("texture_silt_pct")
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
                p10_t_ha=top_rec.expected_yield_t_ha.p10 if (top_rec and top_rec.expected_yield_t_ha) else 0.0,
                p50_t_ha=top_rec.expected_yield_t_ha.p50 if (top_rec and top_rec.expected_yield_t_ha) else 0.0,
                p90_t_ha=top_rec.expected_yield_t_ha.p90 if (top_rec and top_rec.expected_yield_t_ha) else 0.0,
            ),
            production_summary=ProductionSummary(
                top_recommended_crop=top_rec.crop_name if top_rec else "N/A",
                p10_t=top_rec.expected_production_t.p10 if (top_rec and top_rec.expected_production_t) else 0.0,
                p50_t=top_rec.expected_production_t.p50 if (top_rec and top_rec.expected_production_t) else 0.0,
                p90_t=top_rec.expected_production_t.p90 if (top_rec and top_rec.expected_production_t) else 0.0,
                area_ha=effective_area_ha
            ),
            irrigation_summary=IrrigationSummary(
                recommended_mode=top_rec.irrigation_mode if top_rec else "rainfed",
                total_water_demand_m3=round(top_rec.water_need_mm * 10.0 * calc_area, 1) if top_rec else 0.0,
                effective_rainfall_mm=round((w.get("rainfall_mm") or 0.0) * 0.75, 1)
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
            land_records=record_summary,
            detection=detection_dict,
            gate_mode=gate_mode,
            area_check=area_check_alias,
            imputed_features=imputed_features,
            climatology_status="available",
            climatology_message="NASA POWER 12-month long-term climatology verified."
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_internal_error(e, "predict")
