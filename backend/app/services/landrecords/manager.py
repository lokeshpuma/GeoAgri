"""
Land Records Provider Manager (PRD v2.0 §6, §13).
Coordinates multi-source land record enquiry across UserDocument, KSRSAC, Bhuvan, and OpenLayers.
"""
from __future__ import annotations

from typing import Any
from app.services.landrecords.base import LandRecordProvider, ProviderStatus, RecordResult, SurveyRef
from app.services.landrecords.user_document import UserDocumentProvider
from app.services.landrecords.ksrsac_official import KSRSACOfficialProvider
from app.services.landrecords.bhuvan_wms import BhuvanWMSProvider
from app.services.landrecords.open_layers import OpenLayersProvider
from app.schemas.predict import LandRecordSummary


class LandRecordManager:
    def __init__(self):
        self.providers: list[LandRecordProvider] = [
            UserDocumentProvider(),
            KSRSACOfficialProvider(),
            BhuvanWMSProvider(),
            OpenLayersProvider(),
        ]

    async def get_provider_statuses(self) -> list[dict[str, Any]]:
        statuses = []
        for p in self.providers:
            st = await p.available()
            statuses.append({
                "id": p.name,
                "name": p.name.replace("_", " ").title(),
                "status": st.status,
                "reason": st.reason,
                "records_found": st.records_found
            })
        return statuses

    async def query_record(
        self,
        lon: float,
        lat: float,
        survey_ref: dict[str, Any] | None = None
    ) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
        statuses = await self.get_provider_statuses()
        matched_record = None

        # 1. Try survey reference if provided
        if survey_ref:
            ref = SurveyRef(**survey_ref)
            for p in self.providers:
                rec = await p.by_reference(ref)
                if rec and rec.verification in ["official", "user_provided"]:
                    matched_record = rec.model_dump()
                    break

        # 2. Try coordinate lookup if reference not provided or not matched
        if not matched_record:
            for p in self.providers:
                rec = await p.by_coordinate(lon, lat)
                if rec and rec.verification in ["official", "user_provided"]:
                    matched_record = rec.model_dump()
                    break

        return statuses, matched_record

    async def get_summary(
        self,
        lon: float,
        lat: float,
        survey_ref: dict[str, Any] | None = None
    ) -> LandRecordSummary:
        statuses, rec = await self.query_record(lon, lat, survey_ref)
        return LandRecordSummary(
            providers=statuses,
            record=rec
        )


_manager_instance: LandRecordManager | None = None

def get_land_record_manager() -> LandRecordManager:
    global _manager_instance
    if _manager_instance is None:
        _manager_instance = LandRecordManager()
    return _manager_instance
