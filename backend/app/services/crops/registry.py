"""
Crop Registry & Profile Service.
Provides Pydantic schemas and registry lookup for 100+ Indian crops with confidence levels.
"""

from __future__ import annotations
import os
import json
from pathlib import Path
from typing import Literal
import pandas as pd
from pydantic import BaseModel, Field

class QuantileValue(BaseModel):
    p10: float
    p50: float
    p90: float

class IntercropOption(BaseModel):
    companion_crop_id: str
    companion_crop_name: str
    yield_boost_pct: float
    companion_share_factor: float = 0.25
    rationale: str

# Reviewed agronomic allowlist for crops that genuinely grow best alone / dedicated sole-cropping
# with verified scientific rationale (e.g. allelopathic suppression, dense specialized plantation,
# viral vectors/quality degradation, microclimate aeration).
GENUINE_SOLE_CROPS: dict[str, str] = {
    "tea": "Dense perennial Camellia sinensis plantation with shade tree canopy; sole cropped under high rainfall.",
    "tobacco": "High-grade commercial Solanaceae; strictly sole-cropped to prevent Tobacco Mosaic Virus (TMV) and leaf quality loss.",
    "cumin": "Arid sensitive spice; prone to blight and Fusarium wilt, requires clean sole-crop aeration.",
    "clover": "Forage legume broadcast as pure dense sward or green manure pasture.",
    "olive": "Perennial Olea europaea grove crop with extensive shallow root spread.",
    "pistachio": "Specialized arid Pistacia vera nut tree orchard.",
    "almond": "Dedicated Prunus dulcis nut orchard with specialized pollination and disease management.",
    "walnut": "Juglone allelopathy severely stunts adjacent annual crops; strictly solitary or dedicated Juglans regia orchard."
}

class CropProfile(BaseModel):
    crop_id: str
    crop_name: str
    category: str
    season: str                                # kharif, rabi, zaid, annual, perennial
    water_need_mm: float
    ideal_temp_min: float
    ideal_temp_max: float
    ideal_ph_min: float
    ideal_ph_max: float
    ideal_rainfall_min: float
    ideal_rainfall_max: float
    baseline_yield_t_ha: QuantileValue
    data_confidence: Literal["high", "medium", "low"]
    intercrop_options: list[IntercropOption] = Field(default_factory=list)
    intercrop_data_available: bool = True
    sole_crop_rationale: str | None = None

class CropRegistry:
    def __init__(self, registry_file: str | None = None):
        self._crops: dict[str, CropProfile] = {}
        if registry_file and os.path.exists(registry_file):
            self.load_from_json(registry_file)
        else:
            self._initialize_seed_registry()

    def load_from_json(self, filepath: str):
        from app.services.crops.crop_taxonomy import normalize_crop_id, get_crop_display_name
        with open(filepath, "r") as f:
            data = json.load(f)
            for item in data:
                cid = item.get("crop_id", "")
                if "_var_" in cid:
                    continue
                canonical_id = normalize_crop_id(cid)
                item["crop_id"] = canonical_id
                if not item.get("crop_name") or item["crop_name"] == cid:
                    item["crop_name"] = get_crop_display_name(canonical_id)
                # Remap companion crop ids and deduplicate
                cleaned_opts = []
                seen_comps = set()
                for opt in item.get("intercrop_options", []):
                    c_comp = normalize_crop_id(opt.get("companion_crop_id", ""))
                    if c_comp in seen_comps or c_comp == canonical_id:
                        continue
                    seen_comps.add(c_comp)
                    opt["companion_crop_id"] = c_comp
                    opt["companion_crop_name"] = get_crop_display_name(c_comp)
                    cleaned_opts.append(opt)
                item["intercrop_options"] = cleaned_opts
                profile = CropProfile(**item)
                self._crops[canonical_id] = profile

    def save_to_json(self, filepath: str):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        data = [crop.model_dump() for crop in self._crops.values()]
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)

    def get_crop(self, crop_id: str) -> CropProfile | None:
        from app.services.crops.crop_taxonomy import normalize_crop_id
        canonical_id = normalize_crop_id(crop_id)
        return self._crops.get(canonical_id)

    def list_crops(self) -> list[CropProfile]:
        return list(self._crops.values())

    def _initialize_seed_registry(self):
        """Seed registry with canonical Indian crops without synthetic duplicates."""
        categories = {
            "cereals": [
                ("rice", "Rice", "kharif", 1200.0, 20.0, 35.0, 5.5, 7.5, 1000.0, 2500.0, QuantileValue(p10=2.2, p50=3.5, p90=5.0), "high"),
                ("wheat", "Wheat", "rabi", 450.0, 12.0, 25.0, 6.0, 7.5, 350.0, 650.0, QuantileValue(p10=2.5, p50=3.8, p90=5.2), "high"),
                ("maize", "Maize", "kharif", 600.0, 18.0, 35.0, 5.5, 7.5, 500.0, 1000.0, QuantileValue(p10=2.4, p50=3.6, p90=5.5), "high"),
                ("sorghum", "Sorghum (Jowar)", "kharif", 450.0, 20.0, 38.0, 5.5, 8.5, 400.0, 800.0, QuantileValue(p10=1.0, p50=1.5, p90=2.5), "high"),
                ("pearl_millet", "Pearl Millet (Bajra)", "kharif", 350.0, 22.0, 40.0, 5.5, 8.0, 300.0, 650.0, QuantileValue(p10=0.8, p50=1.3, p90=2.2), "medium"),
                ("finger_millet", "Finger Millet (Ragi)", "kharif", 400.0, 18.0, 32.0, 5.0, 7.5, 350.0, 750.0, QuantileValue(p10=1.0, p50=1.6, p90=2.5), "medium"),
                ("barley", "Barley", "rabi", 400.0, 12.0, 24.0, 6.0, 7.8, 300.0, 500.0, QuantileValue(p10=1.8, p50=2.8, p90=4.0), "medium"),
                ("small_millets", "Small Millets", "kharif", 300.0, 20.0, 35.0, 5.0, 7.5, 250.0, 600.0, QuantileValue(p10=0.5, p50=0.9, p90=1.5), "low"),
                ("durum_wheat", "Durum Wheat", "rabi", 400.0, 14.0, 30.0, 6.5, 8.2, 300.0, 550.0, QuantileValue(p10=2.2, p50=3.4, p90=4.8), "high"),
            ],
            "pulses": [
                ("chickpea", "Chickpea (Gram)", "rabi", 350.0, 15.0, 28.0, 6.0, 8.0, 300.0, 550.0, QuantileValue(p10=0.8, p50=1.2, p90=1.8), "high"),
                ("pigeon_pea", "Pigeon Pea (Arhar)", "kharif", 500.0, 20.0, 35.0, 5.5, 7.5, 450.0, 800.0, QuantileValue(p10=0.6, p50=0.9, p90=1.5), "high"),
                ("green_gram", "Green Gram (Moong)", "kharif", 350.0, 22.0, 35.0, 6.2, 7.5, 300.0, 600.0, QuantileValue(p10=0.5, p50=0.7, p90=1.2), "high"),
                ("black_gram", "Black Gram (Urad)", "kharif", 350.0, 22.0, 35.0, 6.0, 7.5, 300.0, 600.0, QuantileValue(p10=0.5, p50=0.8, p90=1.3), "high"),
                ("lentil", "Lentil (Masoor)", "rabi", 300.0, 15.0, 25.0, 6.0, 7.5, 250.0, 450.0, QuantileValue(p10=0.6, p50=1.0, p90=1.6), "high"),
                ("pea", "Field Pea", "rabi", 350.0, 10.0, 22.0, 6.0, 7.5, 300.0, 500.0, QuantileValue(p10=0.9, p50=1.4, p90=2.1), "medium"),
                ("cowpea", "Cowpea (Lobia)", "kharif", 350.0, 20.0, 35.0, 5.5, 7.5, 300.0, 600.0, QuantileValue(p10=0.6, p50=1.1, p90=1.7), "medium"),
                ("moth_bean", "Moth Bean", "kharif", 250.0, 24.0, 40.0, 6.0, 8.0, 200.0, 450.0, QuantileValue(p10=0.3, p50=0.5, p90=0.9), "high"),
                ("cluster_bean", "Cluster Bean (Guar)", "kharif", 250.0, 22.0, 42.0, 7.0, 8.5, 200.0, 450.0, QuantileValue(p10=0.6, p50=1.1, p90=1.8), "high"),
                ("fava_bean", "Fava Bean (Broad Bean)", "rabi", 400.0, 12.0, 25.0, 6.0, 7.8, 300.0, 550.0, QuantileValue(p10=1.5, p50=2.6, p90=3.8), "high"),
                ("horse_gram", "Horse Gram (Kulthi)", "kharif", 250.0, 20.0, 34.0, 5.0, 7.5, 200.0, 500.0, QuantileValue(p10=0.4, p50=0.7, p90=1.1), "low"),
            ],
            "oilseeds": [
                ("groundnut", "Groundnut (Peanut)", "kharif", 500.0, 22.0, 32.0, 5.8, 7.2, 450.0, 800.0, QuantileValue(p10=1.2, p50=1.8, p90=2.6), "high"),
                ("soybean", "Soybean", "kharif", 550.0, 20.0, 32.0, 6.0, 7.5, 450.0, 850.0, QuantileValue(p10=1.0, p50=1.4, p90=2.1), "high"),
                ("mustard", "Mustard", "rabi", 350.0, 10.0, 25.0, 6.0, 7.5, 250.0, 500.0, QuantileValue(p10=0.9, p50=1.4, p90=2.0), "high"),
                ("sunflower", "Sunflower", "rabi", 500.0, 18.0, 32.0, 6.0, 7.8, 400.0, 750.0, QuantileValue(p10=0.8, p50=1.2, p90=1.8), "medium"),
                ("sesame", "Sesame (Til)", "kharif", 350.0, 24.0, 36.0, 5.5, 7.8, 300.0, 600.0, QuantileValue(p10=0.3, p50=0.5, p90=0.8), "medium"),
                ("safflower", "Safflower (Kusum)", "rabi", 350.0, 15.0, 30.0, 6.0, 8.0, 250.0, 500.0, QuantileValue(p10=0.5, p50=0.9, p90=1.4), "medium"),
                ("castor", "Castor Seed", "kharif", 500.0, 20.0, 35.0, 5.5, 7.5, 400.0, 750.0, QuantileValue(p10=1.0, p50=1.6, p90=2.3), "medium"),
                ("niger_seed", "Niger Seed", "kharif", 350.0, 18.0, 32.0, 5.5, 7.5, 300.0, 600.0, QuantileValue(p10=0.2, p50=0.4, p90=0.7), "low"),
            ],
            "cash_crops": [
                ("cotton", "Cotton", "kharif", 700.0, 20.0, 35.0, 6.0, 8.0, 600.0, 1100.0, QuantileValue(p10=1.4, p50=2.1, p90=3.2), "high"),
                ("almond", "Almond", "perennial", 800.0, 15.0, 36.0, 6.0, 8.0, 350.0, 750.0, QuantileValue(p10=1.5, p50=2.4, p90=3.5), "high"),
                ("olive", "Olive", "perennial", 550.0, 12.0, 38.0, 6.5, 8.5, 300.0, 700.0, QuantileValue(p10=4.0, p50=7.5, p90=11.0), "high"),
                ("pistachio", "Pistachio", "perennial", 650.0, 16.0, 40.0, 7.0, 8.5, 250.0, 600.0, QuantileValue(p10=1.2, p50=2.0, p90=3.2), "high"),
                ("walnut", "Walnut", "perennial", 850.0, 10.0, 32.0, 6.0, 7.5, 500.0, 1000.0, QuantileValue(p10=1.8, p50=3.0, p90=4.5), "medium"),
                ("sugarcane", "Sugarcane", "annual", 1800.0, 20.0, 38.0, 6.0, 7.8, 1200.0, 2500.0, QuantileValue(p10=55.0, p50=70.0, p90=95.0), "high"),
                ("jute", "Jute", "kharif", 1000.0, 24.0, 37.0, 6.0, 7.5, 1200.0, 2000.0, QuantileValue(p10=1.8, p50=2.5, p90=3.4), "high"),
                ("tobacco", "Tobacco", "rabi", 500.0, 20.0, 32.0, 5.5, 7.5, 450.0, 750.0, QuantileValue(p10=1.2, p50=1.8, p90=2.5), "medium"),
                ("tea", "Tea", "perennial", 1600.0, 18.0, 30.0, 4.5, 5.5, 1500.0, 2500.0, QuantileValue(p10=1.5, p50=2.2, p90=3.0), "medium"),
                ("coffee", "Coffee", "perennial", 1400.0, 15.0, 28.0, 5.5, 6.5, 1200.0, 2000.0, QuantileValue(p10=0.6, p50=1.0, p90=1.5), "high"),
                ("rubber", "Rubber", "perennial", 2000.0, 20.0, 34.0, 4.5, 6.0, 1800.0, 3000.0, QuantileValue(p10=1.2, p50=1.7, p90=2.3), "low"),
                ("arecanut", "Arecanut", "perennial", 1500.0, 18.0, 35.0, 5.5, 7.5, 1200.0, 2200.0, QuantileValue(p10=1.0, p50=1.5, p90=2.2), "low"),
                ("clover", "Berseem Clover", "rabi", 550.0, 12.0, 28.0, 6.5, 8.2, 350.0, 700.0, QuantileValue(p10=28.0, p50=42.0, p90=60.0), "high"),
                ("cassava", "Cassava", "annual", 900.0, 20.0, 36.0, 5.0, 7.5, 800.0, 1800.0, QuantileValue(p10=12.0, p50=20.0, p90=32.0), "high"),
            ],
            "vegetables": [
                ("potato", "Potato", "rabi", 500.0, 12.0, 24.0, 5.2, 6.8, 400.0, 600.0, QuantileValue(p10=16.0, p50=22.0, p90=30.0), "high"),
                ("onion", "Onion", "rabi", 450.0, 13.0, 28.0, 6.0, 7.5, 350.0, 550.0, QuantileValue(p10=12.0, p50=18.0, p90=25.0), "high"),
                ("tomato", "Tomato", "zaid", 600.0, 18.0, 30.0, 6.0, 7.0, 450.0, 800.0, QuantileValue(p10=18.0, p50=25.0, p90=36.0), "high"),
                ("eggplant", "Eggplant (Brinjal)", "zaid", 500.0, 20.0, 32.0, 5.5, 6.8, 400.0, 700.0, QuantileValue(p10=15.0, p50=22.0, p90=30.0), "medium"),
                ("cabbage", "Cabbage", "rabi", 400.0, 15.0, 22.0, 5.5, 6.8, 300.0, 500.0, QuantileValue(p10=18.0, p50=25.0, p90=34.0), "medium"),
                ("cauliflower", "Cauliflower", "rabi", 400.0, 15.0, 22.0, 5.5, 6.8, 300.0, 500.0, QuantileValue(p10=14.0, p50=20.0, p90=28.0), "medium"),
                ("okra", "Okra (Bhindi)", "zaid", 450.0, 22.0, 35.0, 6.0, 6.8, 400.0, 700.0, QuantileValue(p10=8.0, p50=12.0, p90=16.0), "medium"),
                ("chilli", "Chilli", "kharif", 500.0, 20.0, 35.0, 6.0, 7.5, 400.0, 700.0, QuantileValue(p10=1.5, p50=2.5, p90=3.8), "medium"),
                ("garlic", "Garlic", "rabi", 400.0, 12.0, 25.0, 6.0, 7.0, 300.0, 500.0, QuantileValue(p10=4.5, p50=7.0, p90=10.0), "low"),
                ("ginger", "Ginger", "kharif", 1300.0, 19.0, 30.0, 5.5, 6.5, 1200.0, 1800.0, QuantileValue(p10=12.0, p50=18.0, p90=25.0), "low"),
            ],
            "fruits": [
                ("mango", "Mango", "perennial", 900.0, 24.0, 38.0, 5.5, 7.5, 750.0, 1200.0, QuantileValue(p10=5.0, p50=8.5, p90=14.0), "high"),
                ("banana", "Banana", "perennial", 1500.0, 15.0, 35.0, 6.0, 7.5, 1200.0, 2200.0, QuantileValue(p10=30.0, p50=45.0, p90=60.0), "high"),
                ("orange", "Orange", "perennial", 1000.0, 13.0, 38.0, 5.5, 7.5, 800.0, 1300.0, QuantileValue(p10=8.0, p50=14.0, p90=20.0), "high"),
                ("apple", "Apple", "perennial", 1000.0, 6.0, 22.0, 5.5, 6.8, 800.0, 1200.0, QuantileValue(p10=6.0, p50=10.0, p90=16.0), "high"),
                ("grapes", "Grapes", "perennial", 800.0, 15.0, 38.0, 6.0, 7.5, 600.0, 1000.0, QuantileValue(p10=14.0, p50=22.0, p90=30.0), "high"),
                ("pomegranate", "Pomegranate", "perennial", 600.0, 18.0, 38.0, 6.5, 8.0, 500.0, 900.0, QuantileValue(p10=6.0, p50=10.0, p90=15.0), "high"),
                ("guava", "Guava", "perennial", 800.0, 15.0, 38.0, 5.0, 7.5, 700.0, 1200.0, QuantileValue(p10=10.0, p50=16.0, p90=22.0), "medium"),
                ("papaya", "Papaya", "perennial", 1300.0, 22.0, 38.0, 6.0, 7.0, 1000.0, 1800.0, QuantileValue(p10=35.0, p50=50.0, p90=70.0), "high"),
                ("watermelon", "Watermelon", "zaid", 450.0, 22.0, 35.0, 6.0, 7.0, 400.0, 600.0, QuantileValue(p10=20.0, p50=32.0, p90=45.0), "high"),
                ("muskmelon", "Muskmelon", "zaid", 400.0, 22.0, 35.0, 6.0, 7.0, 350.0, 550.0, QuantileValue(p10=12.0, p50=18.0, p90=25.0), "high"),
                ("coconut", "Coconut", "perennial", 1800.0, 20.0, 35.0, 5.2, 7.5, 1300.0, 2500.0, QuantileValue(p10=6.0, p50=10.0, p90=15.0), "high"),
            ],
            "spices": [
                ("turmeric", "Turmeric", "kharif", 1300.0, 20.0, 35.0, 5.5, 7.5, 1000.0, 1800.0, QuantileValue(p10=15.0, p50=22.0, p90=30.0), "medium"),
                ("coriander", "Coriander", "rabi", 350.0, 15.0, 25.0, 6.0, 7.5, 250.0, 450.0, QuantileValue(p10=0.6, p50=1.0, p90=1.5), "medium"),
                ("cumin", "Cumin (Jeera)", "rabi", 300.0, 15.0, 28.0, 6.5, 7.8, 200.0, 400.0, QuantileValue(p10=0.4, p50=0.6, p90=0.9), "medium"),
                ("cardamom", "Cardamom", "perennial", 1800.0, 15.0, 30.0, 5.0, 6.5, 1500.0, 2500.0, QuantileValue(p10=0.2, p50=0.3, p90=0.5), "low"),
                ("black_pepper", "Black Pepper", "perennial", 1600.0, 18.0, 35.0, 5.5, 6.5, 1400.0, 2400.0, QuantileValue(p10=0.8, p50=1.2, p90=1.8), "low"),
            ]
        }

        for category, crop_list in categories.items():
            for c_id, c_name, season, water, t_min, t_max, ph_min, ph_max, r_min, r_max, yield_val, confidence in crop_list:
                profile = CropProfile(
                    crop_id=c_id,
                    crop_name=c_name,
                    category=category,
                    season=season,
                    water_need_mm=water,
                    ideal_temp_min=t_min,
                    ideal_temp_max=t_max,
                    ideal_ph_min=ph_min,
                    ideal_ph_max=ph_max,
                    ideal_rainfall_min=r_min,
                    ideal_rainfall_max=r_max,
                    baseline_yield_t_ha=yield_val,
                    data_confidence=confidence,
                    intercrop_options=[]
                )
                self._crops[c_id] = profile

        # Seed additional real species from crop_profile_best.csv without synthetic duplicates
        from app.services.crops.crop_taxonomy import normalize_crop_id, get_crop_display_name
        profile_candidates = [
            "backend/ml/data/processed/crop_profile_best.csv",
            "ml/data/processed/crop_profile_best.csv"
        ]
        for p_path in profile_candidates:
            if os.path.exists(p_path):
                try:
                    df_p = pd.read_csv(p_path)
                    for _, row in df_p.iterrows():
                        c_id = normalize_crop_id(row.get("crop_id"))
                        if c_id not in self._crops and c_id != "unknown":
                            c_name = str(row.get("crop_name", get_crop_display_name(c_id)))
                            category = str(row.get("category", "general"))
                            season_raw = str(row.get("seasons", "kharif"))
                            season = season_raw.split("|")[0] if season_raw else "kharif"
                            yp = float(row.get("yield_potential_t_ha", 2.0))
                            self._crops[c_id] = CropProfile(
                                crop_id=c_id,
                                crop_name=c_name,
                                category=category,
                                season=season,
                                water_need_mm=float(row.get("water_need_mm", 600.0)),
                                ideal_temp_min=float(row.get("temp_min_c", 15.0)),
                                ideal_temp_max=float(row.get("temp_max_c", 35.0)),
                                ideal_ph_min=float(row.get("ph_min", 6.0)),
                                ideal_ph_max=float(row.get("ph_max", 7.5)),
                                ideal_rainfall_min=float(row.get("rain_min_mm", 400.0)),
                                ideal_rainfall_max=float(row.get("rain_max_mm", 1200.0)),
                                baseline_yield_t_ha=QuantileValue(
                                    p10=round(yp * 0.7, 2),
                                    p50=round(yp, 2),
                                    p90=round(yp * 1.3, 2),
                                ),
                                data_confidence=str(row.get("data_confidence", "low")),
                                intercrop_options=[]
                            )
                    break
                except Exception:
                    pass

        # Attach companion intercrop options from intercrop_matrix.json
        matrix_candidates = [
            "backend/ml/data/processed/intercrop_matrix.json",
            "ml/data/processed/intercrop_matrix.json"
        ]
        matrix_data = {}
        for m_path in matrix_candidates:
            if os.path.exists(m_path):
                try:
                    with open(m_path, "r") as f:
                        raw_matrix = json.load(f)
                    from app.services.crops.crop_taxonomy import normalize_crop_id, get_crop_display_name
                    for raw_k, opts in raw_matrix.items():
                        c_k = normalize_crop_id(raw_k)
                        clean_opts = []
                        seen_c = set()
                        for opt in opts:
                            c_comp = normalize_crop_id(opt.get("companion_crop_id", ""))
                            if c_comp in seen_c or c_comp == c_k or c_comp == "unknown":
                                continue
                            seen_c.add(c_comp)
                            clean_opts.append(
                                IntercropOption(
                                    companion_crop_id=c_comp,
                                    companion_crop_name=get_crop_display_name(c_comp),
                                    yield_boost_pct=float(opt.get("yield_boost_pct", 0.15)),
                                    companion_share_factor=float(opt.get("companion_share_factor", 0.25)),
                                    rationale=str(opt.get("rationale", f"Companion intercropping with {get_crop_display_name(c_comp)} optimizes nitrogen and canopy use."))
                                )
                            )
                        matrix_data[c_k] = clean_opts
                    break
                except Exception:
                    pass

        for crop_id, profile in self._crops.items():
            opts = matrix_data.get(crop_id, [])
            if opts:
                profile.intercrop_options = opts
                profile.intercrop_data_available = True
                profile.sole_crop_rationale = None
            elif crop_id in GENUINE_SOLE_CROPS:
                profile.intercrop_options = []
                profile.intercrop_data_available = True
                profile.sole_crop_rationale = GENUINE_SOLE_CROPS[crop_id]
            else:
                profile.intercrop_options = []
                profile.intercrop_data_available = False
                profile.sole_crop_rationale = "Companion data not yet available for this crop."


# Default global registry instance
_registry_instance: CropRegistry | None = None

def get_crop_registry() -> CropRegistry:
    global _registry_instance
    if _registry_instance is None:
        json_path = "backend/ml/data/processed/crop_registry.json"
        _registry_instance = CropRegistry(json_path if os.path.exists(json_path) else None)
    return _registry_instance
