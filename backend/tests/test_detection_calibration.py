"""
Unit test for detection engine calibration & acceptance metrics (PRD v2.1 §14.3, §14.4).
"""
import pytest
from ml.evaluation.evaluate_detection_calibration import run_calibration_evaluation


def test_detection_calibration_metrics_meet_acceptance_targets():
    metrics, results = run_calibration_evaluation()

    assert metrics["total_points"] >= 100, "Validation set must contain >= 100 points"
    assert metrics["overall_accuracy"] >= 0.90, f"Class agreement {metrics['overall_accuracy']} < 0.90"
    assert metrics["forest_recall"] >= 0.90, f"Forest recall {metrics['forest_recall']} < 0.90"
    assert metrics["urban_recall"] >= 0.90, f"Urban recall {metrics['urban_recall']} < 0.90"
    assert metrics["plantation_forest_fpr"] <= 0.05, f"Plantation->Forest FPR {metrics['plantation_forest_fpr']} > 0.05"
    assert metrics["farmland_false_block_rate"] <= 0.05, f"Farmland false block rate {metrics['farmland_false_block_rate']} > 0.05"

    acc = metrics["acceptance_criteria"]
    assert acc["forest_recall_pass"] is True
    assert acc["urban_recall_pass"] is True
    assert acc["plantation_forest_fpr_pass"] is True
    assert acc["farmland_false_block_pass"] is True
    assert acc["class_agreement_pass"] is True
