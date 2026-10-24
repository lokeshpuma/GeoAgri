"""
Land Intelligence & Records Router (PRD v2.0 §6, §7, §9, §10, M7).
Endpoints:
- POST /api/v1/land/inquiry
- GET /api/v1/land/inquiry?lat=&lon=
- POST /api/v1/land/records/upload
- GET /api/v1/land/providers
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from app.core.config import get_settings
from app.schemas.predict import LandInquiryResponse
from app.services.features.profile import build_environmental_profile
from app.services.features.pipeline import get_feature_pipeline
from app.services.landclass.classifier import get_land_classifier
from app.services.irrigability.engine import get_irrigability_engine
from app.services.landrecords.manager import get_land_record_manager
from app.services.landrecords.user_document import UserDocumentProvider
from app.services.landclass.evidence import collect_evidence
from app.services.landclass.detection import to_legacy_area_check

router = APIRouter()


class LandInquiryRequest(BaseModel):
    polygon: list[list[float]] | None = None
    point: list[float] | None = None
    survey_ref: dict[str, Any] | None = None


@router.post("/land/inquiry", response_model=LandInquiryResponse)
async def land_inquiry_post(req: LandInquiryRequest):
    try:
        settings = get_settings()
        det_mode = settings.LAND_DETECTION_MODE.lower()
        gate_mode = settings.LAND_GATE_MODE.lower()

        profile = await build_environmental_profile(
            polygon_pts=req.polygon,
            point_pt=req.point,
            season="kharif"
        )
        pipeline = get_feature_pipeline()
        vector = pipeline.extract_feature_vector(profile)

        lon = profile["field_summary"]["centroid_lon"]
        lat = profile["field_summary"]["centroid_lat"]
        area_ha = profile["field_summary"]["area_ha"]

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
            except Exception:
                pass

        classifier = get_land_classifier()
        if det_mode == "enforce" and evidence is not None:
            land_class = classifier.classify(evidence=evidence, record=record_summary.record)
        else:
            land_class = classifier.classify(vector, record=record_summary.record)

        engine = get_irrigability_engine()
        irrigability = engine.evaluate(land_class, vector, area_ha=area_ha, record=record_summary.record)

        now_iso = datetime.now(timezone.utc).isoformat()

        admin_info = (record_summary.record.get("admin") if (record_summary.record and record_summary.record.get("admin")) else {
            "state": None,
            "district": None,
            "taluk": None,
            "village": None,
            "source": None
        })

        total_feats = len(vector) if vector else 1
        observed_cnt = sum(1 for v in vector.values() if v is not None and v != 0.0) if vector else 0
        observed_share = round(observed_cnt / total_feats, 2)

        sat_ready = bool(profile.get("satellite") and any(profile["satellite"].values()))
        weather_ready = bool(profile.get("weather") and any(profile["weather"].values()))
        soil_ready = bool(profile.get("soil") and any(profile["soil"].values()))

        layers = [
            {"name": "esa_worldcover_2021", "state": "checked" if sat_ready else "unavailable", "licence": "CC BY 4.0", "source_date": "2021"},
            {"name": "copernicus_dem_glo30", "state": "checked" if sat_ready else "unavailable", "licence": "Open Access", "source_date": "2021"},
            {"name": "sentinel2_sr", "state": "checked" if sat_ready else "unavailable", "licence": "CC BY-SA 3.0 IGO", "source_date": "2024"},
            {"name": "hydrolakes", "state": "checked" if sat_ready else "unavailable", "licence": "CC BY 4.0", "source_date": "2019"}
        ]

        notes = []
        if sat_ready:
            notes.append("Elevation and slope derived from 30m DEM")
            notes.append("Spectral indices computed from Sentinel-2 SR")
        if not sat_ready and not weather_ready and not soil_ready:
            notes.append("External remote sensing and weather sources unavailable")

        return LandInquiryResponse(
            query={
                "lon": lon,
                "lat": lat,
                "boundary_source": "user_drawn" if req.polygon else "point_only",
                "area_ha": area_ha
            },
            admin=admin_info,
            land_class=land_class,
            irrigability=irrigability,
            land_records=record_summary,
            layers=layers,
            data_quality={
                "observed_feature_share": observed_share,
                "notes": notes
            },
            detection=detection_dict,
            gate_mode=gate_mode,
            area_check=area_check_alias,
            disclaimer="Decision-support only. Not a legal land record, conversion certificate or official survey.",
            assessment_timestamp=now_iso
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Land enquiry error: {str(e)}")


@router.get("/land/inquiry", response_model=LandInquiryResponse)
async def land_inquiry_get(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    req = LandInquiryRequest(point=[lon, lat])
    return await land_inquiry_post(req)


@router.get("/land/providers")
async def get_providers_list():
    mgr = get_land_record_manager()
    return await mgr.get_provider_statuses()


@router.post("/land/records/upload")
async def upload_land_record(file: UploadFile = File(...)):
    try:
        content = await file.read()
        text = content.decode("utf-8", errors="ignore")
        doc_token, record = UserDocumentProvider.parse_document_content(text, filename=file.filename or "upload.txt")
        return {
            "status": "success",
            "doc_token": doc_token,
            "summary": record.model_dump()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse document: {str(e)}")
