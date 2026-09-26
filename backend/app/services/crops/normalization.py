"""
Crop Name Normalization Service.
Maps diverse raw crop name spellings to standard slugs and display names
using the centralized canonical taxonomy.
"""

from __future__ import annotations
from app.services.crops.crop_taxonomy import normalize_crop_id, get_crop_display_name, RAW_TO_CANONICAL_MAP

# Re-export mapping for backward compatibility if any module expects CROP_NAME_MAP
CROP_NAME_MAP = {
    raw: (canonical, get_crop_display_name(canonical))
    for raw, canonical in RAW_TO_CANONICAL_MAP.items()
}

def normalize_crop_name(name: str) -> tuple[str, str]:
    """
    Normalizes a crop string into (canonical_slug, display_name).
    Guarantees ONE canonical taxonomy resolution.
    """
    canonical_id = normalize_crop_id(name)
    display_name = get_crop_display_name(canonical_id)
    return canonical_id, display_name
