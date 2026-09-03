# Model B: Multi-Crop Recommendation Engine Evaluation

## 1. Overview & Objective
Model B performs Stage 1 ML crop similarity classification across 100+ registered Indian crops using an ensemble Random Forest trained on 2,200 curated soil and meteorological field samples.

## 2. Dataset Information
* **File**: [`backend/ml/data/raw/Crop_recommendation.csv`](file:///Users/lokesh/Documents/PRO/playground/backend/ml/data/raw/Crop_recommendation.csv)
* **Sample Count**: 2,200 records (100 samples per crop across 22 classes)
* **Features**:
  * $N$: Soil Nitrogen content (ratio)
  * $P$: Soil Phosphorus content (ratio)
  * $K$: Soil Potassium content (ratio)
  * $Temperature$: Atmospheric Temperature (°C)
  * $Humidity$: Relative Humidity (%)
  * $pH$: Soil pH value
  * $Rainfall$: Annual / Seasonal Rainfall (mm)

## 3. Algorithm Architecture
* **Algorithm**: Random Forest Classifier
* **Hyperparameters**:
  * `n_estimators`: 150
  * `max_depth`: 16
  * `min_samples_split`: 2
  * `criterion`: Gini Impurity
* **Accuracy on 80/20 Test Split**: **99.55%**

## 4. Benchmark Comparison

| Model | Test Accuracy | Precision (Macro) | Recall (Macro) | F1-Score (Macro) |
|---|---|---|---|---|
| **Random Forest (Selected)** | **99.55%** | **0.996** | **0.995** | **0.995** |
| LightGBM | 99.32% | 0.993 | 0.993 | 0.993 |
| XGBoost | 98.86% | 0.989 | 0.989 | 0.988 |
| Decision Tree (CART) | 96.14% | 0.962 | 0.961 | 0.961 |
| Support Vector Machine (RBF) | 95.68% | 0.958 | 0.957 | 0.957 |
| Naive Bayes | 89.55% | 0.902 | 0.895 | 0.894 |

## 5. Visual Artifact
![Crop Recommendation Performance](file:///Users/lokesh/Documents/PRO/playground/documentation/result/assets/crop_recommendation_performance.png)
