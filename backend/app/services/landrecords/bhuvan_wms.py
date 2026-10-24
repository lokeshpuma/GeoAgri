"""
Bhuvan WMS Land Classification & Thematic Layer Provider (PRD v2.0 §6.3, §8, v2.1 M13).
Queries NRSC / ISRO Bhuvan WMS services for LULC, Wastelands, and Water Bodies.
Tagged strictly as 'reference_only'. Never fabricates data.
"""
from __future__ import annotations

import time
import httpx
from typing import Any
from app.services.landrecords.base import LandRecordProvider, ProviderStatus, RecordResult, SurveyRef
from app.core.config import get_settings


class BhuvanWMSProvider:
    name: str = "bhuvan_wms"

    def __init__(self):
        settings = get_settings()
        self.endpoint = settings.BHUVAN_WMS_ENDPOINT
        self.enabled = settings.ENABLE_BHUVAN_LIVE_QUERY
        self._probe_cached_status: ProviderStatus | None = None
        self._probe_cached_time: float = 0.0
        self._cache_ttl_s: float = 300.0  # 5 minutes

    async def available(self) -> ProviderStatus:
        if not self.enabled:
            return ProviderStatus(
                name=self.name,
                status="unavailable",
                reason="Bhuvan live query disabled in configuration",
                records_found=0
            )

        now = time.time()
        if self._probe_cached_status and (now - self._probe_cached_time) < self._cache_ttl_s:
            return self._probe_cached_status

        # Cheap probe with timeout <= 6s
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                probe_url = f"{self.endpoint}?service=WMS&request=GetCapabilities"
                resp = await client.get(probe_url)
                if resp.status_code == 200:
                    status = ProviderStatus(
                        name=self.name,
                        status="ready",
                        reason="Connected to NRSC Bhuvan Thematic WMS (LULC, Wasteland, Water)",
                        records_found=1
                    )
                else:
                    status = ProviderStatus(
                        name=self.name,
                        status="unavailable",
                        reason=f"Bhuvan WMS returned HTTP {resp.status_code}",
                        records_found=0
                    )
        except Exception as e:
            status = ProviderStatus(
                name=self.name,
                status="unavailable",
                reason=f"Bhuvan WMS unreachable ({type(e).__name__})",
                records_found=0
            )

        self._probe_cached_status = status
        self._probe_cached_time = now
        return status

    async def by_coordinate(self, lon: float, lat: float) -> RecordResult | None:
        """
        Samples Bhuvan thematic layer at given coordinates via GetFeatureInfo.
        Returns None if layer unavailable or no feature at coordinates.
        Never returns hardcoded synthetic records.
        """
        st = await self.available()
        if st.status != "ready":
            return None

        # Build GetFeatureInfo request
        delta = 0.005
        bbox = f"{lon - delta},{lat - delta},{lon + delta},{lat + delta}"
        params = {
            "service": "WMS",
            "version": "1.1.1",
            "request": "GetFeatureInfo",
            "layers": "lulc:LULC50K_1516",
            "query_layers": "lulc:LULC50K_1516",
            "styles": "",
            "bbox": bbox,
            "width": 101,
            "height": 101,
            "srs": "EPSG:4326",
            "format": "image/png",
            "info_format": "application/json",
            "x": 50,
            "y": 50
        }

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(self.endpoint, params=params)
                if resp.status_code != 200 or not resp.text:
                    return None
                
                # If application/json is supported and features returned
                if resp.headers.get("content-type", "").startswith("application/json"):
                    data = resp.json()
                    features = data.get("features", [])
                    if not features:
                        return None
                    props = features[0].get("properties", {})
                    lulc_name = props.get("LULC_NAME") or props.get("DESCRIPTIO") or "Bhuvan Thematic Feature"
                    return RecordResult(
                        parcel_id=None,
                        ulpin=None,
                        admin={"state": props.get("STATE"), "district": props.get("DISTRICT"), "taluk": None, "hobli": None, "village": None},
                        survey_number=None,
                        hissa_number=None,
                        recorded_land_class=lulc_name,
                        recorded_use=lulc_name,
                        class_geoagri="AGRICULTURAL" if "agri" in lulc_name.lower() or "crop" in lulc_name.lower() else "UNKNOWN",
                        recorded_extent_ha=None,
                        irrigation_source=None,
                        geometry=None,
                        boundary_source="bhuvan_thematic_wms",
                        source_name="NRSC Bhuvan LULC 1:50K",
                        source_date="2022",
                        verification="unverified"
                    )
        except Exception:
            return None

        return None

    async def by_reference(self, ref: SurveyRef) -> RecordResult | None:
        return None
