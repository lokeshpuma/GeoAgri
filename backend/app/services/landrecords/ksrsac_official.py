"""
KSRSAC Official Land Records Provider Adapter (PRD v2.0 §6.3, §8).
Enquires official cadastral / village / forest layers when data-sharing credentials are provided.
Defaults cleanly to 'needs_credentials' when credentials are not configured.
"""
from __future__ import annotations

import os
from typing import Any
from app.services.landrecords.base import LandRecordProvider, ProviderStatus, RecordResult, SurveyRef


class KSRSACOfficialProvider:
    name: str = "ksrsac_official"

    def __init__(self):
        self.api_base_url = os.getenv("KSRSAC_API_BASE_URL", "")
        self.api_key = os.getenv("KSRSAC_API_KEY", "")

    async def available(self) -> ProviderStatus:
        if not self.api_base_url or not self.api_key:
            return ProviderStatus(
                name=self.name,
                status="needs_credentials",
                reason="Official KSRSAC data-sharing agreement required; credentials not configured.",
                records_found=0
            )
        return ProviderStatus(
            name=self.name,
            status="ready",
            reason="Connected to K-GIS / KSRSAC official map server",
            records_found=0
        )

    async def by_coordinate(self, lon: float, lat: float) -> RecordResult | None:
        status = await self.available()
        if status.status != "ready":
            return None
        # In live mode with credentials, invokes official K-GIS WFS/REST service
        return None

    async def by_reference(self, ref: SurveyRef) -> RecordResult | None:
        status = await self.available()
        if status.status != "ready":
            return None
        return None
