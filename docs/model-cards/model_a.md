# Model Card: Model A – Land Suitability

- **Objective**: Evaluates physical land suitability grade (High, Moderate, Low, Not Suitable) and limiting factor diagnostics.
- **Inputs**: Soil pH, organic carbon, slope, elevation, TWI, NDVI, NDWI.
- **Outputs**: Suitability grade, confidence (0-1), list of limiting factors.
- **Fallback**: Simple NDVI + slope + pH threshold rules.
