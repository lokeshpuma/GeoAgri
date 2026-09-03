"""
ML Training Pipeline for GeoAgri AI.
Trains specific algorithms on the raw datasets in backend/ml/data/raw:
1. Crop Recommendation Model: Multi-class Random Forest Classifier on Crop_recommendation.csv
2. Quantile Yield Regression Models: Gradient Boosting Quantile Regressors (P10, P50, P90) on Crop_yield.csv
Outputs trained model artifacts into backend/ml/models/
"""

import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, mean_absolute_error

from app.services.crops.normalization import normalize_crop_name

def train_crop_recommendation_model(raw_dir: str, models_dir: str):
    print("=" * 60)
    print("1. Training Crop Recommendation Classifier (Random Forest)")
    print("=" * 60)
    
    rec_path = os.path.join(raw_dir, "Crop_recommendation.csv")
    if not os.path.exists(rec_path):
        raise FileNotFoundError(f"Crop_recommendation.csv not found in {raw_dir}")

    df = pd.read_csv(rec_path)
    print(f"Loaded {len(df)} samples from {rec_path}")

    # Standardize crop label names to match normalized slugs
    df["slug"] = df["label"].apply(lambda x: normalize_crop_name(str(x))[0])
    
    feature_cols = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
    X = df[feature_cols].copy()
    y = df["slug"].copy()

    le = LabelEncoder()
    y_encoded = le.fit_transform(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
    )

    clf = RandomForestClassifier(
        n_estimators=150,
        max_depth=16,
        min_samples_split=2,
        random_state=42,
        n_jobs=-1
    )
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"Random Forest Accuracy on Test Set: {acc * 100:.2f}%")

    model_artifact = {
        "model": clf,
        "label_encoder": le,
        "classes": list(le.classes_),
        "feature_cols": feature_cols,
        "model_type": "RandomForestClassifier",
        "accuracy": float(acc)
    }

    out_file = os.path.join(models_dir, "crop_recommendation_model.joblib")
    os.makedirs(models_dir, exist_ok=True)
    joblib.dump(model_artifact, out_file)
    print(f"Saved Crop Recommendation Model artifact to: {out_file}\n")


def train_crop_yield_quantile_models(raw_dir: str, models_dir: str):
    print("=" * 60)
    print("2. Training Quantile Yield Predictors (Gradient Boosting Regressors)")
    print("=" * 60)

    yield_files = ["Crop_yield.csv", "crop_yield.csv", "Crop_yeild.csv"]
    yield_path = None
    for yf in yield_files:
        p = os.path.join(raw_dir, yf)
        if os.path.exists(p) and os.path.getsize(p) > 100:
            yield_path = p
            break
            
    if not yield_path:
        raise FileNotFoundError(f"Crop_yield.csv not found in {raw_dir}")

    df = pd.read_csv(yield_path)
    print(f"Loaded {len(df)} samples from {yield_path}")

    # Standardize column names
    col_map = {}
    for col in df.columns:
        c_lower = col.strip().lower()
        if c_lower in ["crop", "crop_name"]:
            col_map[col] = "crop"
        elif "yield" in c_lower:
            col_map[col] = "yield"
        elif "area" in c_lower:
            col_map[col] = "area"
        elif "rainfall" in c_lower:
            col_map[col] = "rainfall"
        elif c_lower == "temperature":
            col_map[col] = "temperature"
        elif c_lower == "humidity":
            col_map[col] = "humidity"
        elif c_lower == "n":
            col_map[col] = "n"
            
    df = df.rename(columns=col_map)
    df = df.dropna(subset=["crop", "yield"])
    df = df[df["yield"] > 0].copy()

    df["slug"] = df["crop"].apply(lambda x: normalize_crop_name(str(x))[0])

    crop_le = LabelEncoder()
    df["crop_code"] = crop_le.fit_transform(df["slug"])

    # Collect available numeric features
    candidate_features = ["crop_code"]
    for num_col in ["n", "temperature", "humidity", "rainfall", "area"]:
        if num_col in df.columns:
            df[num_col] = df[num_col].fillna(df[num_col].median())
            candidate_features.append(num_col)

    X = df[candidate_features].copy()
    y = df["yield"].copy()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.15, random_state=42
    )

    quantiles = [0.10, 0.50, 0.90]
    quantile_models = {}

    for q in quantiles:
        print(f"Training Quantile Regressor for q={q:.2f}...")
        gbr = GradientBoostingRegressor(
            loss="quantile",
            alpha=q,
            n_estimators=100,
            max_depth=4,
            learning_rate=0.08,
            random_state=42
        )
        gbr.fit(X_train, y_train)
        pred_test = gbr.predict(X_test)
        mae = mean_absolute_error(y_test, pred_test)
        print(f"  q={q:.2f} MAE on Test Set: {mae:.3f} t/ha")
        quantile_models[f"p{int(q*100)}"] = gbr

    # Compute empirical per-crop quantiles
    per_crop_stats = {}
    for slug, group in df.groupby("slug"):
        per_crop_stats[slug] = {
            "p10": float(np.percentile(group["yield"], 10)),
            "p50": float(np.percentile(group["yield"], 50)),
            "p90": float(np.percentile(group["yield"], 90)),
            "count": int(len(group))
        }

    artifact = {
        "models": quantile_models,
        "crop_encoder": crop_le,
        "feature_cols": candidate_features,
        "per_crop_stats": per_crop_stats,
        "quantiles": quantiles
    }

    out_file = os.path.join(models_dir, "crop_yield_quantile_models.joblib")
    joblib.dump(artifact, out_file)
    print(f"Saved Quantile Yield Model artifact to: {out_file}\n")


def run_all_training():
    raw_dir = "backend/ml/data/raw"
    models_dir = "backend/ml/models"
    processed_dir = "backend/ml/data/processed"

    from preprocess import preprocess_and_compile

    # Step 1: Preprocess raw data & compile registry
    preprocess_and_compile(raw_dir, processed_dir)

    # Step 2: Train Model B Recommendation Classifier
    train_crop_recommendation_model(raw_dir, models_dir)

    # Step 3: Train Model D Quantile Yield Regressors
    train_crop_yield_quantile_models(raw_dir, models_dir)

    print("=" * 60)
    print("All ML models trained and artifacts generated successfully!")
    print("=" * 60)

if __name__ == "__main__":
    run_all_training()
