"""
SIH26028 - Railway Dynamic ETA Prediction
Step 7: Dynamic ETA Engine
Member 1 - ML/ETA Prediction Component

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PURPOSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This module wraps the trained Network-aware XGBoost model (network_xgb_model.pkl)
in a lightweight Dynamic ETA Engine.  It is NOT a real-time streaming
system — it is a prototype that demonstrates how predictions from the
ML model translate into human-readable arrival times and ETA ranges.

It does NOT:
  • retrain or modify any model
  • replace the ML prediction functions in model/predict.py
  • implement FastAPI, REST, WebSocket, database, or dashboard logic

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETA CALCULATION FORMULA  (⚠ read before integrating)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The ML model predicts:
    predicted_next_station_delay
        = expected delay (minutes) at the NEXT station relative to
          the timetable scheduled arrival there.

This is NOT an incremental delay on top of the current delay.
It is the total anticipated delay at the next station.

Therefore the correct formula when starting from current_time is:

    predicted_ETA = current_time
                    + scheduled_remaining_time       (minutes to next station on schedule)
                    + (predicted_next_station_delay  (total delay at next station)
                       - current_delay)              (delay already accumulated — avoid double-count)

Equivalently, via scheduled arrival time:

    scheduled_arrival = current_time + scheduled_remaining_time
    predicted_ETA     = scheduled_arrival + predicted_next_station_delay

Both formulations are identical.  The second is used in the code
because it is easier to audit.

⚠ DO NOT add current_delay + predicted_next_station_delay together
  without this adjustment — that double-counts the existing delay.

For ETA range:
    eta_lower = scheduled_arrival + lower_bound_delay
    eta_upper = scheduled_arrival + upper_bound_delay
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import pathlib
import sys
from datetime import datetime, timedelta
from typing import Any

import pandas as pd

# ── Import ML interface from predict.py (same package) ────────────────────────
_HERE = pathlib.Path(__file__).parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

from predict import (
    get_prediction_with_uncertainty,
    explain_prediction,
    predict_next_station_delay,
    FEATURES,
)

# ── Type alias for a feature dict ─────────────────────────────────────────────
TrainState = dict[str, Any]


# ══════════════════════════════════════════════════════════════════════════════
# CORE: Next-station ETA
# ══════════════════════════════════════════════════════════════════════════════

def calculate_next_station_eta(
    current_time: datetime,
    input_data: TrainState,
    include_explanation: bool = False,
) -> dict:
    """
    Calculate the predicted ETA at the next station for a single train state.

    Parameters
    ----------
    current_time : datetime
        The current clock time at the moment of prediction.
    input_data : dict
        All 15 ML features (see FEATURES in predict.py).
        May also include display-only fields:
            train_id, current_station, next_station, date
        Those are passed through to the result but NOT fed to the model.
    include_explanation : bool
        If True, attach the perturbation-based local feature explanation.

    Returns
    -------
    dict with keys:
        train_id              – str, if provided
        current_station       – str, if provided
        next_station          – str, if provided
        current_time          – ISO string
        scheduled_arrival     – ISO string  (current_time + scheduled_remaining_time)
        predicted_eta         – ISO string  (scheduled_arrival + predicted_delay)
        eta_lower             – ISO string  (scheduled_arrival + lower_bound)
        eta_upper             – ISO string  (scheduled_arrival + upper_bound)
        predicted_delay       – float, minutes
        lower_bound_delay     – float, minutes
        upper_bound_delay     – float, minutes
        uncertainty_minutes   – float, minutes (P90 band)
        current_delay         – float, minutes (from input)
        delay_adjustment      – float = predicted_delay - current_delay
        uncertainty_note      – str
        explanation           – dict or None
    """
    # Extract display-only fields (not ML features)
    train_id         = input_data.get("train_id",         "UNKNOWN")
    current_station  = input_data.get("current_station",  "UNKNOWN")
    next_station     = input_data.get("next_station",     "UNKNOWN")

    # Build the ML-only feature dict
    ml_input = {f: input_data[f] for f in FEATURES if f in input_data}

    # ── ML prediction ─────────────────────────────────────────────────────────
    pred_result       = get_prediction_with_uncertainty(ml_input)
    predicted_delay   = pred_result["predicted_delay"]
    lower_bound       = pred_result["lower_bound"]
    upper_bound       = pred_result["upper_bound"]
    uncertainty       = pred_result["uncertainty"]
    uncertainty_note  = pred_result["uncertainty_note"]

    # ── ETA calculation ───────────────────────────────────────────────────────
    sched_remaining   = float(input_data["scheduled_remaining_time"])
    current_delay_val = float(input_data["current_delay"])

    scheduled_arrival = current_time + timedelta(minutes=sched_remaining)
    predicted_eta     = scheduled_arrival + timedelta(minutes=predicted_delay)
    eta_lower         = scheduled_arrival + timedelta(minutes=lower_bound)
    eta_upper         = scheduled_arrival + timedelta(minutes=upper_bound)

    # delay_adjustment shows how much the delay is expected to change
    delay_adjustment  = round(predicted_delay - current_delay_val, 4)

    result = {
        "train_id":            str(train_id),
        "current_station":     str(current_station),
        "next_station":        str(next_station),
        "current_time":        current_time.strftime("%Y-%m-%d %H:%M:%S"),
        "scheduled_arrival":   scheduled_arrival.strftime("%Y-%m-%d %H:%M:%S"),
        "predicted_eta":       predicted_eta.strftime("%Y-%m-%d %H:%M:%S"),
        "eta_lower":           eta_lower.strftime("%Y-%m-%d %H:%M:%S"),
        "eta_upper":           eta_upper.strftime("%Y-%m-%d %H:%M:%S"),
        "predicted_delay":     round(predicted_delay, 4),
        "lower_bound_delay":   round(lower_bound, 4),
        "upper_bound_delay":   round(upper_bound, 4),
        "uncertainty_minutes": round(uncertainty, 4),
        "current_delay":       current_delay_val,
        "delay_adjustment":    delay_adjustment,
        "uncertainty_note":    uncertainty_note,
        "explanation":         None,
    }

    if include_explanation:
        result["explanation"] = explain_prediction(ml_input, top_n=5)

    return result


# ══════════════════════════════════════════════════════════════════════════════
# MULTI-STATION: Simulate sequential stops along a route
# ══════════════════════════════════════════════════════════════════════════════

def calculate_route_eta(route_data: list[dict]) -> list[dict]:
    """
    Predict ETAs for each upcoming station along a route in sequence.

    The function propagates state forward: the predicted delay at station N
    becomes the current_delay fed into the prediction for station N+1.
    This simulates how upstream delay propagates through the journey.

    ⚠  PROTOTYPE NOTE:
    Each stop in route_data must supply its own feature values
    (distance_to_next_station, section, historical_* etc.) drawn from
    the demo dataset.  In a production system these would come from a
    live data feed.  Here they are provided explicitly per stop.

    Parameters
    ----------
    route_data : list of dicts
        Each dict represents one upcoming station stop and must contain:
          - All 15 ML features
          - Optionally: train_id, current_station, next_station, current_time
        The stops are processed in order.

    Returns
    -------
    list of dicts
        One result per stop, matching the output of calculate_next_station_eta().
        Each result also carries:
            stop_index      – int, 0-based position in the route
            propagated_delay – float, the delay that was fed in from prior stop
    """
    results          = []
    propagated_delay = None   # updated after each stop

    for stop_idx, stop_data in enumerate(route_data):
        # Build a mutable copy so we can inject propagated delay
        state = dict(stop_data)

        # Determine current_time for this stop
        if "current_time" in state and isinstance(state["current_time"], datetime):
            current_time = state["current_time"]
        elif "current_time" in state:
            current_time = datetime.fromisoformat(str(state["current_time"]))
        else:
            current_time = datetime.now().replace(second=0, microsecond=0)

        # After the first stop, propagate predicted delay forward as current_delay
        if propagated_delay is not None:
            state["current_delay"] = round(propagated_delay, 4)

        eta_result = calculate_next_station_eta(current_time, state)

        eta_result["stop_index"]       = stop_idx
        eta_result["propagated_delay"] = state["current_delay"]
        results.append(eta_result)

        # Feed this stop's predicted delay forward to the next
        propagated_delay = eta_result["predicted_delay"]

        # Advance current_time to the predicted arrival for the next iteration
        predicted_eta_dt = datetime.strptime(
            eta_result["predicted_eta"], "%Y-%m-%d %H:%M:%S"
        )
        # Update current_time in next stop's data via closure — not needed
        # because each stop provides its own current_time; we just propagate delay.

    return results


# ══════════════════════════════════════════════════════════════════════════════
# DYNAMIC UPDATE: Recalculate ETA when train state changes
# ══════════════════════════════════════════════════════════════════════════════

def update_train_prediction(
    current_state: TrainState,
    updates: dict,
    current_time: datetime | None = None,
) -> dict:
    """
    Recalculate the ETA after one or more state values change.

    This is the "dynamic" core of the SIH26028 solution: when a new
    GPS/signal update arrives (delay change, speed change, network
    condition change), the full prediction is recomputed from scratch
    using the existing ML model.

    Parameters
    ----------
    current_state : dict
        The previous train state (all 15 ML features + optional display fields).
    updates : dict
        Fields that have changed.  Only changed keys are needed.
        e.g. {"current_delay": 9.0, "preceding_train_delay": 8.0}
    current_time : datetime, optional
        New observation time.  Defaults to now.

    Returns
    -------
    dict with keys:
        before          – ETA result computed from current_state
        after           – ETA result computed after applying updates
        changed_fields  – dict of {field: (old_value, new_value)}
        delta_delay     – float = after predicted_delay - before predicted_delay
        delta_eta_mins  – float = ETA shift in minutes (positive = later)
    """
    if current_time is None:
        current_time = datetime.now().replace(second=0, microsecond=0)

    # Compute BEFORE result
    before_result = calculate_next_station_eta(current_time, current_state,
                                               include_explanation=False)

    # Apply updates
    updated_state = dict(current_state)
    changed_fields: dict[str, tuple] = {}
    for field, new_val in updates.items():
        old_val = updated_state.get(field)
        updated_state[field] = new_val
        changed_fields[field] = (old_val, new_val)

    # Compute AFTER result
    after_result = calculate_next_station_eta(current_time, updated_state,
                                              include_explanation=False)

    # Compute deltas
    delta_delay    = round(
        after_result["predicted_delay"] - before_result["predicted_delay"], 4
    )
    before_eta_dt  = datetime.strptime(before_result["predicted_eta"],
                                       "%Y-%m-%d %H:%M:%S")
    after_eta_dt   = datetime.strptime(after_result["predicted_eta"],
                                       "%Y-%m-%d %H:%M:%S")
    delta_eta_mins = round(
        (after_eta_dt - before_eta_dt).total_seconds() / 60, 4
    )

    return {
        "before":         before_result,
        "after":          after_result,
        "changed_fields": changed_fields,
        "delta_delay":    delta_delay,
        "delta_eta_mins": delta_eta_mins,
    }


# ══════════════════════════════════════════════════════════════════════════════
# FORMATTING HELPERS  (used by test_dynamic_eta.py and future API layer)
# ══════════════════════════════════════════════════════════════════════════════

def format_eta_result(result: dict, title: str = "ETA RESULT") -> str:
    """Return a human-readable string summary of a calculate_next_station_eta result."""
    SEP  = "=" * 65
    SEP2 = "-" * 65
    lines = [
        f"\n{SEP}",
        f"  {title}",
        SEP,
        f"  Train          : {result['train_id']}",
        f"  {result['current_station']}  →  {result['next_station']}",
        SEP2,
        f"  Current time      : {result['current_time']}",
        f"  Scheduled arrival : {result['scheduled_arrival']}",
        f"  Predicted ETA     : {result['predicted_eta']}",
        f"  ETA range         : [{result['eta_lower']}",
        f"                       {result['eta_upper']}]",
        SEP2,
        f"  Current delay     : {result['current_delay']:>+.2f} min",
        f"  Predicted delay   : {result['predicted_delay']:>+.4f} min",
        f"  Delay adjustment  : {result['delay_adjustment']:>+.4f} min  "
        f"({'improving' if result['delay_adjustment'] < 0 else 'worsening' if result['delay_adjustment'] > 0 else 'stable'})",
        f"  Uncertainty band  : ± {result['uncertainty_minutes']:.4f} min  (P90 empirical range)",
    ]

    if result.get("explanation"):
        expl = result["explanation"]
        lines += [
            SEP2,
            "  IMPORTANT PREDICTIVE SIGNALS (local perturbation method)",
        ]
        for i, feat in enumerate(expl["top_features"], 1):
            lines.append(f"  {i}. {feat['plain_text']}")

    lines.append(SEP)
    return "\n".join(lines)


def format_update_result(update_result: dict) -> str:
    """Return a human-readable summary of an update_train_prediction result."""
    SEP  = "=" * 65
    SEP2 = "-" * 65
    b    = update_result["before"]
    a    = update_result["after"]
    dd   = update_result["delta_delay"]
    de   = update_result["delta_eta_mins"]

    lines = [
        f"\n{SEP}",
        "  DYNAMIC UPDATE RESULT",
        SEP,
        "  CHANGED FIELDS",
        SEP2,
    ]
    for field, (old, new) in update_result["changed_fields"].items():
        lines.append(f"  {field:<35}  {old}  →  {new}")
    lines += [
        SEP2,
        f"  {'':30s}  {'BEFORE':>12}  {'AFTER':>12}",
        SEP2,
        f"  {'Predicted delay':<30}  {b['predicted_delay']:>+11.4f}m  {a['predicted_delay']:>+11.4f}m",
        f"  {'Predicted ETA':<30}  {b['predicted_eta'][11:]:>12}  {a['predicted_eta'][11:]:>12}",
        f"  {'ETA lower':<30}  {b['eta_lower'][11:]:>12}  {a['eta_lower'][11:]:>12}",
        f"  {'ETA upper':<30}  {b['eta_upper'][11:]:>12}  {a['eta_upper'][11:]:>12}",
        SEP2,
        f"  Delay shift    : {dd:>+.4f} min  "
        f"({'later arrival' if dd > 0 else 'earlier arrival' if dd < 0 else 'no change'})",
        f"  ETA shift      : {de:>+.4f} min",
        SEP,
    ]
    return "\n".join(lines)


def format_route_results(results: list[dict]) -> str:
    """Return a compact multi-station route summary."""
    SEP  = "=" * 65
    SEP2 = "-" * 65
    lines = [
        f"\n{SEP}",
        "  MULTI-STATION ROUTE ETA",
        SEP,
        f"  {'Stop':<4}  {'From':<18}  {'To':<18}  {'Pred Delay':>10}  {'Pred ETA':>20}",
        SEP2,
    ]
    for r in results:
        lines.append(
            f"  {r['stop_index']:<4}  "
            f"{r['current_station']:<18}  "
            f"{r['next_station']:<18}  "
            f"{r['predicted_delay']:>+9.2f}m  "
            f"{r['predicted_eta']:>20}"
        )
    lines.append(SEP2)
    if results:
        first_dep = results[0]["current_time"]
        last_eta  = results[-1]["predicted_eta"]
        first_delay = results[0]["current_delay"]
        last_delay  = results[-1]["predicted_delay"]
        lines += [
            f"  Departure (current time) : {first_dep}",
            f"  Final station ETA        : {last_eta}",
            f"  Initial delay            : {first_delay:>+.2f} min",
            f"  Final predicted delay    : {last_delay:>+.2f} min",
        ]
    lines.append(SEP)
    return "\n".join(lines)
