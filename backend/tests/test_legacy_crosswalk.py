"""Legacy GeoAgri crop ids must resolve to EcoCrop species so Tier A crops get a real envelope score."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "ml" / "data" / "processed"
CROSSWALK = json.loads((ROOT / "legacy_crosswalk.json").read_text())["mapping"]
LEGACY = {c["crop_id"] for c in json.loads((ROOT / "crop_registry.json").read_text())}
GLOBAL = {c["crop_id"]: c for c in json.loads((ROOT / "crop_registry_global.json").read_text())}


def test_most_legacy_crops_are_linked():
    assert len(CROSSWALK) >= 110


def test_every_link_points_at_real_rows():
    for legacy_id, global_id in CROSSWALK.items():
        assert legacy_id in LEGACY, legacy_id
        assert global_id in GLOBAL, (legacy_id, global_id)


def test_known_pairs():
    assert CROSSWALK["finger_millet"].startswith("eleusine_coracana")  # EcoCrop holds this crop as a subspecies row
    assert CROSSWALK["rice"] == "oryza_sativa"
    assert CROSSWALK["maize"] == "zea_mays"
    assert CROSSWALK["turmeric"] == "curcuma_longa"
    assert CROSSWALK["groundnut"] == "arachis_hypogaea"


def test_crops_shown_on_the_crop_page_now_have_envelopes():
    for legacy_id in ("finger_millet", "turmeric", "groundnut", "sugarcane", "coffee", "rice"):
        assert legacy_id in CROSSWALK, legacy_id
