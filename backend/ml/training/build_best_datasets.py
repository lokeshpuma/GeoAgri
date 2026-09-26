import sys
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR.parent.parent))

from app.services.crops.crop_taxonomy import normalize_crop_id
RAW_DIR = BASE_DIR.parent / "data" / "raw"
PROCESSED_DIR = BASE_DIR.parent / "data" / "processed"
RULES_PATH = BASE_DIR.parent.parent / "app" / "rules" / "crop_rules_india.json"

PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

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
        "apple",
        "orange",
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
    return normalize_crop_id(value)


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

    # Read directly as CSV to avoid leaking column headers into rows
    df_raw = pd.read_csv(path)
    main_col = "main_crop" if "main_crop" in df_raw.columns else df_raw.columns[7]
    inter_col = "interm_crop" if "interm_crop" in df_raw.columns else df_raw.columns[8]

    df_raw["primary_crop"] = df_raw[main_col].apply(normalize_crop)
    df_raw["intercrop"] = df_raw[inter_col].apply(normalize_crop)

    # Drop any rows where primary is equal to intercrop or missing
    df_valid = df_raw[df_raw["primary_crop"] != df_raw["intercrop"]].dropna(
        subset=["primary_crop", "intercrop"]
    )

    df = (
        df_valid.groupby(["primary_crop", "intercrop"])
        .size()
        .reset_index(name="support")
        .sort_values(by=["support", "primary_crop", "intercrop"], ascending=[False, True, True])
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

    from app.services.crops.crop_taxonomy import get_crop_display_name

    for category, crop_list in EXTENDED_CROPS.items():
        defaults = CATEGORY_DEFAULTS.get(category, {})

        for raw_id in crop_list:
            crop_id = normalize_crop(raw_id)
            if crop_id in crops:
                continue

            crops[crop_id] = {
                "crop_id": crop_id,
                "crop_name": get_crop_display_name(crop_id),
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

    # Calculate real empirical statistical grounding from recommendation dataset
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
            emp_temp_min=("temperature", lambda x: round(float(x.quantile(0.05)), 1)),
            emp_temp_max=("temperature", lambda x: round(float(x.quantile(0.95)), 1)),
            emp_rain_min=("rainfall", lambda x: round(float(x.quantile(0.05)), 1)),
            emp_rain_max=("rainfall", lambda x: round(float(x.quantile(0.95)), 1)),
            emp_ph_min=("ph", lambda x: round(float(x.quantile(0.05)), 1)),
            emp_ph_max=("ph", lambda x: round(float(x.quantile(0.95)), 1)),
            emp_water_need=("rainfall", lambda x: round(float(x.mean()), 1)),
        )
        .reset_index()
        .rename(columns={"label": "crop_id"})
    )
    rec_profile["emp_confidence"] = "high"

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

    # Merge real statistics
    profile_df = profile_df.merge(
        rec_profile,
        on="crop_id",
        how="left",
    )

    # Ensure numerical columns are float before assignment
    float_cols = ["temp_min_c", "temp_max_c", "rain_min_mm", "rain_max_mm", "ph_min", "ph_max", "water_need_mm", "yield_potential_t_ha"]
    for col in float_cols:
        profile_df[col] = profile_df[col].astype(float)

    # For crops with real statistical grounding (the 22 in Crop_recommendation.csv):
    # Set data_confidence = high, and update envelope limits with empirical percentiles
    has_emp = profile_df["emp_confidence"] == "high"
    profile_df.loc[has_emp, "data_confidence"] = "high"
    profile_df.loc[has_emp, "temp_min_c"] = profile_df.loc[has_emp, "emp_temp_min"]
    profile_df.loc[has_emp, "temp_max_c"] = profile_df.loc[has_emp, "emp_temp_max"]
    profile_df.loc[has_emp, "rain_min_mm"] = profile_df.loc[has_emp, "emp_rain_min"]
    profile_df.loc[has_emp, "rain_max_mm"] = profile_df.loc[has_emp, "emp_rain_max"]
    profile_df.loc[has_emp, "ph_min"] = profile_df.loc[has_emp, "emp_ph_min"]
    profile_df.loc[has_emp, "ph_max"] = profile_df.loc[has_emp, "emp_ph_max"]
    profile_df.loc[has_emp, "water_need_mm"] = profile_df.loc[has_emp, "emp_water_need"]

    # For crops without empirical grounding:
    # Ensure avg_N/P/K/temp/hum/ph/rain are NaN (not copy-pasted/templated averages)
    # and data_confidence remains "low"
    profile_df.loc[~has_emp, "data_confidence"] = "low"
    profile_df.loc[~has_emp, "avg_N"] = float("nan")
    profile_df.loc[~has_emp, "avg_P"] = float("nan")
    profile_df.loc[~has_emp, "avg_K"] = float("nan")
    profile_df.loc[~has_emp, "avg_temperature_c"] = float("nan")
    profile_df.loc[~has_emp, "avg_humidity_pct"] = float("nan")
    profile_df.loc[~has_emp, "avg_ph"] = float("nan")
    profile_df.loc[~has_emp, "avg_rainfall_mm"] = float("nan")

    # Drop temporary emp columns
    emp_cols = [c for c in profile_df.columns if c.startswith("emp_")]
    profile_df = profile_df.drop(columns=emp_cols)

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

    # Round numerical averages to 2 decimals
    stat_cols = ["avg_N", "avg_P", "avg_K", "avg_temperature_c", "avg_humidity_pct", "avg_ph", "avg_rainfall_mm"]
    for c in stat_cols:
        profile_df[c] = profile_df[c].round(2)

    # Ensure crop_id is unique
    profile_df = profile_df.drop_duplicates(subset=["crop_id"]).reset_index(drop=True)

    output_path = PROCESSED_DIR / "crop_profile_best.csv"
    profile_df.to_csv(output_path, index=False)

    print(f"Saved crop profile dataset: {output_path}")
    print(f"Crop profiles: {len(profile_df)}")
    print(f"High-confidence crops: {(profile_df['data_confidence'] == 'high').sum()}")
    print(f"Low-confidence crops: {(profile_df['data_confidence'] == 'low').sum()}")


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