import json
import re
from pathlib import Path
import pytest
from app.services.crops.envelope_suitability import score_crop, Site

BACKEND_DIR = Path(__file__).resolve().parents[1]
TRAINING_DIR = BACKEND_DIR / "ml" / "training"
MODELS_DIR = BACKEND_DIR / "ml" / "models"
MODEL_CARD_PATH = MODELS_DIR / "model_card.json"
CALIBRATION_REPORT_PATH = BACKEND_DIR / "ml" / "data" / "processed" / "calibration_report.json"
SPOT_CLIMATES_PATH = BACKEND_DIR / "tests" / "fixtures" / "spot_climates.json"


def test_no_literal_scores_in_training_scripts():
    """PRD v3.4 §3.1 & AC-1: grep -n '"score": 0.' backend/ml/training/*.py returns nothing."""
    pattern = re.compile(r'"score":\s*0\.')
    for script_path in TRAINING_DIR.glob("*.py"):
        content = script_path.read_text(encoding="utf-8")
        matches = [m.group(0) for m in pattern.finditer(content)]
        assert not matches, f"Found hardcoded literal score in {script_path}: {matches}"


def test_spot_checks_computed_from_fixtures():
    """PRD v3.4 §3.1: Spot checks in calibration_report.json must be computed dynamically."""
    assert SPOT_CLIMATES_PATH.exists(), "Spot climates fixture must exist"
    assert CALIBRATION_REPORT_PATH.exists(), "Calibration report must exist"

    with open(SPOT_CLIMATES_PATH, "r", encoding="utf-8") as f:
        fixtures = json.load(f)["spot_checks"]

    with open(CALIBRATION_REPORT_PATH, "r", encoding="utf-8") as f:
        report = json.load(f)

    spot_checks = report.get("spot_checks_comparison", {})
    assert len(spot_checks) == 4, "Must contain all 4 spot checks"

    for key, spec in fixtures.items():
        assert key in spot_checks
        check = spot_checks[key]
        assert "before" in check and "after" in check
        assert "score" in check["before"] and "score" in check["after"]
        # Improved flag must strictly equal after > before + 0.05
        assert check["improved"] == (check["after"]["score"] > check["before"]["score"] + 0.05)


def test_model_card_honesty_and_labels():
    """PRD v3.4 §3.2, AC-2, AC-3: Model D labelled 'Regional yield benchmark' and Model B has baseline next to it."""
    assert MODEL_CARD_PATH.exists(), "model_card.json must exist"

    with open(MODEL_CARD_PATH, "r", encoding="utf-8") as f:
        card = json.load(f)

    # Model D labeling (AC-3)
    model_d = card.get("model_d_yield_benchmark", {})
    assert "Regional yield benchmark" in model_d.get("label", "")
    assert "not adjusted to your field" in model_d.get("description", "")
    assert "continents_evaluated" in model_d
    assert len(model_d["continents_evaluated"]) == 6

    # Model B recommender & baseline comparison (AC-2)
    model_b = card.get("model_b_recommender", {})
    assert model_b.get("type") == "rule-based envelope ranking"
    assert "overall_top5_hit_rate_pct" in model_b
    assert "baseline_comparison" in model_b
    baseline = model_b["baseline_comparison"]
    assert "baseline_overall_top5_hit_rate_pct" in baseline
    assert "wheat" in baseline.get("baseline_name", "").lower()

    # Per-continent validation pairs
    for cont, data in model_b.get("per_continent", {}).items():
        assert "top5_hit_rate_pct" in data
        assert "baseline_top5_hit_rate_pct" in data
        assert isinstance(data["top5_hit_rate_pct"], (int, float))
        assert isinstance(data["baseline_top5_hit_rate_pct"], (int, float))


def test_model_card_builder_rejects_formulaic_hit_rate():
    """PRD v3.4 §3.2: Rejects old formulaic hit rate 78.0 + (coverage * 15.0)."""
    with open(MODEL_CARD_PATH, "r", encoding="utf-8") as f:
        card = json.load(f)

    model_d = card.get("model_d_yield_benchmark", {})
    model_b = card.get("model_b_recommender", {})

    coverage_by_continent = {
        k: v["coverage_p10_p90_pct"] for k, v in model_d.get("per_continent", {}).items()
    }
    hit_rates_by_continent = {
        k: v["top5_hit_rate_pct"] for k, v in model_b.get("per_continent", {}).items()
    }

    # Verify that hit rate is not a formula of coverage
    for cont in coverage_by_continent:
        if cont in hit_rates_by_continent:
            cov = coverage_by_continent[cont] / 100.0
            formulaic_val = round(min(94.5, 78.0 + (cov * 15.0)), 2)
            actual_val = hit_rates_by_continent[cont]
            assert actual_val != formulaic_val, (
                f"Continent {cont} hit rate ({actual_val}) matches the fabricated formula {formulaic_val}"
            )
