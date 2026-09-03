"""
Unit tests for Phase 2: Data Preparation, Crop Registry, and Normalization.
"""

import os
import pytest
from app.services.crops.normalization import normalize_crop_name
from app.services.crops.season_normalization import normalize_season
from app.services.crops.loader import load_csv_dataset, EmptyDatasetError
from app.services.crops.registry import CropRegistry, get_crop_registry

def test_crop_normalization():
    slug, display = normalize_crop_name(" Paddy ")
    assert slug == "rice"
    assert display == "Rice"

    slug, display = normalize_crop_name("Bengal Gram")
    assert slug == "chickpea"

    slug, display = normalize_crop_name("unseen_custom_crop")
    assert slug == "unseen_custom_crop"

def test_season_normalization():
    assert normalize_season("monsoon") == "kharif"
    assert normalize_season("WINTER") == "rabi"
    assert normalize_season("summer") == "zaid"
    assert normalize_season("whole year") == "annual"

def test_empty_dataset_error(tmp_path):
    empty_csv = tmp_path / "empty_dataset.csv"
    empty_csv.write_text("")
    with pytest.raises(EmptyDatasetError):
        load_csv_dataset(str(empty_csv))

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
