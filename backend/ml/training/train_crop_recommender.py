from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

BASE_DIR = Path(__file__).resolve().parent
PROCESSED_DIR = BASE_DIR.parent / "data" / "processed"
MODELS_DIR = BASE_DIR.parent / "models"

MODELS_DIR.mkdir(parents=True, exist_ok=True)

DATA_PATH = PROCESSED_DIR / "crop_recommendation_best.csv"
MODEL_PATH = MODELS_DIR / "crop_recommender.pkl"
META_PATH = MODELS_DIR / "crop_recommender_meta.pkl"


def main():
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            "crop_recommendation_best.csv not found. "
            "Run build_best_datasets.py first."
        )

    df = pd.read_csv(DATA_PATH)

    features = [
        "N",
        "P",
        "K",
        "temperature",
        "humidity",
        "ph",
        "rainfall",
    ]

    X = df[features]
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=18,
        random_state=42,
        n_jobs=-1,
    )

    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)

    print("Crop Recommendation Model Training")
    print(f"Accuracy: {accuracy * 100:.2f}%")

    joblib.dump(model, MODEL_PATH)

    joblib.dump(
        {
            "features": features,
            "classes": model.classes_.tolist(),
        },
        META_PATH,
    )

    print(f"Model saved: {MODEL_PATH}")
    print(f"Metadata saved: {META_PATH}")


if __name__ == "__main__":
    main()