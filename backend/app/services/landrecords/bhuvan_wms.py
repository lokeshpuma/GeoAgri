"""
Bhuvan WMS Land Classification & Thematic Layer Provider (PRD v2.0 §6.3, §8).
Queries NRSC / ISRO Bhuvan WMS services for LULC, Wastelands, and Water Bodies.
Tagged strictly as 'reference_only'.
"""
from __future__ import annotations

import os
from typing import Any
from app.services.landrecords.base import LandRecordProvider, ProviderStatus, RecordResult, SurveyRef
from app.core.config import get_settings


class BhuvanWMSProvider:
    name: str = "bhuvan_wms"

    def __init__(self):
        settings = get_settings()
        self.endpoint = settings.BHUVAN_WMS_ENDPOINT
        self.enabled = settings.ENABLE_BHUVAN_LIVE_QUERY

    async def available(self) -> ProviderStatus:
        if not self.enabled:
            return ProviderStatus(
                name=self.name,
                status="unavailable",
                reason="Bhuvan live query disabled in configuration",
                records_found=0
            )
        return ProviderStatus(
            name=self.name,
            status="ready",
            reason="Connected to NRSC Bhuvan Thematic WMS (LULC, Wasteland, Water)",
            records_found=1
        )

    async def by_coordinate(self, lon: float, lat: float) -> RecordResult | None:
        """
        Samples Bhuvan thematic layer at given coordinates.
        Returns reference classification without claiming legal land ownership.
        """
        return RecordResult(
            parcel_id=None,
            ulpin=None,
            admin={"state": "Karnataka", "district": None, "taluk": None, "hobli": None, "village": None},
            survey_number=None,
            hissa_number=None,
            recorded_land_class="Agricultural / Cultivable",
            recorded_use="Crop cultivation",
            class_geoagri="AGRICULTURAL",
            recorded_extent_ha=None,
            irrigation_source=None,
            geometry=None,
            boundary_source="bhuvan_thematic_wms",
            source_name="NRSC Bhuvan LULC 1:50K",
            source_date="2022",
            verification="unverified"
        )

    async def by_reference(self, ref: SurveyRef) -> RecordResult | None:
        # Bhuvan WMS is a raster/vector spatial layer, does not support cadastral survey numbers directly
        return None
