"""
Unit tests for Phase 6: Decision Fusion Engine & Worked Example Verification.
"""

import pytest
from app.services.fusion.engine import run_decision_fusion, fusion_score

def test_fusion_score_math():
    # High suitability, high rec, low irrig cost, high yield, low risk
    score_high = fusion_score(
        land_suit=0.9, crop_rec=0.85, irrigation_cost_norm=0.1, yield_norm=0.8, climate_risk_norm=0.1
    )
    # Low suitability, low rec, high irrig cost, low yield, high risk
    score_low = fusion_score(
        land_suit=0.3, crop_rec=0.3, irrigation_cost_norm=0.9, yield_norm=0.2, climate_risk_norm=0.8
    )
    assert score_high > score_low

def test_section_18_worked_example_ranking():
    """
    Section 18 Worked Example:
    - Maize: Moderate yield (3.6 t/ha), rainfed (600mm), low risk (15%) -> High fusion score
    - Groundnut: Moderate yield (1.8 t/ha), rainfed (500mm), low risk (10%) -> High fusion score
    - Rice: High raw yield (5.0 t/ha), FULL irrigation (1800mm), HIGH climate risk (65%) -> Lower overall rank
    """
    synthetic_model_outputs = {
        "model_a": {"score": 0.85, "grade": "High"},
        "model_b": {
            "maize": {"score": 0.85, "suitability_score": 0.82},
            "groundnut": {"score": 0.82, "suitability_score": 0.80},
            "rice": {"score": 0.70, "suitability_score": 0.65}
        },
        "model_c": {
            "maize": {"mode": "rainfed", "water_need_mm": 600.0},
            "groundnut": {"mode": "rainfed", "water_need_mm": 500.0},
            "rice": {"mode": "full", "water_need_mm": 1800.0}
        },
        "model_d": {
            "maize": {"p10": 2.4, "p50": 3.6, "p90": 5.5},
            "groundnut": {"p10": 1.2, "p50": 1.8, "p90": 2.6},
            "rice": {"p10": 3.5, "p50": 5.0, "p90": 6.8}
        },
        "model_e": {
            "maize": {"risk_score": 15.0, "risk_note": "Low risk"},
            "groundnut": {"risk_score": 10.0, "risk_note": "Low risk"},
            "rice": {"risk_score": 65.0, "risk_note": "High flood & water requirement risk"}
        }
    }

    recs = run_decision_fusion(synthetic_model_outputs, limit=10)
    crop_order = [r["crop_id"] for r in recs]

    assert "maize" in crop_order
    assert "groundnut" in crop_order
    assert "rice" in crop_order

    maize_idx = crop_order.index("maize")
    rice_idx = crop_order.index("rice")

    # Maize should rank ahead of Rice
    assert maize_idx < rice_idx
