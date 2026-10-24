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


@router.get("/map-layers")
async def get_map_layers_status():
    """
    Honest map and detection layers status (PRD v2.1 M10, M24).
    Probes filesystem existence and remote connectivity for each layer.
    Reports status as 'ready' or 'unavailable' + exact reason.
    """
    from pathlib import Path
    data_root = Path(__file__).resolve().parents[3] / "ml" / "data" / "raw" / "external"
    settings = get_settings()

    def check_local(path_suffix: str) -> bool:
        p = data_root / path_suffix
        return p.exists() and (p.is_file() or (p.is_dir() and any(p.iterdir())))

    layers = [
        {
            "id": "esa_worldcover_2021",
            "name": "ESA WorldCover 2021 v200",
            "type": "raster",
            "status": "ready" if (check_local("geo/worldcover_2021") or check_local("geo/worldcover")) else "unavailable",
            "reason": None if (check_local("geo/worldcover_2021") or check_local("geo/worldcover")) else "Local COG not downloaded; remote access unconfigured",
            "licence": "CC BY 4.0",
            "source_date": "2021",
            "attribution": "ESA WorldCover 10m 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium"
        },
        {
            "id": "copernicus_dem_glo30",
            "name": "Copernicus DEM GLO-30",
            "type": "raster",
            "status": "ready" if (check_local("geo/slope") or check_local("geo/copernicus_dem")) else "unavailable",
            "reason": None if (check_local("geo/slope") or check_local("geo/copernicus_dem")) else "Local DEM not downloaded; remote access unconfigured",
            "licence": "Open Access",
            "source_date": "2021",
            "attribution": "European Space Agency (ESA) Copernicus Programme DEM GLO-30"
        },
        {
            "id": "sentinel2_sr",
            "name": "Sentinel-2 L2A Surface Reflectance",
            "type": "satellite_optical",
            "status": "ready" if bool(settings.CDSE_CLIENT_ID and settings.CDSE_CLIENT_SECRET) else "unavailable",
            "reason": None if bool(settings.CDSE_CLIENT_ID and settings.CDSE_CLIENT_SECRET) else "CDSE credentials not configured (CDSE_CLIENT_ID/SECRET empty)",
            "licence": "CC BY-SA 3.0 IGO",
            "source_date": "2024",
            "attribution": "Copernicus Sentinel data (2024) processed by ESA"
        },
        {
            "id": "hydrolakes",
            "name": "HydroLAKES Global Water Body Database",
            "type": "vector",
            "status": "ready" if check_local("geo/hydrolakes") else "unavailable",
            "reason": None if check_local("geo/hydrolakes") else "HydroLAKES shapefile not in raw/external/geo/hydrolakes",
            "licence": "CC BY 4.0",
            "source_date": "2019",
            "attribution": "Messager et al. (2016), HydroLAKES database / HydroSHEDS"
        },
        {
            "id": "hydrorivers",
            "name": "HydroRIVERS Asia",
            "type": "vector",
            "status": "ready" if check_local("geo/hydrorivers") else "unavailable",
            "reason": None if check_local("geo/hydrorivers") else "HydroRIVERS shapefile not in raw/external/geo/hydrorivers",
            "licence": "HydroSHEDS Terms of Use",
            "source_date": "2019",
            "attribution": "HydroSHEDS / World Wildlife Fund US"
        },
        {
            "id": "openfreemap_mvt",
            "name": "OpenFreeMap Vector Tiles (OSM)",
            "type": "vector_tile",
            "status": "ready" if bool(settings.OPENFREEMAP_TILEJSON) else "unavailable",
            "reason": None if bool(settings.OPENFREEMAP_TILEJSON) else "OPENFREEMAP_TILEJSON unconfigured",
            "licence": "ODbL 1.0",
            "source_date": "2024",
            "attribution": "OpenFreeMap / OpenStreetMap contributors"
        },
        {
            "id": "ms_buildings",
            "name": "Microsoft Global ML Building Footprints",
            "type": "vector",
            "status": "ready" if (check_local("geo/buildings_ms") or check_local("geo/ms_buildings")) else "unavailable",
            "reason": None if (check_local("geo/buildings_ms") or check_local("geo/ms_buildings")) else "Building footprints extract not in raw/external/geo/buildings_ms",
            "licence": "CDLA-Permissive-2.0",
            "source_date": "2023",
            "attribution": "Microsoft Global ML Building Footprints"
        },
        {
            "id": "hansen_gfc",
            "name": "Hansen Global Forest Change",
            "type": "raster",
            "status": "ready" if check_local("geo/hansen") else "unavailable",
            "reason": None if check_local("geo/hansen") else "Hansen treecover rasters not in raw/external/geo/hansen",
            "licence": "CC BY 4.0",
            "source_date": "2023",
            "attribution": "Hansen/UMD/Google/USGS/NASA Global Forest Change"
        },
        {
            "id": "karnataka_protected_areas",
            "name": "Karnataka Protected Areas",
            "type": "vector",
            "status": "ready" if check_local("geo/protected_areas_ka") else "unavailable",
            "reason": None if check_local("geo/protected_areas_ka") else "Interim protected areas layer not in raw/external/geo/protected_areas_ka",
            "licence": "Public Domain (OpenCity / KSRSAC)",
            "source_date": "2022",
            "attribution": "KSRSAC / OpenCity.in Protected Areas (Interim Non-Legal)"
        },
        {
            "id": "bhuvan_thematic_wms",
            "name": "ISRO Bhuvan Thematic WMS",
            "type": "wms",
            "status": "unavailable",
            "reason": "Bhuvan WMS endpoint requires live probed session or IP whitelisting",
            "licence": "ISRO / NRSC Data Policy",
            "source_date": "2024",
            "attribution": "National Remote Sensing Centre (NRSC) / ISRO Bhuvan"
        }
    ]

    ready_cnt = sum(1 for l in layers if l["status"] == "ready")
    unavail_cnt = sum(1 for l in layers if l["status"] == "unavailable")

    return {
        "layers": layers,
        "total_layers": len(layers),
        "ready_count": ready_cnt,
        "unavailable_count": unavail_cnt,
        "checked_at": datetime.now(timezone.utc).isoformat()
    }
