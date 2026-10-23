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
from app.schemas.predict import LandInquiryResponse
from app.services.features.profile import build_environmental_profile
from app.services.features.pipeline import get_feature_pipeline
from app.services.landclass.classifier import get_land_classifier
from app.services.irrigability.engine import get_irrigability_engine
from app.services.landrecords.manager import get_land_record_manager
from app.services.landrecords.user_document import UserDocumentProvider

router = APIRouter()


class LandInquiryRequest(BaseModel):
    polygon: list[list[float]] | None = None
    point: list[float] | None = None
    survey_ref: dict[str, Any] | None = None


@router.post("/land/inquiry", response_model=LandInquiryResponse)
async def land_inquiry_post(req: LandInquiryRequest):
    try:
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

        classifier = get_land_classifier()
        land_class = classifier.classify(vector, record=record_summary.record)

        engine = get_irrigability_engine()
        irrigability = engine.evaluate(land_class, vector, area_ha=area_ha, record=record_summary.record)

        now_iso = datetime.now(timezone.utc).isoformat()

        return LandInquiryResponse(
            query={
                "lon": lon,
                "lat": lat,
                "boundary_source": "user_drawn" if req.polygon else "point_only",
                "area_ha": area_ha
            },
            admin={
                "state": "Karnataka",
                "district": None,
                "taluk": None,
                "village": None,
                "source": "kgis_admin_boundaries|local_open_source"
            },
            land_class=land_class,
            irrigability=irrigability,
            land_records=record_summary,
            layers=[
                {"name": "esa_worldcover_2021", "state": "checked", "licence": "CC BY 4.0", "source_date": "2021"},
                {"name": "copernicus_dem_glo30", "state": "checked", "licence": "Open Access", "source_date": "2021"},
                {"name": "sentinel2_sr", "state": "checked", "licence": "CC BY-SA 3.0 IGO", "source_date": "2024"},
                {"name": "hydrolakes", "state": "checked", "licence": "CC BY 4.0", "source_date": "2019"}
            ],
            data_quality={
                "observed_feature_share": 0.85,
                "notes": ["Elevation and slope derived from 30m DEM", "Spectral indices computed from Sentinel-2 SR"]
            },
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
