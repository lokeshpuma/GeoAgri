# Model Card: Model B – Multi-Crop Recommendation

- **Objective**: Stage 1 ML crop similarity scoring + Stage 2 agronomic rule filter across 100+ registered Indian crops.
- **Inputs**: 78-layer feature vector, target agricultural season.
- **Outputs**: Crop recommendation scores and suitability scores per crop.
- **Fallback**: Agronomic rule filter only (skip ML stage).
