"""
Canonical Crop Taxonomy & Explicit ID Mapping Table for GeoAgri AI.
Guarantees ONE unified canonical crop_id taxonomy across all raw, processed, and model files.
"""

from __future__ import annotations
import json
import os
import re
from pathlib import Path
from typing import Dict, Any

# Core 22 ML Recommendation Crops with complete empirical statistical grounding (confidence = "high")
CORE_22_RECOMMENDATION_CROPS = {
    "apple",
    "banana",
    "black_gram",
    "chickpea",
    "coconut",
    "coffee",
    "cotton",
    "grapes",
    "jute",
    "kidney_bean",
    "lentil",
    "maize",
    "mango",
    "moth_bean",
    "green_gram",
    "muskmelon",
    "orange",
    "papaya",
    "pigeon_pea",
    "pomegranate",
    "rice",
    "watermelon",
}

# Explicit ID Mapping Table: maps raw tokens, legacy names, synonyms, and variations
# to exactly ONE canonical crop_id.
RAW_TO_CANONICAL_MAP: dict[str, str] = {
    # 22 Core ML Recommendation Crops
    "rice": "rice",
    "paddy": "rice",
    "maize": "maize",
    "corn": "maize",
    "chickpea": "chickpea",
    "gram": "chickpea",
    "bengal gram": "chickpea",
    "bengal_gram": "chickpea",
    "kidneybeans": "kidney_bean",
    "kidney_bean": "kidney_bean",
    "kidney_beans": "kidney_bean",
    "kidney bean": "kidney_bean",
    "pigeonpeas": "pigeon_pea",
    "pigeon_pea": "pigeon_pea",
    "pigeon_peas": "pigeon_pea",
    "pigeon pea": "pigeon_pea",
    "arhar": "pigeon_pea",
    "tur": "pigeon_pea",
    "red gram": "pigeon_pea",
    "red_gram": "pigeon_pea",
    "mothbeans": "moth_bean",
    "moth_bean": "moth_bean",
    "moth_beans": "moth_bean",
    "moth bean": "moth_bean",
    "moth": "moth_bean",
    "mungbean": "green_gram",
    "mung_bean": "green_gram",
    "greengram": "green_gram",
    "green gram": "green_gram",
    "green_gram": "green_gram",
    "moong": "green_gram",
    "blackgram": "black_gram",
    "black_gram": "black_gram",
    "black gram": "black_gram",
    "urad": "black_gram",
    "lentil": "lentil",
    "masoor": "lentil",
    "pomegranate": "pomegranate",
    "banana": "banana",
    "mango": "mango",
    "grapes": "grapes",
    "grape": "grapes",
    "watermelon": "watermelon",
    "muskmelon": "muskmelon",
    "apple": "apple",
    "orange": "orange",
    "citrus": "orange",
    "papaya": "papaya",
    "coconut": "coconut",
    "cotton": "cotton",
    "jute": "jute",
    "coffee": "coffee",

    # Companion Crops & Additional Agricultural Crops
    "barley": "barley",
    "clover": "clover",
    "berseem": "clover",
    "berseem_clover": "clover",
    "egyptian clover": "clover",
    "cowpea": "cowpea",
    "lobia": "cowpea",
    "groundnut": "groundnut",
    "peanut": "groundnut",
    "linseed": "linseed",
    "flax": "linseed",
    "flaxseed": "linseed",
    "mustard": "mustard",
    "rapeseed": "mustard",
    "rapeseed_mustard": "mustard",
    "mustard & rapeseed": "mustard",
    "pea": "pea",
    "peas": "pea",
    "field pea": "pea",
    "field_pea": "pea",
    "sesame": "sesame",
    "sesamum": "sesame",
    "til": "sesame",
    "sorghum": "sorghum",
    "jowar": "sorghum",
    "millet": "pearl_millet",
    "pearl_millet": "pearl_millet",
    "pearl millet": "pearl_millet",
    "bajra": "pearl_millet",
    "finger_millet": "finger_millet",
    "finger millet": "finger_millet",
    "ragi": "finger_millet",
    "small_millets": "small_millets",
    "small millets": "small_millets",
    "foxtail_millet": "foxtail_millet",
    "kodo_millet": "kodo_millet",
    "little_millet": "little_millet",
    "proso_millet": "proso_millet",
    "barnyard_millet": "barnyard_millet",
    "browntop_millet": "browntop_millet",
    "wheat": "wheat",
    "durum_wheat": "durum_wheat",
    "green manure": "green_manure",
    "green_manure": "green_manure",
    "soybean": "soybean",
    "soya bean": "soybean",
    "sunflower": "sunflower",
    "safflower": "safflower",
    "kusum": "safflower",
    "castor": "castor",
    "castor seed": "castor",
    "niger": "niger_seed",
    "niger_seed": "niger_seed",
    "niger seed": "niger_seed",
    "ramtil": "niger_seed",
    "sugarcane": "sugarcane",
    "tobacco": "tobacco",
    "tea": "tea",
    "rubber": "rubber",
    "arecanut": "arecanut",
    "cashew": "cashew",
    "potato": "potato",
    "onion": "onion",
    "tomato": "tomato",
    "brinjal": "eggplant",
    "eggplant": "eggplant",
    "cabbage": "cabbage",
    "cauliflower": "cauliflower",
    "okra": "okra",
    "bhindi": "okra",
    "chilli": "chilli",
    "green chilli": "chilli",
    "garlic": "garlic",
    "ginger": "ginger",
    "guava": "guava",
    "turmeric": "turmeric",
    "coriander": "coriander",
    "cumin": "cumin",
    "jeera": "cumin",
    "cardamom": "cardamom",
    "black pepper": "black_pepper",
    "black_pepper": "black_pepper",
    "cluster_bean": "cluster_bean",
    "cluster bean": "cluster_bean",
    "guar": "cluster_bean",
    "fava_bean": "fava_bean",
    "fava bean": "fava_bean",
    "broad bean": "fava_bean",
    "broad_bean": "fava_bean",
    "horse_gram": "horse_gram",
    "horse gram": "horse_gram",
    "kulthi": "horse_gram",
    "almond": "almond",
    "olive": "olive",
    "pistachio": "pistachio",
    "walnut": "walnut",
    "cassava": "cassava",
    "lemon": "lemon",
    "sweet_lime": "sweet_lime",
    "pineapple": "pineapple",
    "litchi": "litchi",
    "custard_apple": "custard_apple",
    "sapota": "sapota",
    "amla": "amla",
    "jackfruit": "jackfruit",
    "fig": "fig",
    "dates": "dates",
    "carrot": "carrot",
    "radish": "radish",
    "beetroot": "beetroot",
    "spinach": "spinach",
    "fenugreek": "fenugreek",
    "cucumber": "cucumber",
    "pumpkin": "pumpkin",
    "bottle_gourd": "bottle_gourd",
    "bitter_gourd": "bitter_gourd",
    "capsicum": "capsicum",
    "mint": "mint",
    "oats": "oats",
    "rye": "rye",
    "triticale": "triticale",
    "mesta": "mesta",
    "oil_palm": "oil_palm",
    "jatropha": "jatropha",
    "camelina": "camelina",
    "lucerne": "lucerne",
    "napier_grass": "napier_grass",
    "guinea_grass": "guinea_grass",
    "maize_fodder": "maize_fodder",
    "sorghum_fodder": "sorghum_fodder",
    "fennel": "fennel",
    "isabgol": "isabgol",
    "aloe_vera": "aloe_vera",
    "lemongrass": "lemongrass",
    "mentha": "mentha",
    "ashwagandha": "ashwagandha",
    "stevia": "stevia",
    "basil": "basil",
    "adzuki_bean": "adzuki_bean",
}

# Display names for canonical crops
CANONICAL_DISPLAY_NAMES: dict[str, str] = {
    "apple": "Apple",
    "banana": "Banana",
    "black_gram": "Black Gram (Urad)",
    "chickpea": "Chickpea (Gram)",
    "coconut": "Coconut",
    "coffee": "Coffee",
    "cotton": "Cotton",
    "grapes": "Grapes",
    "jute": "Jute",
    "kidney_bean": "Kidney Bean (Rajma)",
    "lentil": "Lentil (Masoor)",
    "maize": "Maize",
    "mango": "Mango",
    "moth_bean": "Moth Bean",
    "green_gram": "Green Gram (Moong)",
    "muskmelon": "Muskmelon",
    "orange": "Orange",
    "papaya": "Papaya",
    "pigeon_pea": "Pigeon Pea (Arhar/Tur)",
    "pomegranate": "Pomegranate",
    "rice": "Rice",
    "watermelon": "Watermelon",
    "barley": "Barley",
    "clover": "Berseem Clover",
    "cowpea": "Cowpea (Lobia)",
    "green_manure": "Green Manure",
    "groundnut": "Groundnut (Peanut)",
    "linseed": "Linseed (Flaxseed)",
    "mustard": "Mustard",
    "pea": "Field Pea",
    "sesame": "Sesame (Til)",
    "sorghum": "Sorghum (Jowar)",
    "pearl_millet": "Pearl Millet (Bajra)",
    "finger_millet": "Finger Millet (Ragi)",
    "small_millets": "Small Millets",
    "wheat": "Wheat",
    "durum_wheat": "Durum Wheat",
    "soybean": "Soybean",
    "sunflower": "Sunflower",
    "safflower": "Safflower (Kusum)",
    "castor": "Castor Seed",
    "niger_seed": "Niger Seed",
    "sugarcane": "Sugarcane",
    "tobacco": "Tobacco",
    "tea": "Tea",
    "rubber": "Rubber",
    "arecanut": "Arecanut",
    "cashew": "Cashew",
    "potato": "Potato",
    "onion": "Onion",
    "tomato": "Tomato",
    "eggplant": "Eggplant (Brinjal)",
    "cabbage": "Cabbage",
    "cauliflower": "Cauliflower",
    "okra": "Okra (Bhindi)",
    "chilli": "Chilli",
    "garlic": "Garlic",
    "ginger": "Ginger",
    "guava": "Guava",
    "turmeric": "Turmeric",
    "coriander": "Coriander",
    "cumin": "Cumin (Jeera)",
    "cardamom": "Cardamom",
    "black_pepper": "Black Pepper",
    "cluster_bean": "Cluster Bean (Guar)",
    "fava_bean": "Fava Bean (Broad Bean)",
    "horse_gram": "Horse Gram (Kulthi)",
    "almond": "Almond",
    "olive": "Olive",
    "pistachio": "Pistachio",
    "walnut": "Walnut",
    "cassava": "Cassava",
}


def normalize_crop_id(value: Any) -> str:
    """
    Normalizes any crop token/name to the single canonical crop_id.
    Handles capitalization, punctuation, dashes, spaces, and synonyms.
    """
    if value is None:
        return "unknown"

    raw = str(value).strip().lower()
    raw = raw.replace('"', "").replace("'", "")
    raw = raw.replace("-", "_").replace("&", "_")

    while "__" in raw:
        raw = raw.replace("__", "_")
    raw = raw.strip("_")

    if not raw:
        return "unknown"

    # Direct match in mapping
    if raw in RAW_TO_CANONICAL_MAP:
        return RAW_TO_CANONICAL_MAP[raw]

    # Try space-separated version
    space_ver = raw.replace("_", " ")
    if space_ver in RAW_TO_CANONICAL_MAP:
        return RAW_TO_CANONICAL_MAP[space_ver]

    # If it's already a clean slug matching canonical set
    clean_slug = re.sub(r"[^a-z0-9]+", "_", raw).strip("_")
    if clean_slug in RAW_TO_CANONICAL_MAP:
        return RAW_TO_CANONICAL_MAP[clean_slug]

    return clean_slug


def get_crop_display_name(crop_id: str) -> str:
    """Returns human-readable display name for canonical crop_id."""
    canonical = normalize_crop_id(crop_id)
    if canonical in CANONICAL_DISPLAY_NAMES:
        return CANONICAL_DISPLAY_NAMES[canonical]
    return canonical.replace("_", " ").title()


def save_mapping_table(output_path: str | Path):
    """Exports explicit ID mapping table as a JSON artifact."""
    p = Path(output_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(
            {
                "canonical_crops_count": len(set(RAW_TO_CANONICAL_MAP.values())),
                "core_22_ml_crops": sorted(CORE_22_RECOMMENDATION_CROPS),
                "mappings": dict(sorted(RAW_TO_CANONICAL_MAP.items())),
            },
            f,
            indent=2,
        )
