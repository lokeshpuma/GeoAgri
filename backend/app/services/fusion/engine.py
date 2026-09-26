"""
Multi-Attribute Decision Fusion Engine.
Fuses land suitability, crop recommendation score, irrigation cost, expected yield, and climate risk.
Optimizes for balanced crop planning, enforcing exact weighting rules and human-readable rationale generation.
"""
from __future__ import annotations


from app.services.crops.registry import get_crop_registry

DEFAULT_WEIGHTS = {
    "land_suitability": 0.15,
    "crop_recommendation": 0.40,
    "irrigation_cost": 0.10,
    "yield": 0.25,
    "climate_risk": 0.10
}

def fusion_score(
    land_suit: float,
    crop_rec: float,
    irrigation_cost_norm: float,
    yield_norm: float,
    climate_risk_norm: float,
    weights: dict = DEFAULT_WEIGHTS
) -> float:
    """
    Computes exact weighted multi-attribute score.
    fusion_score = w1*land_suit + w2*crop_rec - w3*irrigation_cost_norm + w4*yield_norm - w5*climate_risk_norm
    """
    w1 = weights.get("land_suitability", 0.15)
    w2 = weights.get("crop_recommendation", 0.40)
    w3 = weights.get("irrigation_cost", 0.10)
    w4 = weights.get("yield", 0.25)
    w5 = weights.get("climate_risk", 0.10)

    raw_score = (w1 * land_suit) + (w2 * crop_rec) - (w3 * irrigation_cost_norm) + (w4 * yield_norm) - (w5 * climate_risk_norm)
    # Rescale from range [-0.25, 0.85] to [0.0, 1.0]
    scaled = max(0.0, min(1.0, (raw_score + 0.25) / 1.05))
    return round(scaled, 3)

def run_decision_fusion(
    model_outputs: dict,
    irrigation_preference: str | None = None,
    limit: int = 100,
    include_low_confidence: bool = False
) -> list[dict]:
    """
    Fuses outputs from Models A-E across all crops, ranks descending, and returns top recommendations.
    Hard-blocks data_confidence == 'low' crops from ranked output before scoring unless explicitly opted in.
    """
    registry = get_crop_registry()
    
    mod_a = model_outputs.get("model_a", {})
    mod_b = model_outputs.get("model_b", {})
    mod_c = model_outputs.get("model_c", {})
    mod_d = model_outputs.get("model_d", {})
    mod_e = model_outputs.get("model_e", {})

    land_suit_val = mod_a.get("score", 0.70)
    land_grade = mod_a.get("grade", "")

    # HARD GUARDRAIL: Return 0 crops for water bodies or polar/alpine non-arable biomes
    if land_suit_val == 0.0 or "Water Body" in land_grade or "Polar Glacial" in land_grade or "High Alpine" in land_grade:
        return []

    # Adjust weights based on irrigation preference
    weights = DEFAULT_WEIGHTS.copy()
    if irrigation_preference == "rainfed":
        weights["irrigation_cost"] = 0.20
        weights["yield"] = 0.20
        weights["crop_recommendation"] = 0.35
    elif irrigation_preference == "full":
        weights["irrigation_cost"] = 0.05
        weights["yield"] = 0.30
        weights["crop_recommendation"] = 0.40

    w1 = weights.get("land_suitability", 0.15)
    w2 = weights.get("crop_recommendation", 0.40)
    w3 = weights.get("irrigation_cost", 0.10)
    w4 = weights.get("yield", 0.25)
    w5 = weights.get("climate_risk", 0.10)

    candidates = []

    for crop_id, rec_data in mod_b.items():
        crop_profile = registry.get_crop(crop_id)
        if not crop_profile:
            continue

        conf = crop_profile.data_confidence

        # BUG 3 FIX: Hard-block low-confidence crops from competing in top ranked output
        if conf == "low" and not include_low_confidence:
            continue

        crop_name = crop_profile.crop_name
        category = crop_profile.category

        crop_rec_val = rec_data.get("score", 0.50)
        suitability_score = rec_data.get("suitability_score", 0.50)
        regional_prior = rec_data.get("regional_agronomic_prior", 1.0)

        # Skip crops that received hard 0 from agronomic or lethal thermal filters
        if crop_rec_val <= 0.0 or suitability_score <= 0.0:
            continue

        # Model C Irrigation normalization
        c_data = mod_c.get(crop_id, {})
        mode = c_data.get("mode", "supplemental")
        water_need = c_data.get("water_need_mm", crop_profile.water_need_mm)
        irrig_cost_norm = 0.1 if mode == "rainfed" else (0.5 if mode == "supplemental" else 0.9)

        # Model D Yield normalization: evaluate against crop's own potential (p90)
        d_data = mod_d.get(crop_id, {})
        p10 = d_data.get("p10", crop_profile.baseline_yield_t_ha.p10)
        p50 = d_data.get("p50", crop_profile.baseline_yield_t_ha.p50)
        p90 = d_data.get("p90", crop_profile.baseline_yield_t_ha.p90)
        crop_target_p90 = max(0.2, crop_profile.baseline_yield_t_ha.p90)
        yield_norm = min(1.0, p50 / crop_target_p90)

        # Model E Climate Risk normalization
        e_data = mod_e.get(crop_id, {})
        risk_score = e_data.get("risk_score", 20.0)
        risk_note = e_data.get("risk_note", "Standard risk profile.")
        climate_risk_norm = min(1.0, risk_score / 100.0)

        # Compute fusion score
        f_score = fusion_score(
            land_suit=land_suit_val,
            crop_rec=crop_rec_val,
            irrigation_cost_norm=irrig_cost_norm,
            yield_norm=yield_norm,
            climate_risk_norm=climate_risk_norm,
            weights=weights
        )

        # BUG 2 FIX: Compute weighted contributions and rank drivers dynamically
        term_crop_rec = w2 * crop_rec_val
        term_yield = w4 * yield_norm
        term_land = w1 * land_suit_val
        term_water_eff = w3 * (1.0 - irrig_cost_norm)
        term_resilience = w5 * (1.0 - climate_risk_norm)

        contributions = [
            ("Agronomic Match (Model B)", term_crop_rec),
            ("Yield Potential (Model D)", term_yield),
            ("Land Suitability (Model A)", term_land),
            ("Water Efficiency", term_water_eff),
            ("Climate Resilience", term_resilience),
        ]
        contributions.sort(key=lambda x: x[1], reverse=True)
        top1_name, top1_val = contributions[0]
        top2_name, top2_val = contributions[1]

        # Intercrop options
        intercrops = [opt.model_dump() for opt in crop_profile.intercrop_options]
        intercrop_avail = getattr(crop_profile, "intercrop_data_available", True)
        sole_rationale = getattr(crop_profile, "sole_crop_rationale", None)

        candidates.append({
            "crop_id": crop_id,
            "crop_name": crop_name,
            "category": category,
            "recommendation_score": f_score,
            "suitability_score": suitability_score,
            "regional_agronomic_prior": regional_prior,
            "expected_yield_t_ha": {"p10": p10, "p50": p50, "p90": p90},
            "irrigation_mode": mode,
            "water_need_mm": water_need,
            "climate_risk_score": risk_score,
            "climate_risk_note": risk_note,
            "intercrop_options": intercrops,
            "intercrop_data_available": intercrop_avail,
            "sole_crop_rationale": sole_rationale,
            "data_confidence": conf,
            "fusion_inputs": {
                "land_suit": round(land_suit_val, 4),
                "crop_rec": round(crop_rec_val, 4),
                "irrig_cost_norm": round(irrig_cost_norm, 4),
                "yield_norm": round(yield_norm, 4),
                "climate_risk_norm": round(climate_risk_norm, 4)
            },
            "_top_drivers": (top1_name, top1_val, top2_name, top2_val),
            "_regional_prior": regional_prior,
            "_mode": mode,
            "_water_need": water_need,
            "_risk_score": risk_score
        })

    # Sort descending by recommendation_score
    candidates.sort(key=lambda x: x["recommendation_score"], reverse=True)

    # Ensure distinct crop species diversity across top recommendations
    distinct_recs = []
    seen_base_crops = set()
    rank = 1

    for item in candidates:
        base_crop_id = item["crop_id"].split("_var_")[0]
        if base_crop_id not in seen_base_crops:
            seen_base_crops.add(base_crop_id)

            # Build exact dynamic rationale naming top 2 contributing terms with numeric values
            top1_name, top1_val, top2_name, top2_val = item["_top_drivers"]
            prior = item["_regional_prior"]
            mode = item["_mode"]
            water_need = item["_water_need"]
            risk_score = item["_risk_score"]

            if prior >= 1.15:
                prior_note = f", reinforced by regional agronomic prior ({prior:.2f}x)"
            elif prior <= 0.85:
                prior_note = f", moderated by regional agronomic prior ({prior:.2f}x)"
            else:
                prior_note = ""

            water_note = (
                f"requires {mode} irrigation ({round(water_need)}mm water need)"
                if mode != "rainfed"
                else "minimal supplementary water overhead"
            )

            rationale = (
                f"{item['crop_name']} ranks #{rank} driven primarily by {top1_name} (+{top1_val:.3f}) "
                f"and {top2_name} (+{top2_val:.3f}){prior_note}; {water_note} with {risk_score:.0f}/100 climate risk."
            )

            # Clean temporary keys
            rec = {k: v for k, v in item.items() if not k.startswith("_")}
            rec["rationale"] = rationale
            distinct_recs.append(rec)
            rank += 1

        if len(distinct_recs) >= limit:
            break

    return distinct_recs
