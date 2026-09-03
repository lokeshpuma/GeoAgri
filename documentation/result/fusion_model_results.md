# Multi-Attribute Decision Fusion Engine & Results

## 1. The Core Agronomic Dilemma
In real-world farming, single-model recommenders cause critical failures:
* A crop with high yield potential (e.g., Sugarcane) will bankrupt a farmer if water balance (Model C) is negative.
* A crop perfectly matched to soil nutrients (Model B) will fail if heatwaves or seasonal frost (Model E) destroy the crop.

The **Multi-Attribute Decision Fusion Engine** solves this multi-objective Pareto optimization problem.

## 2. Mathematical Formulation

The fusion engine synthesizes predictions from all 5 models into a single normalized index:

$$\text{FusionScore} = w_1 \cdot \text{LandSuit} + w_2 \cdot \text{CropRec} - w_3 \cdot \text{IrrigCost}_{\text{norm}} + w_4 \cdot \text{Yield}_{\text{norm}} - w_5 \cdot \text{Risk}_{\text{norm}}$$

$$\text{FinalScore} = \text{clip}\left(\frac{\text{FusionScore} + 0.30}{1.05}, 0.0, 1.0\right)$$

### Default Weight Configurations:
* $w_1 = 0.20$ (Model A: Land Suitability)
* $w_2 = 0.25$ (Model B: Crop Agronomic Recommendation)
* $w_3 = 0.15$ (Model C: Irrigation Cost / Water Deficit)
* $w_4 = 0.25$ (Model D: Expected Yield Potential)
* $w_5 = 0.15$ (Model E: Climate & Weather Hazard Risk)

### Dynamic Weight Adaptations:
* **Rainfed / Water-Constrained Mode**: $w_3 \rightarrow 0.30$, $w_5 \rightarrow 0.20$, $w_4 \rightarrow 0.20$.
* **High-Input / Fully Irrigated Mode**: $w_3 \rightarrow 0.05$, $w_4 \rightarrow 0.35$.

## 3. Trade-Off Analysis Example

| Crop | Land Suit (A) | Crop Rec (B) | Water Need (C) | Median Yield (D) | Climate Risk (E) | **Fused Score** | **Decision Outcome** |
|---|---|---|---|---|---|---|---|
| **Sorghum (Jowar)** | 0.85 | 0.92 | Low (0.10) | 2.5 t/ha | Low (0.15) | **0.88 / 1.0** | **Rank 1: Top Recommended** |
| **Cotton** | 0.88 | 0.85 | Medium (0.50) | 2.1 t/ha | Medium (0.35) | **0.79 / 1.0** | **Rank 2: Viable with Caution** |
| **Rice (Paddy)** | 0.90 | 0.75 | Extreme (0.90) | 4.2 t/ha | High (0.60) | **0.64 / 1.0** | **Rank 3: Unfavorable in Dry Zone** |

## 4. Visual Artifact
![Decision Fusion Trade-off](file:///Users/lokesh/Documents/PRO/playground/documentation/result/assets/fusion_model_radar_tradeoff.png)
