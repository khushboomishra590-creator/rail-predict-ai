"""
SIH26028 - Railway Dynamic ETA Prediction
Step 7: Dynamic ETA Engine — Demo Simulation
Member 1 - ML/ETA Prediction Component

Demonstrates:
  1. Verify all existing ML functions (Step 5 + 6) are intact
  2. Single next-station ETA with explanation
  3. Multi-station route ETA (4 stops)
  4. Dynamic update — current_delay increase
  5. Dynamic update — preceding_train_delay (network condition) change
  6. Model file integrity check (timestamps + sizes unchanged)
"""

import pathlib
import sys
from datetime import datetime

import pandas as pd

# ── Path setup ────────────────────────────────────────────────────────────────
_HERE = pathlib.Path(__file__).parent
_ROOT = _HERE.parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

from scripts.predict import (
    predict_next_station_delay,
    get_prediction_with_uncertainty,
    explain_prediction,
    FEATURES,
)
from scripts.dynamic_eta import (
    calculate_next_station_eta,
    calculate_route_eta,
    update_train_prediction,
    format_eta_result,
    format_update_result,
    format_route_results,
)

DATA_PATH = _ROOT / "data" / "SIH26028_demo_railway_eta_dataset.csv"
SEP  = "=" * 65
SEP2 = "-" * 65


# ── Load demo dataset ─────────────────────────────────────────────────────────
df = pd.read_csv(DATA_PATH)

def row_to_state(idx: int) -> dict:
    """Convert a dataset row to a full state dict (ML features + display fields)."""
    row = df.iloc[idx]
    state = {f: row[f] for f in FEATURES}
    state["train_id"]        = row["train_id"]
    state["current_station"] = row["current_station"]
    state["next_station"]    = row["next_station"]
    state["date"]            = row["date"]
    return state


# ══════════════════════════════════════════════════════════════════════════════
# TEST 0 — Verify all existing ML functions are still intact
# ══════════════════════════════════════════════════════════════════════════════
def test_ml_functions():
    print(f"\n{SEP}")
    print("  TEST 0: Verify existing ML functions (Steps 5 & 6)")
    print(SEP)
    state = row_to_state(0)
    ml_input = {f: state[f] for f in FEATURES}

    # predict_next_station_delay
    p = predict_next_station_delay(ml_input)
    assert isinstance(p, float), "predict_next_station_delay must return float"
    print(f"  predict_next_station_delay()       → {p:.4f} min  ✅")

    # get_prediction_with_uncertainty
    u = get_prediction_with_uncertainty(ml_input)
    assert all(k in u for k in ["predicted_delay","lower_bound","upper_bound","uncertainty"])
    print(f"  get_prediction_with_uncertainty()  → delay={u['predicted_delay']:.4f}  "
          f"range=[{u['lower_bound']:.2f}, {u['upper_bound']:.2f}]  ✅")

    # explain_prediction
    e = explain_prediction(ml_input, top_n=3)
    assert "top_features" in e and len(e["top_features"]) == 3
    print(f"  explain_prediction()               → top feature: "
          f"'{e['top_features'][0]['feature']}'  ✅")
    print(SEP)


# ══════════════════════════════════════════════════════════════════════════════
# TEST 1 — Single next-station ETA with explanation
# ══════════════════════════════════════════════════════════════════════════════
def test_single_eta():
    print(f"\n{SEP}")
    print("  TEST 1: Single Next-Station ETA (dataset row 2 — high delay)")
    print(SEP)

    state        = row_to_state(2)
    actual_delay = float(df.iloc[2]["next_station_delay"])

    # Simulate current time from the dataset date + time_of_day
    current_time = datetime(2025, 11, 7, int(state["time_of_day"]), 0, 0)

    result = calculate_next_station_eta(
        current_time, state, include_explanation=True
    )

    print(format_eta_result(result, title="NEXT-STATION ETA — Train 12931"))
    print(f"\n  [VALIDATION] Actual next_station_delay in dataset : {actual_delay:.2f} min")
    print(f"  [VALIDATION] Predicted delay                      : {result['predicted_delay']:.4f} min")
    print(f"  [VALIDATION] Absolute error                       : {abs(actual_delay - result['predicted_delay']):.4f} min")
    in_band = result["lower_bound_delay"] <= actual_delay <= result["upper_bound_delay"]
    print(f"  [VALIDATION] Actual within ETA range?             : {'✅ YES' if in_band else '❌ NO'}")


# ══════════════════════════════════════════════════════════════════════════════
# TEST 2 — Multi-station route ETA (4 consecutive stops)
# ══════════════════════════════════════════════════════════════════════════════
def test_route_eta():
    print(f"\n{SEP}")
    print("  TEST 2: Multi-Station Route ETA (4 stops from dataset)")
    print(SEP)

    # Use 4 rows representing a plausible BRC/ADI corridor sequence
    # Rows 0, 1, 3, 5 — different sections and delays
    route_indices   = [0, 1, 3, 5]
    base_time       = datetime(2025, 9, 10, 15, 0, 0)   # 15:00 start

    route_data = []
    for i, idx in enumerate(route_indices):
        state = row_to_state(idx)
        # Set current_time: each stop starts at the previous predicted arrival
        # (we just stagger by index for demo; propagation handles delay forwarding)
        state["current_time"] = base_time
        route_data.append(state)

    results = calculate_route_eta(route_data)
    print(format_route_results(results))

    # Tabulate propagated delays
    print("  DELAY PROPAGATION DETAIL")
    print(SEP2)
    print(f"  {'Stop':<4}  {'Station':<18}  {'Input delay':>12}  {'Pred delay':>12}  {'Shift':>8}")
    print(SEP2)
    for r in results:
        shift = r["predicted_delay"] - r["propagated_delay"]
        print(f"  {r['stop_index']:<4}  {r['current_station']:<18}  "
              f"{r['propagated_delay']:>+11.2f}m  "
              f"{r['predicted_delay']:>+11.2f}m  "
              f"{shift:>+7.2f}m")
    print(SEP2)


# ══════════════════════════════════════════════════════════════════════════════
# TEST 3 — Dynamic update: current_delay increases mid-journey
# ══════════════════════════════════════════════════════════════════════════════
def test_dynamic_update_delay():
    print(f"\n{SEP}")
    print("  TEST 3: Dynamic Update — current_delay change")
    print("  Scenario: Train reports new delay at next signal check")
    print(SEP)

    # Use row 5: moderate delay, ADI section
    state        = row_to_state(5)
    current_time = datetime(2025, 2, 23, int(state["time_of_day"]), 0, 0)

    print(f"  Initial current_delay           : {state['current_delay']} min")
    print(f"  Updated current_delay           : 14.0 min  (new GPS report)")
    print()

    update_result = update_train_prediction(
        current_state = state,
        updates       = {"current_delay": 14.0},
        current_time  = current_time,
    )

    print(format_update_result(update_result))
    print(f"  Interpretation:")
    dd = update_result["delta_delay"]
    de = update_result["delta_eta_mins"]
    if dd > 0:
        print(f"  ➜  Delay increased by {dd:+.2f} min → train predicted to arrive "
              f"{de:+.2f} min later than originally forecast.")
    elif dd < 0:
        print(f"  ➜  Delay decreased by {dd:+.2f} min → train predicted to arrive "
              f"{de:+.2f} min earlier than originally forecast.")
    else:
        print("  ➜  No change in predicted delay.")


# ══════════════════════════════════════════════════════════════════════════════
# TEST 4 — Dynamic update: preceding_train_delay changes (network condition)
# ══════════════════════════════════════════════════════════════════════════════
def test_dynamic_update_network():
    print(f"\n{SEP}")
    print("  TEST 4: Dynamic Update — preceding_train_delay change (network signal)")
    print("  Scenario: Train ahead reports a new delay — does our model respond?")
    print(SEP)

    # Use row 4: BRC section, initial preceding_train_delay = 13.2
    state        = row_to_state(4)
    current_time = datetime(2025, 9, 21, int(state["time_of_day"]), 0, 0)

    original_ptd = state["preceding_train_delay"]
    new_ptd      = 0.5   # preceding train recovered — almost on schedule

    print(f"  Train                           : {state['train_id']}")
    print(f"  Section                         : {state['section']}")
    print(f"  preceding_train_delay (before)  : {original_ptd} min")
    print(f"  preceding_train_delay (after)   : {new_ptd} min  (preceding train recovered)")
    print()

    update_result = update_train_prediction(
        current_state = state,
        updates       = {"preceding_train_delay": new_ptd},
        current_time  = current_time,
    )

    print(format_update_result(update_result))
    dd = update_result["delta_delay"]
    de = update_result["delta_eta_mins"]
    print(f"  Interpretation:")
    if dd < 0:
        print(f"  ➜  Network condition improved: preceding train recovered.")
        print(f"     Network-aware model predicts {abs(dd):.2f} min less delay "
              f"→ ETA shifts by {de:+.2f} min.")
    elif dd > 0:
        print(f"  ➜  Network condition worsened: preceding train more delayed.")
        print(f"     Model predicts {dd:.2f} min additional delay → ETA shifts by {de:+.2f} min.")
    else:
        print("  ➜  Network change had no significant effect on this prediction.")

    print(f"\n  [KEY POINT] This response to preceding_train_delay is exactly what")
    print(f"  the Network-aware XGBoost (Step 4) adds over the plain XGBoost (Step 3).")
    print(f"  The three network features — preceding_train_delay, headway,")
    print(f"  distance_to_preceding_train — allow the model to react to upstream")
    print(f"  congestion without waiting for it to reach the current train.")


# ══════════════════════════════════════════════════════════════════════════════
# TEST 5 — Combined update: both current_delay AND preceding_train_delay change
# ══════════════════════════════════════════════════════════════════════════════
def test_dynamic_update_combined():
    print(f"\n{SEP}")
    print("  TEST 5: Dynamic Update — combined delay + network change")
    print("  Scenario: New GPS + signal report arrives simultaneously")
    print(SEP)

    state        = row_to_state(2)   # row 2: Mumbai Central → Vadodara, high delay
    current_time = datetime(2025, 11, 7, int(state["time_of_day"]), 0, 0)

    print(f"  Original current_delay          : {state['current_delay']} min")
    print(f"  Original preceding_train_delay  : {state['preceding_train_delay']} min")
    print(f"  Updated  current_delay          : 22.0 min")
    print(f"  Updated  preceding_train_delay  : 3.0 min  (preceding train recovered)")
    print()

    update_result = update_train_prediction(
        current_state = state,
        updates       = {
            "current_delay":          22.0,
            "preceding_train_delay":   3.0,
        },
        current_time = current_time,
    )

    print(format_update_result(update_result))


# ══════════════════════════════════════════════════════════════════════════════
# TEST 6 — Model file integrity check
# ══════════════════════════════════════════════════════════════════════════════
def test_model_integrity():
    import os
    print(f"\n{SEP}")
    print("  TEST 6: Model File Integrity")
    print(SEP)

    EXPECTED = {
        "network_xgb_model.pkl": {"size_kb": 492.1, "mtime": "12:44"},
        "xgb_model.pkl":         {"size_kb": 493.5, "mtime": "12:40"},
    }

    model_dir = _HERE
    all_ok = True
    for fname, expected in EXPECTED.items():
        path    = model_dir / fname
        size_kb = round(path.stat().st_size / 1024, 1)
        mtime   = datetime.fromtimestamp(os.path.getmtime(path)).strftime("%H:%M")
        match   = (size_kb == expected["size_kb"]) and (mtime == expected["mtime"])
        status  = "✅ UNTOUCHED" if match else "⚠ CHANGED"
        if not match:
            all_ok = False
        print(f"  {fname:<30}  {size_kb:>7.1f} KB   modified {mtime}   [{status}]")

    print(SEP2)
    if all_ok:
        print("  ✅ Both trained model files confirmed UNTOUCHED.")
    else:
        print("  ⚠  WARNING: One or more model files may have been modified.")
    print(SEP)


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print(f"\n{'#'*65}")
    print("  SIH26028 — Step 7: Dynamic ETA Engine — Full Demo")
    print(f"{'#'*65}")

    test_ml_functions()
    test_single_eta()
    test_route_eta()
    test_dynamic_update_delay()
    test_dynamic_update_network()
    test_dynamic_update_combined()
    test_model_integrity()

    print(f"\n{'#'*65}")
    print("  All Step 7 tests complete.")
    print(f"{'#'*65}\n")
