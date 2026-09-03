"""
Crop Name Normalization Service.
Maps diverse raw crop name spellings to standard slugs and display names.
"""

import re

CROP_NAME_MAP = {
    # Cereals & Millets
    "paddy": ("rice", "Rice"),
    "rice": ("rice", "Rice"),
    "wheat": ("wheat", "Wheat"),
    "maize": ("maize", "Maize"),
    "corn": ("maize", "Maize"),
    "jowar": ("sorghum", "Sorghum (Jowar)"),
    "sorghum": ("sorghum", "Sorghum (Jowar)"),
    "bajra": ("pearl_millet", "Pearl Millet (Bajra)"),
    "pearl millet": ("pearl_millet", "Pearl Millet (Bajra)"),
    "ragi": ("finger_millet", "Finger Millet (Ragi)"),
    "finger millet": ("finger_millet", "Finger Millet (Ragi)"),
    "barley": ("barley", "Barley"),
    "small millets": ("small_millets", "Small Millets"),

    # Pulses
    "chickpea": ("chickpea", "Chickpea (Gram)"),
    "gram": ("chickpea", "Chickpea (Gram)"),
    "bengal gram": ("chickpea", "Chickpea (Gram)"),
    "arhar": ("pigeon_pea", "Pigeon Pea (Red Gram/Arhar)"),
    "tur": ("pigeon_pea", "Pigeon Pea (Red Gram/Arhar)"),
    "pigeonpeas": ("pigeon_pea", "Pigeon Pea (Red Gram/Arhar)"),
    "pigeon pea": ("pigeon_pea", "Pigeon Pea (Red Gram/Arhar)"),
    "moong": ("green_gram", "Green Gram (Moong)"),
    "mungbean": ("green_gram", "Green Gram (Moong)"),
    "green gram": ("green_gram", "Green Gram (Moong)"),
    "urad": ("black_gram", "Black Gram (Urad)"),
    "blackgram": ("black_gram", "Black Gram (Urad)"),
    "black gram": ("black_gram", "Black Gram (Urad)"),
    "lentil": ("lentil", "Lentil (Masoor)"),
    "masoor": ("lentil", "Lentil (Masoor)"),
    "field pea": ("field_pea", "Field Pea"),
    "cowpea": ("cowpea", "Cowpea (Lobia)"),
    "moth": ("moth_bean", "Moth Bean"),
    "horse gram": ("horse_gram", "Horse Gram (Kulthi)"),

    # Oilseeds
    "groundnut": ("groundnut", "Groundnut (Peanut)"),
    "peanut": ("groundnut", "Groundnut (Peanut)"),
    "mustard": ("rapeseed_mustard", "Rapeseed & Mustard"),
    "rapeseed": ("rapeseed_mustard", "Rapeseed & Mustard"),
    "mustard & rapeseed": ("rapeseed_mustard", "Rapeseed & Mustard"),
    "soybean": ("soybean", "Soybean"),
    "soya bean": ("soybean", "Soybean"),
    "sunflower": ("sunflower", "Sunflower"),
    "sesamum": ("sesame", "Sesame (Til)"),
    "sesame": ("sesame", "Sesame (Til)"),
    "til": ("sesame", "Sesame (Til)"),
    "safflower": ("safflower", "Safflower (Kusum)"),
    "castor": ("castor", "Castor Seed"),
    "niger seed": ("niger_seed", "Niger Seed"),

    # Commercial & Cash Crops
    "cotton": ("cotton", "Cotton"),
    "sugarcane": ("sugarcane", "Sugarcane"),
    "jute": ("jute", "Jute"),
    "tobacco": ("tobacco", "Tobacco"),
    "tea": ("tea", "Tea"),
    "coffee": ("coffee", "Coffee"),
    "rubber": ("rubber", "Rubber"),
    "arecanut": ("arecanut", "Arecanut"),

    # Vegetables
    "potato": ("potato", "Potato"),
    "onion": ("onion", "Onion"),
    "tomato": ("tomato", "Tomato"),
    "brinjal": ("eggplant", "Eggplant (Brinjal)"),
    "eggplant": ("eggplant", "Eggplant (Brinjal)"),
    "cabbage": ("cabbage", "Cabbage"),
    "cauliflower": ("cauliflower", "Cauliflower"),
    "okra": ("okra", "Okra (Bhindi)"),
    "bhindi": ("okra", "Okra (Bhindi)"),
    "chilli": ("chilli", "Chilli"),
    "green chilli": ("chilli", "Chilli"),
    "garlic": ("garlic", "Garlic"),
    "ginger": ("ginger", "Ginger"),

    # Fruits
    "mango": ("mango", "Mango"),
    "banana": ("banana", "Banana"),
    "citrus": ("citrus", "Citrus (Orange/Lemon)"),
    "orange": ("citrus", "Citrus (Orange/Lemon)"),
    "apple": ("apple", "Apple"),
    "grapes": ("grapes", "Grapes"),
    "pomegranate": ("pomegranate", "Pomegranate"),
    "guava": ("guava", "Guava"),
    "papaya": ("papaya", "Papaya"),
    "watermelon": ("watermelon", "Watermelon"),
    "muskmelon": ("muskmelon", "Muskmelon"),
    "coconut": ("coconut", "Coconut"),

    # Spices
    "turmeric": ("turmeric", "Turmeric"),
    "coriander": ("coriander", "Coriander"),
    "cumin": ("cumin", "Cumin (Jeera)"),
    "cardamom": ("cardamom", "Cardamom"),
    "black pepper": ("black_pepper", "Black Pepper")
}

def normalize_crop_name(name: str) -> tuple[str, str]:
    """
    Normalizes a crop string into (slug, display_name).
    Fallback uses lowercase underscore slug.
    """
    clean_name = name.strip().lower()
    if clean_name in CROP_NAME_MAP:
        return CROP_NAME_MAP[clean_name]
    
    # Fallback slugification
    slug = re.sub(r'[^a-z0-9]+', '_', clean_name).strip('_')
    display = name.strip().title()
    return slug, display
