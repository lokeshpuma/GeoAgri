import json
import re
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
RAW_DIR = BASE_DIR / "data" / "raw"
PROCESSED_DIR = BASE_DIR / "data" / "processed"
RULES_PATH = BASE_DIR.parent / "app" / "rules" / "crop_rules_india.json"

PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

CROP_SYNONYMS = {
    "pigeonpeas": "pigeon_pea",
    "mothbeans": "moth_bean",
    "kidneybeans": "kidney_bean",
    "mungbean": "mung_bean",
    "greengram": "green_gram",
    "blackgram": "black_gram",
    "green gram": "green_gram",
    "black gram": "black_gram",
    "green manure": "green_manure",
    "muskmelon": "muskmelon",
    "watermelon": "watermelon",
}

CATEGORY_DEFAULTS = {
    "cereal": {
        "temp_min_c": 15,
        "temp_max_c": 35,
        "rain_min_mm": 400,
        "rain_max_mm": 1200,
        "ph_min": 5.5,
        "ph_max": 7.5,
        "water_need_mm": 650,
        "yield_potential_t_ha": 3.0,
    },
    "pulse": {
        "temp_min_c": 12,
        "temp_max_c": 32,
        "rain_min_mm": 300,
        "rain_max_mm": 800,
        "ph_min": 6.0,
        "ph_max": 8.0,
        "water_need_mm": 450,
        "yield_potential_t_ha": 1.2,
    },
    "oilseed": {
        "temp_min_c": 15,
        "temp_max_c": 35,
        "rain_min_mm": 400,
        "rain_max_mm": 1000,
        "ph_min": 6.0,
        "ph_max": 8.0,
        "water_need_mm": 550,
        "yield_potential_t_ha": 1.5,
    },
    "vegetable": {
        "temp_min_c": 15,
        "temp_max_c": 33,
        "rain_min_mm": 500,
        "rain_max_mm": 900,
        "ph_min": 6.0,
        "ph_max": 7.5,
        "water_need_mm": 700,
        "yield_potential_t_ha": 20.0,
    },
    "fruit": {
        "temp_min_c": 10,
        "temp_max_c": 38,
        "rain_min_mm": 600,
        "rain_max_mm": 1500,
        "ph_min": 6.0,
        "ph_max": 8.0,
        "water_need_mm": 900,
        "yield_potential_t_ha": 15.0,
    },
    "plantation": {
        "temp_min_c": 20,
        "temp_max_c": 38,
        "rain_min_mm": 800,
        "rain_max_mm": 1800,
        "ph_min": 6.0,
        "ph_max": 8.0,
        "water_need_mm": 1000,
        "yield_potential_t_ha": 10.0,
    },
    "fodder": {
        "temp_min_c": 15,
        "temp_max_c": 35,
        "rain_min_mm": 400,
        "rain_max_mm": 1000,
        "ph_min": 6.0,
        "ph_max": 8.0,
        "water_need_mm": 600,
        "yield_potential_t_ha": 25.0,
    },
    "spice_medicinal": {
        "temp_min_c": 15,
        "temp_max_c": 35,
        "rain_min_mm": 500,
        "rain_max_mm": 1200,
        "ph_min": 6.0,
        "ph_max": 7.5,
        "water_need_mm": 700,
        "yield_potential_t_ha": 8.0,
    },
}

EXTENDED_CROPS = {
    "cereal": [
        "rice",
        "wheat",
        "maize",
        "sorghum",
        "pearl_millet",
        "finger_millet",
        "barley",
        "oats",
        "rye",
        "triticale",
        "foxtail_millet",
        "kodo_millet",
        "little_millet",
        "proso_millet",
        "barnyard_millet",
        "browntop_millet",
    ],
    "pulse": [
        "chickpea",
        "pigeon_pea",
        "green_gram",
        "black_gram",
        "lentil",
        "cowpea",
        "moth_bean",
        "mung_bean",
        "kidney_bean",
        "pea",
        "adzuki_bean",
        "broad_bean",
        "horse_gram",
        "guar",
        "cluster_bean",
        "soybean",
    ],
    "oilseed": [
        "groundnut",
        "mustard",
        "rapeseed",
        "sesame",
        "sunflower",
        "safflower",
        "castor",
        "linseed",
        "niger",
        "coconut",
        "oil_palm",
        "jatropha",
        "ramtil",
        "camelina",
    ],
    "vegetable": [
        "tomato",
        "potato",
        "onion",
        "brinjal",
        "cauliflower",
        "cabbage",
        "carrot",
        "radish",
        "beetroot",
        "bottle_gourd",
        "bitter_gourd",
        "cucumber",
        "pumpkin",
        "spinach",
        "fenugreek",
        "okra",
        "chilli",
        "capsicum",
        "coriander",
        "mint",
    ],
    "fruit": [
        "mango",
        "banana",
        "papaya",
        "guava",
        "lemon",
        "sweet_lime",
        "pomegranate",
        "grapes",
        "watermelon",
        "muskmelon",
        "pineapple",
        "litchi",
        "custard_apple",
        "sapota",
        "amla",
        "jackfruit",
        "fig",
        "dates",
    ],
    "plantation": [
        "sugarcane",
        "cotton",
        "jute",
        "mesta",
        "tea",
        "coffee",
        "rubber",
        "coconut",
        "arecanut",
        "cashew",
    ],
    "fodder": [
        "berseem",
        "lucerne",
        "napier_grass",
        "guinea_grass",
        "maize_fodder",
        "sorghum_fodder",
    ],
    "spice_medicinal": [
        "turmeric",
        "ginger",
        "garlic",
        "cumin",
        "fennel",
        "isabgol",
        "aloe_vera",
        "lemongrass",
        "mentha",
        "ashwagandha",
        "stevia",
        "basil",
    ],
}


def normalize_crop(value):
    if pd.isna(value):
        return "unknown"

    crop = str(value).strip().lower()
    crop = crop.replace('"', "")
    crop = crop.replace("'", "")

    if crop in CROP_SYNONYMS:
        crop = CROP_SYNONYMS[crop]

    crop = crop.replace(" ", "_")
    crop = crop.replace("&", "_")
    crop = crop.replace("-", "_")

    while "__" in crop:
        crop = crop.replace("__", "_")

    return crop.strip("_")


def first_line_has_header(path, keywords):
    if not path.exists():
        return False

    with path.open("r", encoding="utf-8", errors="ignore") as f:
        first_line = f.readline().lower()

    return any(keyword in first_line for keyword in keywords)


def build_recommendation_dataset():
    path = RAW_DIR / "Crop_recommendation.csv"

    if not path.exists():
        raise FileNotFoundError("Crop_recommendation.csv is missing")

    names = [
        "N",
        "P",
        "K",
        "temperature",
        "humidity",
        "ph",
        "rainfall",
        "label",
    ]

    keywords = ["temperature", "humidity", "rainfall", "label"]

    if first_line_has_header(path, keywords):
        df = pd.read_csv(path)
        df = df.iloc[:, :8]
        df.columns = names
    else:
        df = pd.read_csv(
            path,
            header=None,
            names=names,
            on_bad_lines="skip",
        )

    numeric_cols = [
        "N",
        "P",
        "K",
        "temperature",
        "humidity",
        "ph",
        "rainfall",
    ]

    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df["label"] = df["label"].apply(normalize_crop)

    df = df.dropna(subset=numeric_cols + ["label"])

    df = df[
        (df["N"] >= 0)
        & (df["N"] <= 300)
        & (df["P"] >= 0)
        & (df["P"] <= 300)
        & (df["K"] >= 0)
        & (df["K"] <= 300)
        & (df["temperature"] >= 0)
        & (df["temperature"] <= 50)
        & (df["humidity"] >= 5)
        & (df["humidity"] <= 100)
        & (df["ph"] >= 3)
        & (df["ph"] <= 10)
        & (df["rainfall"] >= 0)
        & (df["rainfall"] <= 3000)
    ]

    df = df.drop_duplicates()

    output_path = PROCESSED_DIR / "crop_recommendation_best.csv"
    df.to_csv(output_path, index=False)

    print(f"Saved recommendation dataset: {output_path}")
    print(f"Rows: {len(df)}")
    print(f"Crops: {df['label'].nunique()}")

    return df


def is_text_token(token):
    token = token.strip()

    if not token:
        return False

    try:
        float(token)
        return False
    except Exception:
        pass

    return bool(re.search("[a-zA-Z]", token))


def build_intercrop_dataset():
    path = RAW_DIR / "Crop_recommendation_with_intercrops.csv"

    if not path.exists():
        raise FileNotFoundError(
            "Crop_recommendation_with_intercrops.csv is missing"
        )

    pairs = []

    with path.open("r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            tokens = line.strip().split(",")

            text_tokens = [
                token.strip()
                for token in tokens
                if is_text_token(token)
            ]

            for i in range(0, len(text_tokens) - 1, 2):
                primary = normalize_crop(text_tokens[i])
                intercrop = normalize_crop(text_tokens[i + 1])

                if primary == intercrop:
                    continue

                pairs.append(
                    {
                        "primary_crop": primary,
                        "intercrop": intercrop,
                    }
                )

    df = pd.DataFrame(pairs)

    if df.empty:
        df = pd.DataFrame(
            columns=["primary_crop", "intercrop", "support"]
        )
    else:
        df = (
            df.groupby(["primary_crop", "intercrop"])
            .size()
            .reset_index(name="support")
            .sort_values("support", ascending=False)
        )

    output_path = PROCESSED_DIR / "intercrop_pairs_best.csv"
    df.to_csv(output_path, index=False)

    print(f"Saved intercrop dataset: {output_path}")
    print(f"Intercrop pairs: {len(df)}")

    return df


def build_yield_dataset():
    path = RAW_DIR / "Crop_yield.csv"

    if not path.exists():
        raise FileNotFoundError("Crop_yield.csv is missing")

    rows = []

    with path.open("r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            tokens = line.strip().split(",")

            if len(tokens) < 2:
                continue

            crop = normalize_crop(tokens[0])

            try:
                yield_value = float(tokens[-1])
            except Exception:
                continue

            rows.append(
                {
                    "crop": crop,
                    "yield_t_ha": yield_value,
                }
            )

    df = pd.DataFrame(rows)

    if df.empty:
        df = pd.DataFrame(columns=["crop", "yield_t_ha"])
    else:
        df = df[
            (df["yield_t_ha"] > 0)
            & (df["yield_t_ha"] <= 200)
        ]

    output_path = PROCESSED_DIR / "yield_best.csv"
    df.to_csv(output_path, index=False)

    print(f"Saved yield dataset: {output_path}")
    print(f"Yield rows: {len(df)}")
    print(f"Crops: {df['crop'].nunique()}")

    return df


def load_rules():
    if not RULES_PATH.exists():
        return []

    with RULES_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)

    return data.get("crops", [])


def build_extended_crop_profiles():
    crops = {}

    rules = load_rules()

    for rule in rules:
        crop_id = rule.get("crop_id")
        if not crop_id:
            continue

        crops[crop_id] = {
            "crop_id": crop_id,
            "crop_name": rule.get(
                "crop_name",
                crop_id.replace("_", " ").title(),
            ),
            "category": rule.get("category", "general"),
            "seasons": "|".join(rule.get("seasons", ["kharif"])),
            "temp_min_c": rule.get("temp_min_c", 15.0),
            "temp_max_c": rule.get("temp_max_c", 35.0),
            "rain_min_mm": rule.get("rain_min_mm", 400.0),
            "rain_max_mm": rule.get("rain_max_mm", 1200.0),
            "ph_min": rule.get("ph_min", 6.0),
            "ph_max": rule.get("ph_max", 7.5),
            "water_need_mm": rule.get("water_need_mm", 600.0),
            "yield_potential_t_ha": rule.get(
                "yield_potential_t_ha",
                2.0,
            ),
            "data_confidence": rule.get(
                "data_confidence",
                "medium",
            ),
        }

    for category, crop_list in EXTENDED_CROPS.items():
        defaults = CATEGORY_DEFAULTS.get(category, {})

        for crop_id in crop_list:
            if crop_id in crops:
                continue

            crops[crop_id] = {
                "crop_id": crop_id,
                "crop_name": crop_id.replace("_", " ").title(),
                "category": category,
                "seasons": "kharif|rabi",
                "temp_min_c": defaults.get("temp_min_c", 15.0),
                "temp_max_c": defaults.get("temp_max_c", 35.0),
                "rain_min_mm": defaults.get("rain_min_mm", 400.0),
                "rain_max_mm": defaults.get("rain_max_mm", 1200.0),
                "ph_min": defaults.get("ph_min", 6.0),
                "ph_max": defaults.get("ph_max", 7.5),
                "water_need_mm": defaults.get("water_need_mm", 600.0),
                "yield_potential_t_ha": defaults.get(
                    "yield_potential_t_ha",
                    2.0,
                ),
                "data_confidence": "low",
            }

    return pd.DataFrame(list(crops.values()))


def build_crop_profile(recommendation_df, intercrop_df, yield_df):
    profile_df = build_extended_crop_profiles()

    rec_profile = (
        recommendation_df.groupby("label")
        .agg(
            avg_N=("N", "mean"),
            avg_P=("P", "mean"),
            avg_K=("K", "mean"),
            avg_temperature_c=("temperature", "mean"),
            avg_humidity_pct=("humidity", "mean"),
            avg_ph=("ph", "mean"),
            avg_rainfall_mm=("rainfall", "mean"),
        )
        .reset_index()
        .rename(columns={"label": "crop_id"})
    )

    yield_profile = (
        yield_df.groupby("crop")
        .agg(
            yield_median_t_ha=("yield_t_ha", "median"),
        )
        .reset_index()
        .rename(columns={"crop": "crop_id"})
    )

    if not intercrop_df.empty:
        intercrop_profile = (
            intercrop_df.groupby("primary_crop")
            .agg(
                intercrop_partners=(
                    "intercrop",
                    lambda x: "|".join(list(x.head(5))),
                )
            )
            .reset_index()
            .rename(columns={"primary_crop": "crop_id"})
        )
    else:
        intercrop_profile = pd.DataFrame(
            columns=["crop_id", "intercrop_partners"]
        )

    profile_df = profile_df.merge(
        rec_profile,
        on="crop_id",
        how="left",
    )

    profile_df = profile_df.merge(
        yield_profile,
        on="crop_id",
        how="left",
    )

    profile_df = profile_df.merge(
        intercrop_profile,
        on="crop_id",
        how="left",
    )

    profile_df["intercrop_partners"] = profile_df[
        "intercrop_partners"
    ].fillna("")

    profile_df["yield_potential_t_ha"] = profile_df[
        "yield_median_t_ha"
    ].fillna(profile_df["yield_potential_t_ha"])

    output_path = PROCESSED_DIR / "crop_profile_best.csv"
    profile_df.to_csv(output_path, index=False)

    print(f"Saved crop profile dataset: {output_path}")
    print(f"Crop profiles: {len(profile_df)}")


if __name__ == "__main__":
    print("Building best datasets...")

    recommendation_df = build_recommendation_dataset()
    intercrop_df = build_intercrop_dataset()
    yield_df = build_yield_dataset()

    build_crop_profile(
        recommendation_df=recommendation_df,
        intercrop_df=intercrop_df,
        yield_df=yield_df,
    )

    print("Dataset preparation completed.")