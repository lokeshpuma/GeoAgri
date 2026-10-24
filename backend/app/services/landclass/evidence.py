"""
Evidence Collection and Fusion for Land Classification (PRD v2.1 §5A, M15, M29).
Collects multi-source measured evidence across land cover, buildings, roads, water,
terrain, and legal land records to feed the LandClassifier.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple, Union
from pydantic import BaseModel, Field

from app.services.landclass.detection import detect_features


class Evidence(BaseModel):
    """Container for multi-sensor and documentary evidence."""
    geometry_basis: str = "point_circle"  # "polygon" | "point_circle"
    detection: Dict[str, Any] = Field(default_factory=dict)
    features: Dict[str, Any] = Field(default_factory=dict)
    record: Optional[Dict[str, Any]] = None
    sources: List[Dict[str, Any]] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    independent_sources: Dict[str, List[str]] = Field(default_factory=dict)
    water_access: Optional[Dict[str, Any]] = None
    observed_feature_share: float = 0.0


def collect_evidence(
    lat: float,
    lon: float,
    polygon: Optional[Any] = None,
    rtc_record: Optional[Dict[str, Any]] = None,
    features: Optional[Dict[str, Any]] = None,
    layer_hits: Optional[List[Dict[str, Any]]] = None,
    official_legal_forest: bool = False
) -> Evidence:
    """
    Collects measured evidence across spatial layers, raster detectors, and records.
    Counts independent supporting sources to support §5A.3 and M29 gating.
    """
    feat = dict(features) if features else {}
    layer_hits = layer_hits or []

    # Run detection engine
    det = detect_features(
        lat=lat,
        lon=lon,
        polygon=polygon,
        rtc_data=rtc_record,
        official_legal_forest=official_legal_forest
    )

    # Track independent sources per category
    independent: Dict[str, List[str]] = {
        "forest": [],
        "buildings": [],
        "water": [],
        "roads": [],
        "wasteland": [],
        "agricultural": []
    }

    # Sources from detection
    for b in det.get("forest", {}).get("basis", []):
        if "worldcover" in b:
            independent["forest"].append("worldcover")
        elif "hansen" in b:
            independent["forest"].append("hansen")
        elif "osm" in b:
            independent["forest"].append("osm")
        elif "official" in b:
            independent["forest"].append("official_layer")

    # Additional satellite features for forest
    raw_ndvi = feat.get("ndvi")
    if raw_ndvi is not None and float(raw_ndvi) > 0.65:
        independent["forest"].append("sentinel2_ndvi")

    for b in det.get("buildings", {}).get("basis", []):
        if "worldcover" in b:
            independent["buildings"].append("worldcover")
        elif "osm" in b:
            independent["buildings"].append("osm")
        elif "ms_buildings" in b:
            independent["buildings"].append("ms_buildings")

    for h in layer_hits:
        name = h.get("name", "").lower()
        if "ghsl" in name or "building" in name:
            independent["buildings"].append(name)
        if "hydrolakes" in name or "water" in name:
            independent["water"].append(name)
        if "protected" in name or "sanctuary" in name:
            independent["forest"].append("official_layer")

    for b in det.get("water", {}).get("basis", []):
        if "worldcover" in b:
            independent["water"].append("worldcover")
        elif "osm" in b:
            independent["water"].append("osm")

    raw_ndwi = feat.get("ndwi")
    if raw_ndwi is not None and float(raw_ndwi) > 0.30:
        independent["water"].append("sentinel2_ndwi")

    for b in det.get("roads", {}).get("basis", []):
        independent["roads"].append(b)

    # Water access check (§7.3, M29)
    dist_water = feat.get("distance_to_water_m")
    irr_source = rtc_record.get("irrigation_source") if rtc_record else None
    water_acc: Dict[str, Any] = {
        "state": "unknown",
        "distance_to_water_m": dist_water,
        "recorded_source": irr_source,
        "evidence": []
    }
    if irr_source:
        water_acc["state"] = "recorded"
        water_acc["evidence"].append(f"rtc_irrigation_source:{irr_source}")
    elif dist_water is not None:
        water_acc["state"] = "measured"
        water_acc["evidence"].append(f"hydrolakes_proximity_m:{dist_water}")
    else:
        water_acc["state"] = "unknown"
        water_acc["evidence"].append("no_water_source_or_proximity_observed")

    # Calculate observed feature share
    observed_count = sum(1 for v in feat.values() if v is not None)
    total_expected = max(1, len(feat))
    observed_share = round(observed_count / total_expected, 2) if feat else 0.0

    return Evidence(
        geometry_basis=det.get("geometry_basis", "point_circle"),
        detection=det,
        features=feat,
        record=rtc_record,
        sources=det.get("sources", []),
        warnings=det.get("warnings", []),
        independent_sources=independent,
        water_access=water_acc,
        observed_feature_share=observed_share
    )
