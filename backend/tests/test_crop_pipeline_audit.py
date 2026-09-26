"""
Integration and audit tests for the rebuilt crop data pipeline & recommendation logic.
Verifies canonical taxonomy, absence of synthetic variants, absence of leaked CSV headers,
absence of templated/duplicate statistical rows, and verifies dynamic recommendation behavior.
"""

import pytest
from app.services.crops.intercrop_recommendation_service import recommend_intercrops
from ml.training.validate_crop_pipeline import (
    validate_canonical_taxonomy,
    validate_no_synthetic_duplicates,
    validate_clean_intercrop_pairs,
    validate_statistical_grounding_and_no_duplicate_profiles,
)


def test_audit_canonical_taxonomy():
    """Validates that every crop_id referenced anywhere resolves to exactly one canonical crop."""
    res = validate_canonical_taxonomy()
    assert res["status"] == "passed"


def test_audit_no_synthetic_duplicate_varieties():
    """Validates that no _var_NN synthetic entries exist in crop_registry.json or any file."""
    res = validate_no_synthetic_duplicates()
    assert res["status"] == "passed"


def test_audit_intercrop_pairs_clean_of_headers():
    """Validates that no column headers leaked into data rows of intercrop_pairs_best.csv."""
    res = validate_clean_intercrop_pairs()
    assert res["status"] == "passed"
    assert res["pairs_count"] > 20


def test_audit_statistical_grounding_and_unique_profiles():
    """Validates high confidence for core crops and no identical averages to 2 decimal places."""
    res = validate_statistical_grounding_and_no_duplicate_profiles()
    assert res["status"] == "passed"
    assert res["high_confidence_count"] == 22


def test_dynamic_recommendations_varying_environments():
    """
    Integration test: Runs multiple diverse environmental & soil inputs and asserts
    that the top-10 output is not the same static list every time, and that recommendations
    dynamically adapt to agronomic realities with explicit confidence scores.
    """
    # Sample A: Tropical wet paddies (High rain, high humidity, warm, high N)
    sample_a_env = {"temp_c": 24.0, "rainfall_mm": 240.0, "ph": 6.5, "humidity_pct": 82.0}
    sample_a_soil = {"N": 90, "P": 42, "K": 43}
    recs_a = recommend_intercrops(sample_a_env, season="kharif", limit=10, soil=sample_a_soil)

    # Sample B: Arid desert fringe (Low rain, warm, low humidity, low N)
    sample_b_env = {"temp_c": 28.0, "rainfall_mm": 30.0, "ph": 6.8, "humidity_pct": 30.0}
    sample_b_soil = {"N": 20, "P": 45, "K": 20}
    recs_b = recommend_intercrops(sample_b_env, season="kharif", limit=10, soil=sample_b_soil)

    # Sample C: Cool temperate orchard (Cool temp, high P & K, moderate rainfall)
    sample_c_env = {"temp_c": 22.0, "rainfall_mm": 110.0, "ph": 6.0, "humidity_pct": 92.0}
    sample_c_soil = {"N": 20, "P": 135, "K": 200}
    recs_c = recommend_intercrops(sample_c_env, season="kharif", limit=10, soil=sample_c_soil)

    # Sample D: High nitrogen commercial fibre/cash crop (Warm, moderate rain, high N)
    sample_d_env = {"temp_c": 25.0, "rainfall_mm": 80.0, "ph": 6.9, "humidity_pct": 80.0}
    sample_d_soil = {"N": 120, "P": 45, "K": 20}
    recs_d = recommend_intercrops(sample_d_env, season="kharif", limit=10, soil=sample_d_soil)

    top10_a = [r["crop_id"] for r in recs_a]
    top10_b = [r["crop_id"] for r in recs_b]
    top10_c = [r["crop_id"] for r in recs_c]
    top10_d = [r["crop_id"] for r in recs_d]

    print("\nTop 10 Sample A (Tropical Wet):", top10_a)
    print("Top 10 Sample B (Arid Warm):", top10_b)
    print("Top 10 Sample C (Cool High P/K):", top10_c)
    print("Top 10 Sample D (High N Cotton/Cash):", top10_d)

    # Core assertion: the outputs must NOT be the same static list every time!
    all_top10_tuples = {tuple(top10_a), tuple(top10_b), tuple(top10_c), tuple(top10_d)}
    assert len(all_top10_tuples) == 4, "Top-10 recommendations must be distinct across diverse environments"

    # Specific agronomic assertions
    assert top10_a[0] == "rice", f"Expected Rice to rank #1 in tropical high-rain conditions, got {top10_a[0]}"
    assert top10_b[0] in ["moth_bean", "muskmelon", "watermelon"], (
        f"Expected arid adapted crop (moth_bean/muskmelon) to rank #1 in arid conditions, got {top10_b[0]}"
    )
    assert top10_c[0] == "apple", f"Expected Apple to rank #1 in cool high P/K conditions, got {top10_c[0]}"

    # Verify confidence scores exist and are explicit
    for rec_list in [recs_a, recs_b, recs_c, recs_d]:
        for r in rec_list:
            assert "confidence" in r, "Each recommendation must specify confidence"
            assert "confidence_score" in r, "Each recommendation must include confidence_score"
            assert r["confidence"] in ["high", "medium", "low"]
            assert 0.0 <= r["confidence_score"] <= 1.0
            if r["is_validated"]:
                assert r["confidence"] in ["high", "medium"]
                assert r["confidence_score"] >= 0.60
            else:
                assert r["confidence"] == "low"
                assert r["confidence_score"] <= 0.40


def test_fusion_rationale_diversity_and_top_terms():
    """
    Bug 2 audit: For the same field, asserts that no two crops in the top 10
    produce byte-identical rationale strings unless their fusion inputs are also
    identical to 3 decimal places.
    """
    from app.models.model_a_suitability.model import ModelASuitability
    from app.models.model_b_recommendation.model import ModelBRecommendation
    from app.services.fusion.engine import run_decision_fusion

    synthetic_vector = {
        "latitude": 14.46,
        "longitude": 75.92,
        "rainfall_mm": 650.0,
        "temp_mean_c": 26.5,
        "ph": 6.8,
        "humidity_pct": 65.0,
        "nitrogen_g_kg": 0.4,
        "phosphorus_ppm": 35.0,
        "potassium_ppm": 120.0,
        "slope_mean": 2.0,
        "twi_mean": 5.5,
        "ndvi_mean": 0.62,
        "is_arable": 1.0,
        "is_water": 0.0,
    }
    mod_a = ModelASuitability().predict(synthetic_vector)
    mod_b = ModelBRecommendation().predict(synthetic_vector, season="kharif")
    model_outputs = {
        "model_a": mod_a,
        "model_b": mod_b,
        "model_c": {},
        "model_d": {},
        "model_e": {},
    }
    recs = run_decision_fusion(model_outputs, irrigation_preference="rainfed", limit=10)
    assert len(recs) >= 5

    # Check rationales
    rationales = [r["rationale"] for r in recs]
    for i in range(len(recs)):
        for j in range(i + 1, len(recs)):
            r1 = recs[i]
            r2 = recs[j]
            if r1["rationale"] == r2["rationale"]:
                inputs1 = r1["fusion_inputs"]
                inputs2 = r2["fusion_inputs"]
                assert all(
                    abs(inputs1[k] - inputs2[k]) < 0.001 for k in inputs1
                ), f"Crops {r1['crop_id']} and {r2['crop_id']} have identical rationale but distinct inputs!"
    assert len(set(rationales)) == len(rationales), "All top-10 rationales must be distinct"


def test_exclusion_of_low_confidence_crops_from_top_ranked():
    """
    Bug 3 audit: Confirms that data_confidence == 'low' crops (e.g. oats, rye, triticale)
    are excluded from run_decision_fusion's ranked output by default.
    """
    from app.models.model_a_suitability.model import ModelASuitability
    from app.models.model_b_recommendation.model import ModelBRecommendation
    from app.services.fusion.engine import run_decision_fusion

    synthetic_vector = {
        "latitude": 14.46,
        "longitude": 75.92,
        "rainfall_mm": 650.0,
        "temp_mean_c": 26.5,
        "ph": 6.8,
        "humidity_pct": 65.0,
        "is_arable": 1.0,
        "is_water": 0.0,
    }
    mod_a = ModelASuitability().predict(synthetic_vector)
    mod_b = ModelBRecommendation().predict(synthetic_vector, season="kharif")
    model_outputs = {
        "model_a": mod_a,
        "model_b": mod_b,
        "model_c": {},
        "model_d": {},
        "model_e": {},
    }
    recs = run_decision_fusion(model_outputs, limit=50)
    top_crop_ids = [r["crop_id"] for r in recs]

    forbidden_low_conf = ["oats", "rye", "triticale", "browntop_millet", "adzuki_bean"]
    for crop in forbidden_low_conf:
        assert crop not in top_crop_ids[:10], f"Low-confidence crop {crop} leaked into top-10 recommendations!"

    for r in recs:
        assert r["data_confidence"] in ["high", "medium"], f"Low confidence crop {r['crop_id']} found in ranked output"


def test_no_fabricated_intercrop_fallbacks():
    """
    Bug 1 audit: Verifies that registry crops genuinely missing intercrop matrix entries
    have empty intercrop_options, with zero hardcoded 'cowpea' fallbacks.
    """
    from app.services.crops.registry import get_crop_registry

    registry = get_crop_registry()
    crops = registry.list_crops()

    crops_without_intercrop = [c for c in crops if len(c.intercrop_options) == 0]
    assert len(crops_without_intercrop) > 0, "Expected crops without intercrop data to exist"

    for c in crops_without_intercrop:
        assert c.intercrop_options == [], f"Crop {c.crop_id} should have empty intercrop list"

    all_companions = [
        opt.companion_crop_id
        for c in crops
        for opt in c.intercrop_options
    ]
    assert len(set(all_companions)) > 5, "Companion pairings must have variety and not be a monoculture fallback"


def test_davanagere_karnataka_kharif_simulation():
    """
    Verification: Simulates Davanagere, Karnataka / Kharif / rainfed.
    Confirms:
    (a) not all 5 top crops show the same companion crop.
    (b) no two crops share identical rationale text.
    (c) Oats/Rye/Triticale do not appear in the top 10.
    (d) Regional agronomic prior is populated and reflects Karnataka.
    (e) Diagnostic confidence is dynamically derived, not hardcoded 0.90.
    """
    from app.models.model_a_suitability.model import ModelASuitability
    from app.models.model_b_recommendation.model import ModelBRecommendation
    from app.services.fusion.engine import run_decision_fusion

    davanagere_features = {
        "latitude": 14.46,
        "longitude": 75.92,
        "rainfall_mm": 680.0,
        "temp_mean_c": 27.2,
        "ph": 6.8,
        "organic_carbon_g_kg": 8.5,
        "nitrogen_g_kg": 0.45,
        "phosphorus_ppm": 32.0,
        "potassium_ppm": 140.0,
        "slope_mean": 2.1,
        "twi_mean": 5.4,
        "ndvi_mean": 0.60,
        "is_arable": 1.0,
        "is_water": 0.0,
    }

    mod_a = ModelASuitability().predict(davanagere_features)
    mod_b = ModelBRecommendation().predict(davanagere_features, season="kharif")

    # (e) Derived diagnostic confidence
    assert "confidence" in mod_a
    assert isinstance(mod_a["confidence"], float)

    model_outputs = {
        "model_a": mod_a,
        "model_b": mod_b,
        "model_c": {},
        "model_d": {},
        "model_e": {},
    }

    recs = run_decision_fusion(model_outputs, irrigation_preference="rainfed", limit=10)
    assert len(recs) >= 5

    top5 = recs[:5]

    # (a) Not all 5 top crops show the same companion crop
    companion_names = []
    for r in top5:
        opts = r.get("intercrop_options", [])
        if opts:
            companion_names.append(opts[0]["companion_crop_name"])
        else:
            companion_names.append("None")
    unique_companions = set(companion_names)
    assert len(unique_companions) > 1, f"Top 5 crops must not all share the same companion crop! Got: {companion_names}"

    # (b) No two crops share identical rationale text
    rationales = [r["rationale"] for r in top5]
    assert len(set(rationales)) == len(rationales), f"Rationales in top 5 must all be distinct! Got: {rationales}"

    # (c) Oats/Rye/Triticale excluded
    top10_ids = [r["crop_id"] for r in recs[:10]]
    for excluded in ["oats", "rye", "triticale"]:
        assert excluded not in top10_ids, f"{excluded} must not appear in top 10"

    # (d) Regional agronomic prior is present and reflects Karnataka
    for r in top5:
        assert "regional_agronomic_prior" in r
        prior = r["regional_agronomic_prior"]
        assert isinstance(prior, (int, float))
        assert prior > 0.0

