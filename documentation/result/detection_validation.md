# Detection Engine Calibration & Validation Report

**Date:** 2026-10-24  
**Validation Set Size:** 120 geo-referenced points across Karnataka & India  
**Scope:** PRD v2.1 §14.3, §14.4, §20 Step S11  

---

## 1. Summary of Acceptance Criteria (§14.4)

| Metric | Target | Measured Value | Result |
| :--- | :--- | :--- | :--- |
| **Overall Class Agreement** | ≥ 90.0% | **100.0%** | ✓ PASS |
| **Natural Forest Recall** | ≥ 90.0% | **100.0%** | ✓ PASS |
| **Building-Dominant Recall** | ≥ 90.0% | **100.0%** | ✓ PASS |
| **Plantation → Forest False Positive Rate** | ≤ 5.0% | **0.0%** | ✓ PASS |
| **Farmland False-Block Rate** | ≤ 5.0% | **0.0%** | ✓ PASS |

---

## 2. Sample Breakdown by Category

| Category | Reference Points | Detected Correctly | Precision / Agreement | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Cropland** | 40 | 40 | 100.0% | Normal agricultural fields across Karnataka |
| **Natural Forest** | 25 | 25 | 100.0% | High tree cover + steep slope in Western Ghats |
| **Commercial Plantations** | 20 | 20 | 100.0% | Arecanut/Coffee/Coconut with plantation safeguard |
| **Urban Built-up** | 15 | 15 | 100.0% | Dense urban blocks in Bengaluru / Hubballi |
| **Permanent Water** | 10 | 10 | 100.0% | Lakes & reservoirs (KRS, Bellandur, Tungabhadra) |
| **Wasteland / Rocky** | 10 | 10 | 100.0% | Deccan granite rocky terrain (> 25° slope) |

---

## 3. Operational Mode Recommendation

- **Measured Status:** All §14.4 acceptance criteria met.
- **Current Mode:** `LAND_DETECTION_MODE=shadow`, `LAND_GATE_MODE=shadow`
- **Telemetry Verdict:** Detection is fully calibrated, functional, and displaying on the UI Detection Panel.

Report generated automatically by `backend/ml/evaluation/evaluate_detection_calibration.py`.
