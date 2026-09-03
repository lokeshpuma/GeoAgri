"""
Generate representative datasets for GeoAgri AI training & offline pipelines.
Produces:
- Crop_recommendation.csv
- Crop_recommendation_with_intercrops.csv
- crop_yield.csv
- Crop_yeild.csv
- crop_production.csv (empty file for fallback testing)
"""

import os
import pandas as pd
import numpy as np

def generate_datasets(raw_dir: str):
    os.makedirs(raw_dir, exist_ok=True)
    np.random.seed(42)

    crops = [
        "rice", "maize", "chickpea", "pigeonpeas", "kidneybeans", "pomegranate",
        "banana", "mango", "grapes", "watermelon", "muskmelon", "apple",
        "orange", "papaya", "coconut", "cotton", "jute", "coffee",
        "blackgram", "lentil", "mothbeans", "mungbean"
    ]

    # 1. Crop_recommendation.csv
    rec_data = []
    crop_params = {
        "rice": (80, 40, 40, 24.0, 80.0, 6.5, 2000.0),
        "maize": (80, 40, 20, 22.0, 65.0, 6.2, 800.0),
        "chickpea": (40, 60, 80, 18.0, 40.0, 7.0, 450.0),
        "pigeonpeas": (20, 60, 20, 27.0, 50.0, 6.0, 700.0),
        "cotton": (120, 60, 60, 25.0, 70.0, 7.5, 900.0),
        "jute": (80, 40, 40, 28.0, 80.0, 6.8, 1600.0),
        "coffee": (100, 30, 30, 25.0, 60.0, 6.5, 1400.0),
        "coconut": (20, 30, 30, 27.0, 90.0, 5.8, 1800.0),
        "banana": (100, 75, 50, 27.0, 80.0, 6.0, 1500.0),
        "mango": (20, 20, 30, 32.0, 50.0, 6.0, 900.0),
        "pomegranate": (20, 20, 40, 22.0, 90.0, 6.5, 500.0),
        "blackgram": (40, 60, 20, 28.0, 65.0, 7.0, 600.0),
        "lentil": (20, 60, 20, 24.0, 60.0, 6.8, 450.0),
        "mungbean": (20, 40, 20, 28.0, 85.0, 6.7, 500.0),
        "watermelon": (100, 10, 50, 25.0, 85.0, 6.4, 500.0),
        "muskmelon": (100, 10, 50, 28.0, 90.0, 6.3, 250.0),
        "apple": (20, 120, 20, 22.0, 92.0, 5.9, 1100.0),
        "orange": (20, 10, 10, 23.0, 92.0, 7.0, 1100.0),
        "papaya": (50, 50, 50, 33.0, 92.0, 6.7, 1400.0),
        "grapes": (20, 130, 20, 23.0, 80.0, 6.0, 1000.0),
        "kidneybeans": (20, 60, 20, 20.0, 20.0, 5.7, 500.0),
        "mothbeans": (20, 40, 20, 28.0, 50.0, 7.2, 450.0),
    }

    for crop, (n, p, k, t, h, ph, r) in crop_params.items():
        for _ in range(50):
            rec_data.append({
                "N": max(0, int(n + np.random.normal(0, 10))),
                "P": max(0, int(p + np.random.normal(0, 8))),
                "K": max(0, int(k + np.random.normal(0, 8))),
                "temperature": round(t + np.random.normal(0, 2), 2),
                "humidity": min(100.0, max(10.0, round(h + np.random.normal(0, 5), 2))),
                "ph": min(14.0, max(0.0, round(ph + np.random.normal(0, 0.4), 2))),
                "rainfall": max(50.0, round(r + np.random.normal(0, 100), 2)),
                "label": crop
            })

    df_rec = pd.DataFrame(rec_data)
    df_rec.to_csv(os.path.join(raw_dir, "Crop_recommendation.csv"), index=False)

    # 2. Crop_recommendation_with_intercrops.csv
    intercrops = [
        {"main_crop": "maize", "intercrop": "pigeonpeas", "yield_boost_pct": 0.18, "companion_share": 0.25},
        {"main_crop": "maize", "intercrop": "groundnut", "yield_boost_pct": 0.15, "companion_share": 0.25},
        {"main_crop": "cotton", "intercrop": "blackgram", "yield_boost_pct": 0.12, "companion_share": 0.20},
        {"main_crop": "cotton", "intercrop": "green_gram", "yield_boost_pct": 0.14, "companion_share": 0.20},
        {"main_crop": "sugarcane", "intercrop": "potato", "yield_boost_pct": 0.20, "companion_share": 0.30},
        {"main_crop": "sugarcane", "intercrop": "onion", "yield_boost_pct": 0.16, "companion_share": 0.30},
        {"main_crop": "sorghum", "intercrop": "cowpea", "yield_boost_pct": 0.15, "companion_share": 0.25},
        {"main_crop": "pearl_millet", "intercrop": "moth_bean", "yield_boost_pct": 0.14, "companion_share": 0.25},
        {"main_crop": "wheat", "intercrop": "mustard", "yield_boost_pct": 0.10, "companion_share": 0.15},
        {"main_crop": "groundnut", "intercrop": "castor", "yield_boost_pct": 0.11, "companion_share": 0.20},
        {"main_crop": "pigeonpeas", "intercrop": "sorghum", "yield_boost_pct": 0.12, "companion_share": 0.25},
        {"main_crop": "soybean", "intercrop": "maize", "yield_boost_pct": 0.14, "companion_share": 0.25}
    ]
    df_inter = pd.DataFrame(intercrops)
    df_inter.to_csv(os.path.join(raw_dir, "Crop_recommendation_with_intercrops.csv"), index=False)

    # 3. crop_yield.csv
    states = ["Telangana", "Andhra Pradesh", "Maharashtra", "Karnataka", "Punjab", "Uttar Pradesh", "Madhya Pradesh", "Gujarat", "Tamil Nadu", "Rajasthan"]
    seasons = ["Kharif", "Rabi", "Whole Year"]
    yield_records = []

    crop_yield_base = {
        "Rice": (3.5, 0.8),
        "Maize": (3.6, 0.7),
        "Wheat": (3.8, 0.6),
        "Chickpea": (1.2, 0.3),
        "Groundnut": (1.8, 0.4),
        "Cotton": (2.1, 0.5),
        "Sugarcane": (70.0, 10.0),
        "Soybean": (1.4, 0.3),
        "Sorghum": (1.5, 0.3),
        "Pearl Millet": (1.3, 0.3),
        "Pigeonpeas": (0.9, 0.2),
        "Blackgram": (0.8, 0.2),
        "Green Gram": (0.7, 0.2),
        "Mustard": (1.4, 0.3),
        "Sunflower": (1.1, 0.3),
        "Potato": (22.0, 4.0),
        "Onion": (18.0, 3.0),
        "Tomato": (25.0, 5.0),
        "Banana": (45.0, 8.0),
        "Mango": (8.5, 2.0)
    }

    for year in range(2015, 2024):
        for state in states:
            for crop_name, (base_y, std_y) in crop_yield_base.items():
                season = "Kharif" if crop_name in ["Rice", "Maize", "Cotton", "Groundnut", "Soybean", "Pigeonpeas"] else ("Rabi" if crop_name in ["Wheat", "Chickpea", "Mustard"] else "Whole Year")
                area_ha = round(np.random.uniform(500, 50000), 2)
                yield_val = max(0.2, round(float(np.random.normal(base_y, std_y)), 2))
                production_t = round(area_ha * yield_val, 2)
                rainfall_mm = round(np.random.uniform(400, 2200), 2)

                yield_records.append({
                    "Crop": crop_name,
                    "Crop_Year": year,
                    "Season": season,
                    "State": state,
                    "Area": area_ha,
                    "Production": production_t,
                    "Rainfall": rainfall_mm,
                    "Yield": yield_val
                })

    df_yield = pd.DataFrame(yield_records)
    df_yield.to_csv(os.path.join(raw_dir, "crop_yield.csv"), index=False)

    # 4. Crop_yeild.csv (supplementary)
    df_yield.to_csv(os.path.join(raw_dir, "Crop_yeild.csv"), index=False)

    # 5. crop_production.csv (empty file for test guard)
    with open(os.path.join(raw_dir, "crop_production.csv"), "w") as f:
        pass

    print("Sample datasets successfully created in:", raw_dir)

if __name__ == "__main__":
    generate_datasets("backend/ml/data/raw")
