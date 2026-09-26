"""
Unit tests for Phase 2: Data Preparation, Crop Registry, and Normalization.
"""

import os
import pytest
from app.services.crops.registry import CropRegistry, get_crop_registry

def test_crop_registry_confidence_levels():
    registry = get_crop_registry()
    crops = registry.list_crops()
    assert len(crops) >= 100

    rice = registry.get_crop("rice")
    assert rice is not None
    assert rice.data_confidence == "high"

    spice = registry.get_crop("cardamom")
    assert spice is not None
    assert spice.data_confidence == "low"
