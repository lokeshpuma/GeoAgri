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
    Irrigability, LandRecordSummary, SourceStatus
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
from app.services.crops.envelope_suitability import Site, rank_crops, score_crop
from app.services.crops.registry import get_global_registry, get_legacy_crosswalk
from app.api.errors import handle_internal_error
import yaml
from pathlib import Path

YIELD_CEILINGS_PATH = Path(__file__).resolve().parents[2] / "rules" / "yield_ceilings.yaml"

def get_yield_ceilings() -> dict[str, float]:
    if YIELD_CEILINGS_PATH.exists():
        try:
            with open(YIELD_CEILINGS_PATH, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
                return data.get("ceilings_t_ha", {})
        except Exception:
            pass
    return {}

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
        
        # 1. Build environmental profile with exception containment per M26 & PRD v3.4 §3.3
        try:
            profile = await build_environmental_profile(
                polygon_pts=req.polygon,
                point_pt=req.point,
                season=req.season,
                manual_soil=manual_soil_dict
            )
        except Exception as ev_err:
            logger.warning("Upstream environmental profile/evidence exception: %s", ev_err)
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "EVIDENCE_UNAVAILABLE",
                    "missing_sources": ["google_earth_engine", "nasa_power", "soilgrids"],
                    "setup_hint": "Configure Google Earth Engine by setting GEE_PROJECT_ID, GEE_SERVICE_ACCOUNT, and GEE_PRIVATE_KEY_PATH (or set ALLOW_SYNTHETIC_DATA=true for demo synthetic mode)."
                }
            )

        sources = profile.get("sources", [])
        data_mode = profile.get("data_mode", "live")
        external_sources = [s for s in sources if s["name"] in ("google_earth_engine", "nasa_power", "soilgrids")]
        failed_sources = [s["name"] for s in external_sources if s["state"] == "failed"]

        if external_sources and len(failed_sources) == len(external_sources):
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "EVIDENCE_UNAVAILABLE",
                    "missing_sources": failed_sources,
                    "setup_hint": "Configure Google Earth Engine by setting GEE_PROJECT_ID, GEE_SERVICE_ACCOUNT, and GEE_PRIVATE_KEY_PATH (or set ALLOW_SYNTHETIC_DATA=true for demo synthetic mode)."
                }
            )

        analysis_status = "complete" if not failed_sources else "partial"

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
            sat_model = (
                SatelliteFeatures(
                    ndvi=sat.get("ndvi"),
                    ndwi=sat.get("ndwi"),
                    evi=sat.get("evi"),
                    savi=sat.get("savi"),
                    ndmi=sat.get("ndmi"),
                    elevation=sat.get("elevation"),
                    slope=sat.get("slope"),
                    twi=sat.get("twi"),
                    vv=sat.get("vv"),
                    vh=sat.get("vh"),
                )
                if sat
                else None
            )
            return FullReportResponse(
                analysis_status=analysis_status,
                sources=[SourceStatus(**s) for s in sources],
                data_mode=data_mode,
                field_summary=FieldSummary(**profile["field_summary"]),
                land_suitability=LandSuitability(
                    grade="Not Suitable",
                    score=None,
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
                satellite_features=sat_model,
                recommended_crops=[],
                yield_summary=None,
                production_summary=None,
                irrigation_summary=None,
                climate_risk_summary=None,
                intercrop_summary=None,
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
            sat_model = (
                SatelliteFeatures(
                    ndvi=sat.get("ndvi"),
                    ndwi=sat.get("ndwi"),
                    evi=sat.get("evi"),
                    savi=sat.get("savi"),
                    ndmi=sat.get("ndmi"),
                    elevation=sat.get("elevation"),
                    slope=sat.get("slope"),
                    twi=sat.get("twi"),
                    vv=sat.get("vv"),
                    vh=sat.get("vh"),
                )
                if sat
                else None
            )
            return FullReportResponse(
                analysis_status=analysis_status,
                sources=[SourceStatus(**s) for s in sources],
                data_mode=data_mode,
                field_summary=FieldSummary(**profile["field_summary"]),
                land_suitability=LandSuitability(
                    grade="Unavailable",
                    score=None,
                    confidence=None,
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
                satellite_features=sat_model,
                recommended_crops=[],
                yield_summary=None,
                production_summary=None,
                irrigation_summary=None,
                climate_risk_summary=None,
                intercrop_summary=None,
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

        # 6. Site environmental inputs for envelope evaluation
        site = Site(
            monthly_temp_c=climatology.monthly_temp_c,
            monthly_rain_mm=climatology.monthly_rain_mm,
            ph=s.get("ph"),
            altitude_m=sat.get("elevation"),
            soil_texture=s.get("soil_texture"),
            irrigated=is_irrigated
        )

        crosswalk = get_legacy_crosswalk()
        global_registry = get_global_registry()
        yield_ceilings = get_yield_ceilings()

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

        # 9. Format Tier A & Merge Tier B crops (PRD v3.3 §3.2, §3.3)
        formatted_recs: list[RecommendedCrop] = []
        excluded_crops: list[dict[str, Any]] = []
        tier_a_global_ids: set[str] = set()

        for r in recs:
            cid = r["crop_id"]
            global_id = crosswalk.get(cid, cid)
            global_crop = global_registry.get(global_id)
            if global_crop:
                tier_a_global_ids.add(global_crop["crop_id"])
            env_c = score_crop(global_crop, site) if global_crop else None

            # AC-5: Climate gate for Tier A: if rainfed AND irrigated scores are both < 0.30, exclude crop
            if env_c and env_c.score_rainfed < 0.30 and env_c.score_irrigated < 0.30:
                excluded_crops.append({
                    "crop_id": cid,
                    "crop_name": r["crop_name"],
                    "scientific_name": env_c.scientific_name,
                    "limiting_factor": env_c.limiting_factor,
                    "score_rainfed": env_c.score_rainfed,
                    "score_irrigated": env_c.score_irrigated,
                    "reason": f"Bioclimatic envelope scores (rainfed {env_c.score_rainfed}, irrigated {env_c.score_irrigated}) < 0.30."
                })
                continue

            if env_c:
                suit_score = round(env_c.score, 3)
                lim_factor = env_c.limiting_factor
                best_month = env_c.best_planting_month
                sci_name = env_c.scientific_name
                season_months = env_c.season_months
                suitability_grade = env_c.grade.capitalize()
                score_rainfed = round(env_c.score_rainfed, 3)
                score_irrigated = round(env_c.score_irrigated, 3)
                crop_notes = env_c.notes.copy()
                score_source = "ml_and_envelope"
            else:
                # D-3 & AC-4: No fallbacks! Missing envelope values are null
                suit_score = r["suitability_score"]
                lim_factor = None
                best_month = None
                sci_name = None
                season_months = None
                suitability_grade = None
                score_rainfed = None
                score_irrigated = None
                crop_notes = ["No climate envelope on file"]
                score_source = "ml_only"

            # Single source of truth for irrigation (D-7, AC-7)
            score_rf = score_rainfed if score_rainfed is not None else 0.5
            score_ir = score_irrigated if score_irrigated is not None else 0.5
            irrig_need = (
                "rainfed" if score_rf >= 0.6
                else "supplemental" if score_ir >= 0.6 and score_rf >= 0.3
                else "full irrigation" if score_ir >= 0.6
                else "not suitable"
            )
            mode_for_crop = "rainfed" if irrig_need in ["rainfed", "not suitable"] else ("supplemental" if irrig_need == "supplemental" else "full")

            # Yield plausibility ceilings guard (D-8b, AC-9)
            # PRD v3.3 §3.3 item 4 & AC-9: Until D5 retraining, rice, maize, coffee, and cotton must show no yield.
            raw_p10 = r["expected_yield_t_ha"]["p10"]
            raw_p50 = r["expected_yield_t_ha"]["p50"]
            raw_p90 = r["expected_yield_t_ha"]["p90"]
            ceiling = yield_ceilings.get(cid)
            unretrained_suspect = cid.lower() in ["rice", "maize", "coffee", "cotton"]

            if unretrained_suspect or (ceiling is not None and raw_p50 > ceiling):
                expected_yield = None
                expected_prod = None
                yield_note = "Baseline failed plausibility check"
                crop_notes.append("Baseline failed plausibility check")
            else:
                expected_yield = QuantileValue(p10=raw_p10, p50=raw_p50, p90=raw_p90)
                prod_p10 = round(raw_p10 * calc_area, 2)
                prod_p50 = round(raw_p50 * calc_area, 2)
                prod_p90 = round(raw_p90 * calc_area, 2)
                expected_prod = QuantileValue(p10=prod_p10, p50=prod_p50, p90=prod_p90)
                yield_note = None

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
                suitability_grade=suitability_grade,
                expected_yield_t_ha=expected_yield,
                expected_production_t=expected_prod,
                irrigation_mode=mode_for_crop,
                water_need_mm=r["water_need_mm"],
                climate_risk_score=r["climate_risk_score"],
                climate_risk_note=r["climate_risk_note"],
                yield_note=yield_note,
                score_source=score_source,
                intercrop_options=intercrop_opts,
                rationale="",  # Will be built after final sort to guarantee #N matches card position (AC-6)
                data_confidence=r["data_confidence"],
                regional_agronomic_prior=r.get("regional_agronomic_prior", 1.0),
                intercrop_data_available=r.get("intercrop_data_available", True),
                confidence_tier="A",
                method="ml_model",
                score=score_rainfed if mode_for_crop == "rainfed" else score_irrigated,
                score_rainfed=score_rainfed,
                score_irrigated=score_irrigated,
                season_months=season_months,
                limiting_factor=lim_factor,
                best_planting_month=best_month,
                notes=crop_notes,
            )
            formatted_recs.append(rec_crop)

        # Merge Tier B crops
        envelope_rankings = rank_crops(site, top_n=max(req.limit or 20, 100))
        tier_b_crops: list[RecommendedCrop] = []

        for env_c in envelope_rankings:
            if env_c.crop_id in tier_a_global_ids or env_c.confidence_tier != "B":
                continue
            if env_c.score < 0.15:
                continue

            score_rf = env_c.score_rainfed
            score_ir = env_c.score_irrigated
            irrig_need = (
                "rainfed" if score_rf >= 0.6
                else "supplemental" if score_ir >= 0.6 and score_rf >= 0.3
                else "full irrigation" if score_ir >= 0.6
                else "not suitable"
            )
            mode_for_crop = "rainfed" if irrig_need in ["rainfed", "not suitable"] else ("supplemental" if irrig_need == "supplemental" else "full")

            rec_crop = RecommendedCrop(
                crop_id=env_c.crop_id,
                crop_name=env_c.common_name.title(),
                scientific_name=env_c.scientific_name,
                category=env_c.category,
                recommendation_score=round(env_c.score * 100, 1),
                suitability_score=round(env_c.score, 3),
                suitability_grade=env_c.grade.capitalize(),
                expected_yield_t_ha=None,       # NO yield numbers for Tier B (AC-8)
                expected_production_t=None,     # NO yield numbers for Tier B (AC-8)
                irrigation_mode=mode_for_crop,
                water_need_mm=None,             # NO fake annual rainfall for Tier B (AC-8)
                climate_risk_score=None,        # NO invented risk index for Tier B (AC-8)
                climate_risk_note="Not assessed for Tier B envelope match.",
                yield_note=None,
                score_source="envelope_only",
                intercrop_options=[],
                rationale="",                  # Built after final sort (AC-6)
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

        formatted_recs.sort(key=lambda c: (c.suitability_score if c.suitability_score is not None else 0.0, c.recommendation_score), reverse=True)
        tier_b_crops.sort(key=lambda c: (c.suitability_score if c.suitability_score is not None else 0.0, c.recommendation_score), reverse=True)

        total_limit = req.limit or 20
        target_a = min(len(formatted_recs), max(5, total_limit // 2))
        target_b = max(0, total_limit - target_a)

        merged = formatted_recs[:target_a] + tier_b_crops[:target_b]
        formatted_recs = merged

        # Build consistent rationale so #N matches position and rainfed never says irrigation (AC-6, AC-7)
        for idx, c in enumerate(formatted_recs):
            pos = idx + 1
            water_str = f"{round(c.water_need_mm)} mm water need" if c.water_need_mm is not None else "rainfall matched"
            if c.irrigation_mode == "rainfed":
                irrig_phrase = f"Suitable for rainfed cultivation with natural precipitation ({water_str})."
            elif c.irrigation_mode == "supplemental":
                irrig_phrase = f"Requires supplemental irrigation to achieve optimal potential ({water_str})."
            else:
                irrig_phrase = f"Requires full irrigation to satisfy crop water requirements ({water_str})."

            if c.confidence_tier == "A":
                c.rationale = f"{c.crop_name} ranks #{pos}. {irrig_phrase} Evaluated with ML yield models and regional priors."
            else:
                c.rationale = f"{c.crop_name} ranks #{pos}. {irrig_phrase} EcoCrop bioclimatic envelope match ({c.suitability_grade})."

        top_rec = formatted_recs[0] if formatted_recs else None

        # Intercrop boost math for top crop
        top_pair_str = "None (Sole Cropping)"
        intercrop_boost_t = 0.0
        if top_rec and top_rec.intercrop_options and top_rec.expected_production_t:
            opt = top_rec.intercrop_options[0]
            top_pair_str = f"{top_rec.crop_name} + {opt.companion_crop_name}"
            intercrop_boost_t = round(top_rec.expected_production_t.p50 * opt.yield_boost_pct * opt.companion_share_factor, 3)

        mod_a = model_outputs["model_a"]

        sat_model = (
            SatelliteFeatures(
                ndvi=sat.get("ndvi"),
                ndwi=sat.get("ndwi"),
                evi=sat.get("evi"),
                savi=sat.get("savi"),
                ndmi=sat.get("ndmi"),
                elevation=sat.get("elevation"),
                slope=sat.get("slope"),
                twi=sat.get("twi"),
                vv=sat.get("vv"),
                vh=sat.get("vh"),
            )
            if sat
            else None
        )

        yield_summary_model = (
            YieldSummary(
                top_recommended_crop=top_rec.crop_name,
                p10_t_ha=top_rec.expected_yield_t_ha.p10 if top_rec.expected_yield_t_ha else None,
                p50_t_ha=top_rec.expected_yield_t_ha.p50 if top_rec.expected_yield_t_ha else None,
                p90_t_ha=top_rec.expected_yield_t_ha.p90 if top_rec.expected_yield_t_ha else None,
            )
            if (top_rec and top_rec.expected_yield_t_ha)
            else None
        )

        production_summary_model = (
            ProductionSummary(
                top_recommended_crop=top_rec.crop_name,
                p10_t=top_rec.expected_production_t.p10 if top_rec.expected_production_t else None,
                p50_t=top_rec.expected_production_t.p50 if top_rec.expected_production_t else None,
                p90_t=top_rec.expected_production_t.p90 if top_rec.expected_production_t else None,
                area_ha=effective_area_ha,
            )
            if (top_rec and top_rec.expected_production_t)
            else None
        )

        irrigation_summary_model = (
            IrrigationSummary(
                recommended_mode=top_rec.irrigation_mode,
                total_water_demand_m3=round(top_rec.water_need_mm * 10.0 * calc_area, 1) if (top_rec.water_need_mm is not None) else None,
                effective_rainfall_mm=round(w["rainfall_mm"] * 0.75, 1) if (w and w.get("rainfall_mm") is not None) else None,
            )
            if top_rec
            else None
        )

        climate_risk_summary_model = (
            ClimateRiskSummary(
                overall_risk_level="Low" if (top_rec.climate_risk_score is not None and top_rec.climate_risk_score < 35) else ("Moderate" if (top_rec.climate_risk_score is not None and top_rec.climate_risk_score < 60) else ("High" if top_rec.climate_risk_score is not None else None)),
                drought_risk_score=round(top_rec.climate_risk_score * 0.4, 1) if top_rec.climate_risk_score is not None else None,
                heat_risk_score=round(top_rec.climate_risk_score * 0.3, 1) if top_rec.climate_risk_score is not None else None,
                excess_rain_risk_score=round(top_rec.climate_risk_score * 0.3, 1) if top_rec.climate_risk_score is not None else None,
                note=top_rec.climate_risk_note if top_rec.climate_risk_note else None,
            )
            if top_rec
            else None
        )

        return FullReportResponse(
            analysis_status=analysis_status,
            sources=[SourceStatus(**s) for s in sources],
            data_mode=data_mode,
            field_summary=FieldSummary(**profile["field_summary"]),
            land_suitability=LandSuitability(
                grade=mod_a.get("grade", "Moderate"),
                score=mod_a.get("score"),
                confidence=mod_a.get("confidence"),
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
            satellite_features=sat_model,
            recommended_crops=formatted_recs,
            excluded_crops=excluded_crops,
            yield_summary=yield_summary_model,
            production_summary=production_summary_model,
            irrigation_summary=irrigation_summary_model,
            climate_risk_summary=climate_risk_summary_model,
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
            climatology_message="NASA POWER 12-month long-term climatology."
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_internal_error(e, "predict")
