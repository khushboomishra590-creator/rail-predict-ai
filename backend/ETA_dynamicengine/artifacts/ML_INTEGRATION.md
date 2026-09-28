# SIH26028 — ML Integration Contract

**Component:** ML / ETA Prediction (Member 1)  
**For:** Member 3 — Dynamic ETA Engine / Backend  
**Model:** Network-aware XGBoost (`model/network_xgb_model.pkl`)

---

## 1. Required Input Features

The prediction model requires exactly **15 features** in every call.

| # | Feature | Type | Unit | Description |
|---|---|---|---|---|
| 1 | `current_delay` | float | minutes | Delay at the current station vs schedule. Negative = early. |
| 2 | `current_speed` | float | km/h | Current operational speed of the train. |
| 3 | `distance_to_next_station` | float | km | Distance remaining to the next station. |
| 4 | `scheduled_remaining_time` | float | minutes | Timetabled travel time to next station. |
| 5 | `historical_section_median` | float | minutes | Median historical travel time for this section. |
| 6 | `historical_section_P90` | float | minutes | 90th-percentile historical travel time for this section. |
| 7 | `historical_dwell_median` | float | minutes | Median historical dwell time at the current station. |
| 8 | `historical_delay` | float | minutes | Typical historical delay for this train/section. |
| 9 | `historical_recovery` | float | minutes | Average delay recovery observed on this section. |
| 10 | `time_of_day` | int | hour (0–23) | Current hour. |
| 11 | `day_of_week` | int | 0=Mon…6=Sun | Day of week. |
| 12 | `section` | str | — | Route section ID. Must be one of the valid values below. |
| 13 | `preceding_train_delay` | float | minutes | Delay of the train immediately ahead on the same track. |
| 14 | `headway` | float | minutes | Time gap between this train and the preceding train. |
| 15 | `distance_to_preceding_train` | float | km | Physical distance to the preceding train. |

**Valid `section` values:**
```
'ADI_SECTION'  'AII_SECTION'  'BRC_SECTION'
'JP_SECTION'   'SBT_SECTION'  'ST_SECTION'
```

> `section` is passed as a **string**. The encoding is handled automatically inside `predict.py`.  
> Do **not** manually encode it before calling the prediction functions.

---

## 2. Prediction Function

```python
from model.predict import predict_next_station_delay

predicted_delay: float = predict_next_station_delay(input_dict)
# Returns: float (minutes). Negative = predicted early arrival.
```

---

## 3. Uncertainty Function

```python
from model.predict import get_prediction_with_uncertainty

result: dict = get_prediction_with_uncertainty(input_dict)

# result keys:
#   predicted_delay   – float, point prediction (minutes)
#   lower_bound       – float, predicted_delay - 5.0833 min
#   upper_bound       – float, predicted_delay + 5.0833 min
#   uncertainty       – float, 5.0833 min  (P90 empirical band)
#   uncertainty_note  – str, plain-language caveat
```

> ⚠ The uncertainty band is an **empirical prediction range** derived from
> the 90th-percentile absolute residual on 200 held-out test samples.
> It is **NOT** a statistically guaranteed confidence interval.

---

## 4. Explanation Function

```python
from model.predict import explain_prediction

explanation: dict = explain_prediction(input_dict, top_n=5)

# explanation keys:
#   predicted_delay   – float
#   top_features      – list of dicts, each with:
#                         feature, value, perturbation_impact,
#                         direction, plain_text
#   global_importance – dict {feature: gain_score}
#   method_note       – str describing the method used
```

> Use `plain_text` for human-readable display. Always label these as
> **"important predictive signals"** — never "causes of delay", because
> ML feature importance does not establish causation.

---

## 5. ETA Calculation Formula

```
scheduled_arrival = current_time + scheduled_remaining_time (minutes)
predicted_ETA     = scheduled_arrival + predicted_next_station_delay
```

For an ETA range:
```
eta_lower = scheduled_arrival + lower_bound_delay
eta_upper = scheduled_arrival + upper_bound_delay
```

### ⚠ Double-counting warning — READ THIS

`predicted_next_station_delay` is the **total** expected delay at the next station
relative to the timetable. It is **not** an incremental change.

**DO NOT** do this:
```python
# ❌ WRONG — double-counts current_delay
wrong_eta = current_time + scheduled_remaining_time + current_delay + predicted_delay
```

**DO** this:
```python
# ✅ CORRECT
scheduled_arrival = current_time + timedelta(minutes=scheduled_remaining_time)
predicted_eta     = scheduled_arrival + timedelta(minutes=predicted_delay)
```

Or equivalently, starting from current time only:
```python
# ✅ ALSO CORRECT (avoids double-counting current_delay)
adjustment = predicted_delay - current_delay
predicted_eta = current_time + timedelta(minutes=scheduled_remaining_time + adjustment)
```

---

## 6. Dynamic ETA Engine Functions

```python
from model.dynamic_eta import (
    calculate_next_station_eta,   # single stop
    calculate_route_eta,          # multi-stop route
    update_train_prediction,      # recalculate after state change
)
```

### Single stop
```python
result = calculate_next_station_eta(
    current_time = datetime(2025, 9, 10, 15, 0, 0),
    input_data   = input_dict,            # 15 ML features + optional display fields
    include_explanation = True,           # attach local feature explanation
)

# result keys:
#   train_id, current_station, next_station
#   current_time, scheduled_arrival
#   predicted_eta, eta_lower, eta_upper
#   predicted_delay, lower_bound_delay, upper_bound_delay, uncertainty_minutes
#   current_delay, delay_adjustment
#   uncertainty_note, explanation
```

### Dynamic update (recalculate after new data arrives)
```python
update_result = update_train_prediction(
    current_state = previous_input_dict,
    updates       = {"current_delay": 14.0, "preceding_train_delay": 2.0},
    current_time  = datetime.now(),
)

# update_result keys:
#   before          – full ETA result before update
#   after           – full ETA result after update
#   changed_fields  – {field: (old_value, new_value)}
#   delta_delay     – float, change in predicted delay (minutes)
#   delta_eta_mins  – float, ETA shift in minutes
```

### Multi-stop route
```python
route_results = calculate_route_eta(list_of_stop_dicts)
# Returns list of ETA results, one per stop.
# Predicted delay from stop N is automatically forwarded as current_delay to stop N+1.
```

---

## 7. Complete Example

```python
from datetime import datetime
from model.dynamic_eta import calculate_next_station_eta, update_train_prediction

input_dict = {
    # ML features
    "current_delay":               5.2,
    "current_speed":               72.0,
    "distance_to_next_station":    45.0,
    "scheduled_remaining_time":    38.0,
    "historical_section_median":   30.0,
    "historical_section_P90":      48.0,
    "historical_dwell_median":      3.0,
    "historical_delay":             4.5,
    "historical_recovery":          2.0,
    "time_of_day":                 14,
    "day_of_week":                  2,
    "section":                "BRC_SECTION",
    "preceding_train_delay":        3.0,
    "headway":                      7.5,
    "distance_to_preceding_train":  5.0,
    # Display fields (optional, not used by ML model)
    "train_id":        "12931",
    "current_station": "Surat",
    "next_station":    "Vadodara",
}

current_time = datetime(2025, 9, 10, 14, 30, 0)

# Initial ETA
result = calculate_next_station_eta(current_time, input_dict, include_explanation=True)
print(f"Predicted ETA : {result['predicted_eta']}")
print(f"ETA range     : [{result['eta_lower']} — {result['eta_upper']}]")
print(f"Predicted delay: {result['predicted_delay']:.2f} min")

# Dynamic update — new GPS report shows delay worsened
update = update_train_prediction(input_dict, {"current_delay": 9.0}, current_time)
print(f"ETA shifted by: {update['delta_eta_mins']:+.2f} min after delay update")
```

---

## 8. Performance Benchmarks

| Model | MAE | RMSE |
|---|---|---|
| Baseline (current_delay carry-forward) | 3.3816 min | 4.2393 min |
| XGBoost (Step 3, 12 features) | 2.6666 min | 3.3670 min |
| **Network XGBoost (Step 4, 15 features)** | **2.4873 min** | **3.1083 min** |

Uncertainty band (default): **± 5.0833 min** (P90 of test residuals)  
Covers ~90% of observed prediction errors on unseen data.

---

## 9. Assumptions (Demo / Synthetic Dataset)

- The dataset (`SIH26028_demo_railway_eta_dataset.csv`) is synthetic for SIH demo purposes.
- `section` has 6 unique values; in production this list may expand and the encoder must be retrained.
- `historical_*` features are pre-aggregated in the dataset. In production these would come from a historical database query at prediction time.
- `time_of_day` and `day_of_week` are integer-encoded. No further transformation needed.
- The multi-station route simulation propagates `predicted_delay` forward but does not model platform capacity, crew changes, or signal constraints. Those require operational railway logic beyond this ML component.

---

## 10. Files Reference

| File | Purpose |
|---|---|
| `model/predict.py` | Core prediction functions — **do not modify** |
| `model/dynamic_eta.py` | ETA engine wrapping predict.py |
| `model/network_xgb_model.pkl` | Trained Network XGBoost — **do not overwrite** |
| `model/xgb_model.pkl` | Trained plain XGBoost (Step 3) — **do not overwrite** |
| `model/label_encoder_section.pkl` | Section encoder — loaded automatically |
| `model/evaluation.py` | Baseline evaluation (Step 2) |
| `model/train.py` | Training script — Step 3 |
| `model/train_network.py` | Training script — Step 4 |
| `model/test_dynamic_eta.py` | Full demo simulation |
