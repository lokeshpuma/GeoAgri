# Model Card: Model C – Irrigation Feasibility

- **Objective**: Water balance calculation (crop water requirement vs effective precipitation + soil moisture contribution).
- **Inputs**: Crop $ET_0 \times K_c$ water need, seasonal rainfall, soil moisture.
- **Outputs**: Irrigation mode ("rainfed", "supplemental", "full"), water requirement (mm), deficit (mm).
- **Fallback**: Rainfall threshold rule.
