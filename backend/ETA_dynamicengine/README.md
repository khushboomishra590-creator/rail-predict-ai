# ETA Dynamic Engine

## M3 — Dynamic ETA Prediction Engine

This module implements the Dynamic ETA Engine for the railway ETA project.

The engine takes the current train state, timetable information, historical section behavior, and network conditions as input. It uses the trained XGBoost prediction model to estimate train delay and converts the prediction into station-level ETA information.

The current MVP also supports dynamic ETA updates and multi-station route ETA calculation.

> **Note:** The current MVP uses the provided SIH26028 demonstration dataset for integration and testing. It is not a live railway data feed.

---

## 1. M3 Responsibilities

M3 is responsible for the ETA intelligence layer of the project.

### M3 currently provides

- 15-feature ML input construction
- XGBoost delay prediction
- ETA calculation
- Predicted delay
- ETA uncertainty range
- Dynamic ETA updates when train state changes
- Multi-station route ETA
- M2 CSV data integration
- Batch model evaluation

M3 does **not** implement the HTTP/API layer. FastAPI integration is handled by M4.

---

## 2. Architecture

```text
M2 Train Data
      │
      ▼
CSV Data Adapter
      │
      ▼
ETA Input
      │
      ▼
Feature Builder
      │
      ▼
15 ML Features
      │
      ▼
XGBoost Model
      │
      ▼
Predicted Delay
      │
      ▼
ETA Service
      │
      ├──────────────► ETA + Uncertainty
      │
      ├──────────────► Dynamic ETA Update
      │
      └──────────────► Route ETA
                              │
                              ▼
                       Station-wise ETA