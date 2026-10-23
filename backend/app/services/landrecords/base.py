"""
Land Records Provider Protocol and Result Types (PRD v2.0 §6.2, §6.4).
Strictly adheres to data protection: zero PII (no owner names, Aadhaar, PAN, phone).
"""
from __future__ import annotations

from typing import Protocol, Any, Literal
from pydantic import BaseModel, Field


class ProviderStatus(BaseModel):
    name: str
    status: Literal["ready", "unavailable", "needs_credentials"]
    reason: str | None = None
    records_found: int = 0


class SurveyRef(BaseModel):
    state: str = "Karnataka"
    district: str | None = None
    taluk: str | None = None
    hobli: str | None = None
    village: str | None = None
    survey_number: str | None = None
    hissa_number: str | None = None
    property_id: str | None = None


class RecordResult(BaseModel):
    parcel_id: str | None = None
    ulpin: str | None = None
    admin: dict[str, str | None] = Field(default_factory=dict)
    survey_number: str | None = None
    hissa_number: str | None = None
    recorded_land_class: str | None = None
    recorded_use: str | None = None
    class_geoagri: str | None = None
    recorded_extent_ha: float | None = None
    irrigation_source: str | None = None
    geometry: dict[str, Any] | None = None
    boundary_source: str = "user_provided"
    source_name: str
    source_date: str | None = None
    verification: Literal["official", "user_provided", "unverified"] = "unverified"


class LandRecordProvider(Protocol):
    name: str

    async def available(self) -> ProviderStatus:
        """Returns provider availability and credential state."""
        ...

    async def by_coordinate(self, lon: float, lat: float) -> RecordResult | None:
        """Enquires land record details at a geographic point."""
        ...

    async def by_reference(self, ref: SurveyRef) -> RecordResult | None:
        """Enquires land record details by survey / khata reference."""
        ...
