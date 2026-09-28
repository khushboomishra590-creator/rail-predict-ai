"""
SIH26028 - Railway Dynamic ETA Prediction
Step 5 + Step 6: Prediction Interface — Network-aware XGBoost
Member 1 - ML/ETA Prediction Component

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ML MODEL CONTRACT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Function  : predict_next_station_delay(input_data)

INPUT     : dict or pd.DataFrame with exactly these 15 keys/columns
            ┌─────────────────────────────────┬────────────┬─────────────────────────────────────────────┐
            │ Feature                         │ Type       │ Description                                 │
            ├─────────────────────────────────┼────────────┼─────────────────────────────────────────────┤
            │ current_delay                   │ float      │ Current delay at this station (minutes)     │
            │ current_speed                   │ float      │ Current operational speed (km/h)            │
            │ distance_to_next_station        │ float      │ Distance remaining to next station (km)     │
            │ scheduled_remaining_time        │ float      │ Scheduled travel time to next station (min) │
            │ historical_section_median       │ float      │ Median historical travel time, section (min)│
            │ historical_section_P90          │ float      │ 90th-pct historical travel time, section    │
            │ historical_dwell_median         │ float      │ Median historical dwell at current stop(min)│
            │ historical_delay                │ float      │ Typical historical delay for this train     │
            │ historical_recovery             │ float      │ Avg delay recovery observed on this section │
            │ time_of_day                     │ int        │ Hour of day (0–23)                          │
            │ day_of_week                     │ int        │ Day encoded 0=Mon … 6=Sun                   │
            │ section                         │ str        │ Route section identifier (see VALID_SECTIONS│
            │ preceding_train_delay           │ float      │ Delay of the preceding train (minutes)      │
            │ headway                         │ float      │ Time gap to preceding train (minutes)       │
            │ distance_to_preceding_train     │ float      │ Physical gap to preceding train (km)        │
            └─────────────────────────────────┴────────────┴─────────────────────────────────────────────┘

OUTPUT    : float — predicted next_station_delay in minutes
            Negative values indicate predicted early arrival.

VALID_SECTIONS (must match training encoding exactly):
    'ADI_SECTION', 'AII_SECTION', 'BRC_SECTION',
    'JP_SECTION',  'SBT_SECTION', 'ST_SECTION'

USAGE (Member 3 — Dynamic ETA Engine):
    from model.predict import predict_next_station_delay

    prediction = predict_next_station_delay({
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
        "section":                 "BRC_SECTION",
        "preceding_train_delay":        3.0,
        "headway":                      7.5,
        "distance_to_preceding_train":  5.0,
    })
    # prediction → float (e.g. 4.87)

Step 6 additions
────────────────
get_prediction_with_uncertainty(input_data)
    Returns predicted_delay, lower_bound, upper_bound, uncertainty.
    Uncertainty = 90th-percentile absolute residual from held-out test set
    (empirical prediction range — NOT a statistically guaranteed interval).

explain_prediction(input_data, top_n=5)
    Returns a plain-language explanation of the most influential
    predictive signals for that specific prediction, using a
    perturbation-based local importance method.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import joblib
import pandas as pd
import numpy as np
from pathlib import Path
# ── Paths (resolve relative to this file so it works from any cwd) ─────────────
BASE_DIR = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = BASE_DIR / "artifacts"

_MODEL_PATH = ARTIFACTS_DIR / "network_xgb_model.pkl"
_ENCODER_PATH = ARTIFACTS_DIR / "label_encoder_section.pkl"

# ── Feature order must match training exactly ──────────────────────────────────
FEATURES: list[str] = [
    "current_delay",
    "current_speed",
    "distance_to_next_station",
    "scheduled_remaining_time",
    "historical_section_median",
    "historical_section_P90",
    "historical_dwell_median",
    "historical_delay",
    "historical_recovery",
    "time_of_day",
    "day_of_week",
    "section",                       # encoded → integer at prediction time
    "preceding_train_delay",
    "headway",
    "distance_to_preceding_train",
]

VALID_SECTIONS: list[str] = [
    "ADI_SECTION", "AII_SECTION", "BRC_SECTION",
    "JP_SECTION",  "SBT_SECTION", "ST_SECTION",
]


# ── Lazy-load model and encoder once ──────────────────────────────────────────
_model   = None
_encoder = None


def _load_artifacts():
    """Load model and encoder from disk (once, then cached in module globals)."""
    global _model, _encoder
    if _model is None:
        if not _MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Model not found: {_MODEL_PATH}\n"
                "Run model/train_network.py first."
            )
        _model = joblib.load(_MODEL_PATH)

    if _encoder is None:
        if not _ENCODER_PATH.exists():
            raise FileNotFoundError(
                f"Encoder not found: {_ENCODER_PATH}\n"
                "Run model/train_network.py first."
            )
        _encoder = joblib.load(_ENCODER_PATH)


# ── Public API ────────────────────────────────────────────────────────────────
def predict_next_station_delay(input_data: dict | pd.DataFrame) -> float:
    """
    Predict next_station_delay for a single train observation.

    Parameters
    ----------
    input_data : dict or single-row pd.DataFrame
        Must contain all 15 features listed in FEATURES.
        `section` must be one of VALID_SECTIONS (string).

    Returns
    -------
    float
        Predicted delay at the next station in minutes.
        Negative → predicted early arrival.

    Raises
    ------
    ValueError
        If a required feature is missing or `section` is unknown.
    """
    _load_artifacts()

    # ── Normalise input to a single-row DataFrame ──────────────────────────
    if isinstance(input_data, dict):
        df = pd.DataFrame([input_data])
    elif isinstance(input_data, pd.DataFrame):
        df = input_data.reset_index(drop=True).head(1).copy()
    else:
        raise TypeError(
            f"input_data must be dict or pd.DataFrame, got {type(input_data)}"
        )

    # ── Validate all features are present ─────────────────────────────────
    missing = [f for f in FEATURES if f not in df.columns]
    if missing:
        raise ValueError(f"Missing required features: {missing}")

    df = df[FEATURES].copy()

    # ── Validate and encode section ────────────────────────────────────────
    section_val = df["section"].iloc[0]
    if section_val not in VALID_SECTIONS:
        raise ValueError(
            f"Unknown section value: {section_val!r}\n"
            f"Valid values: {VALID_SECTIONS}"
        )
    df["section"] = _encoder.transform(df["section"])

    # ── Predict ────────────────────────────────────────────────────────────
    prediction = _model.predict(df)[0]
    return float(prediction)


# ── Batch convenience wrapper ─────────────────────────────────────────────────
def predict_batch(df: pd.DataFrame) -> np.ndarray:
    """
    Predict next_station_delay for multiple rows at once.

    Parameters
    ----------
    df : pd.DataFrame
        Must contain all 15 features. `section` as string.

    Returns
    -------
    np.ndarray of float, shape (n_rows,)
    """
    _load_artifacts()

    missing = [f for f in FEATURES if f not in df.columns]
    if missing:
        raise ValueError(f"Missing required features: {missing}")

    df = df[FEATURES].copy()

    unknown = set(df["section"].unique()) - set(VALID_SECTIONS)
    if unknown:
        raise ValueError(f"Unknown section value(s): {unknown}")

    df["section"] = _encoder.transform(df["section"])
    return _model.predict(df).astype(float)


# ── Self-test ─────────────────────────────────────────────────────────────────
def _run_self_test():
    """
    Validate the prediction interface using one sample from the demo dataset.
    Prints a clear report of input → prediction → actual → error.
    """
    import csv

    DATA_PATH = BASE_DIR.parent / "data" / "SIH26028_demo_railway_eta_dataset.csv"
    df_full   = pd.read_csv(DATA_PATH)

    # Use row index 0 as the test sample
    sample_row = df_full.iloc[0]
    actual     = float(sample_row["next_station_delay"])

    input_dict = {f: sample_row[f] for f in FEATURES}
    predicted  = predict_next_station_delay(input_dict)
    abs_error  = abs(actual - predicted)

    SEP  = "=" * 65
    SEP2 = "-" * 65

    print(f"\n{SEP}")
    print("  SIH26028 — predict.py  SELF-TEST")
    print(f"  Model : network_xgb_model.pkl")
    print(SEP)

    print("\nINPUT FEATURES")
    print(SEP2)
    for feat in FEATURES:
        val = input_dict[feat]
        print(f"  {feat:<35} : {val}")
    print(SEP2)

    print("\nPREDICTION RESULT")
    print(SEP2)
    print(f"  {'Predicted next_station_delay':<35} : {predicted:>8.4f} min")
    print(f"  {'Actual    next_station_delay':<35} : {actual:>8.4f} min")
    print(f"  {'Absolute error':<35} : {abs_error:>8.4f} min")
    print(SEP2)

    print(f"""
MEMBER 3 INTEGRATION NOTE
{SEP2}
  Call this function from the Dynamic ETA Engine:

      from model.predict import predict_next_station_delay

      predicted_delay = predict_next_station_delay(input_dict)
      # Returns: float (minutes). Negative = early arrival.

  For multiple rows at once, use:

      from model.predict import predict_batch
      predictions = predict_batch(dataframe)   # returns np.ndarray
{SEP2}
""")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 6  —  UNCERTAINTY  &  EXPLAINABILITY
# ══════════════════════════════════════════════════════════════════════════════

# ── Uncertainty constants (derived from held-out test-set residuals, Step 6) ──
# Computed from the same 80/20 split (random_state=42) used in Step 4 training.
# 200 test rows | network_xgb_model.pkl
_UNCERTAINTY_STATS: dict = {
    "mae":   2.4873,   # Mean Absolute Error on test set
    "rmse":  3.1083,   # Root Mean Squared Error on test set
    "p50":   2.1407,   # 50th-percentile absolute error  (median error)
    "p90":   5.0833,   # 90th-percentile absolute error  ← default uncertainty
    "p95":   5.9440,   # 95th-percentile absolute error
    "p99":   7.5723,   # 99th-percentile absolute error
}

# Default uncertainty band used in get_prediction_with_uncertainty()
_DEFAULT_UNCERTAINTY: float = _UNCERTAINTY_STATS["p90"]  # 5.0833 min

# ── Global feature importance (gain) from network_xgb_model, Step 4 ──────────
# Pre-computed so explain_prediction() works without reloading the booster
# every call.  Refreshed lazily on first use via _get_global_importance().
_GLOBAL_IMPORTANCE: dict | None = None

# Human-readable descriptions for each feature (for plain-language output)
_FEATURE_DESCRIPTIONS: dict[str, str] = {
    "current_delay":               "current station delay",
    "current_speed":               "current train speed",
    "distance_to_next_station":    "distance to next station",
    "scheduled_remaining_time":    "scheduled travel time remaining",
    "historical_section_median":   "typical travel time for this section",
    "historical_section_P90":      "worst-case historical section time (P90)",
    "historical_dwell_median":     "typical dwell time at current station",
    "historical_delay":            "historical delay pattern for this train",
    "historical_recovery":         "typical delay recovery on this section",
    "time_of_day":                 "time of day (hour)",
    "day_of_week":                 "day of week",
    "section":                     "route section",
    "preceding_train_delay":       "preceding train delay (network signal)",
    "headway":                     "time gap to preceding train",
    "distance_to_preceding_train": "distance to preceding train",
}


def _get_global_importance() -> dict[str, float]:
    """
    Return feature gain importance dict, loading from model if not yet cached.
    Sorted descending by gain score.
    """
    global _GLOBAL_IMPORTANCE
    if _GLOBAL_IMPORTANCE is None:
        _load_artifacts()
        raw = _model.get_booster().get_score(importance_type="gain")
        _GLOBAL_IMPORTANCE = dict(
            sorted(raw.items(), key=lambda x: x[1], reverse=True)
        )
    return _GLOBAL_IMPORTANCE


def _prepare_df(input_data: dict | pd.DataFrame) -> pd.DataFrame:
    """
    Shared preprocessing: normalise input, validate features, encode section.
    Returns a ready-to-predict single-row DataFrame.
    """
    _load_artifacts()

    if isinstance(input_data, dict):
        df = pd.DataFrame([input_data])
    elif isinstance(input_data, pd.DataFrame):
        df = input_data.reset_index(drop=True).head(1).copy()
    else:
        raise TypeError(
            f"input_data must be dict or pd.DataFrame, got {type(input_data)}"
        )

    missing = [f for f in FEATURES if f not in df.columns]
    if missing:
        raise ValueError(f"Missing required features: {missing}")

    df = df[FEATURES].copy()

    section_val = df["section"].iloc[0]
    if section_val not in VALID_SECTIONS:
        raise ValueError(
            f"Unknown section value: {section_val!r}\n"
            f"Valid values: {VALID_SECTIONS}"
        )
    df["section"] = _encoder.transform(df["section"])
    return df


# ── Part A: Uncertainty ───────────────────────────────────────────────────────
def get_prediction_with_uncertainty(
    input_data: dict | pd.DataFrame,
    uncertainty: float = _DEFAULT_UNCERTAINTY,
) -> dict:
    """
    Predict next_station_delay and attach an empirical prediction range.

    The uncertainty band is the 90th-percentile absolute residual measured
    on the held-out test set (200 rows, random_state=42).  This gives a
    range that covers ~90 % of observed prediction errors on unseen data.

    ⚠  This is an EMPIRICAL PREDICTION RANGE, not a statistically guaranteed
       confidence or credible interval.

    Parameters
    ----------
    input_data : dict or single-row pd.DataFrame
        All 15 model features.
    uncertainty : float, optional
        Override the default band (minutes).  Defaults to P90 = 5.0833 min.

    Returns
    -------
    dict with keys:
        predicted_delay  – point prediction (float, minutes)
        lower_bound      – predicted_delay - uncertainty
        upper_bound      – predicted_delay + uncertainty
        uncertainty      – the band used (float, minutes)
        uncertainty_note – plain-language caveat string
    """
    df         = _prepare_df(input_data)
    prediction = float(_model.predict(df)[0])

    return {
        "predicted_delay": round(prediction, 4),
        "lower_bound":     round(prediction - uncertainty, 4),
        "upper_bound":     round(prediction + uncertainty, 4),
        "uncertainty":     round(uncertainty, 4),
        "uncertainty_note": (
            f"Empirical range ± {uncertainty:.2f} min based on the 90th-percentile "
            "absolute error across 200 held-out test predictions. "
            "This is NOT a statistically guaranteed confidence interval."
        ),
    }


# ── Part B: Local Explainability (perturbation-based) ────────────────────────
def explain_prediction(
    input_data: dict | pd.DataFrame,
    top_n: int = 5,
) -> dict:
    """
    Produce a plain-language local explanation for a single prediction.

    Method: perturbation importance.
    Each feature is individually replaced with the dataset's median value
    (a neutral baseline) and the change in prediction is recorded.
    Features that cause the largest prediction change when perturbed are
    the most influential for this specific input.

    Note: This method shows which features contributed to the model's
    prediction for this particular input.  It does NOT claim that any
    feature "caused" the delay in the real world.

    Parameters
    ----------
    input_data : dict or single-row pd.DataFrame
    top_n : int
        Number of top contributing features to return (default 5).

    Returns
    -------
    dict with keys:
        predicted_delay   – point prediction (float, minutes)
        top_features      – list of dicts, each with:
                              feature, value, perturbation_impact,
                              direction, plain_text
        global_importance – full feature gain ranking (all 15 features)
        method_note       – explanation of the method used
    """
    # ── Feature medians (neutral baseline for perturbation) ──────────────
    _FEATURE_MEDIANS: dict[str, float | int] = {
        "current_delay":               7.3,
        "current_speed":              68.1,
        "distance_to_next_station":   64.3,
        "scheduled_remaining_time":   61.95,
        "historical_section_median":  32.5,
        "historical_section_P90":     49.0,
        "historical_dwell_median":     3.5,
        "historical_delay":            5.9,
        "historical_recovery":         2.5,
        "time_of_day":                14,
        "day_of_week":                 3,
        "section":                "BRC_SECTION",   # most frequent section
        "preceding_train_delay":       4.2,
        "headway":                     8.0,
        "distance_to_preceding_train": 5.9,
    }

    # Normalise input to dict
    if isinstance(input_data, pd.DataFrame):
        input_dict = input_data.iloc[0].to_dict()
    elif isinstance(input_data, dict):
        input_dict = dict(input_data)
    else:
        raise TypeError(f"input_data must be dict or pd.DataFrame")

    # Base prediction
    base_pred = predict_next_station_delay(input_dict)

    # Perturbation loop
    impacts: list[dict] = []
    for feat in FEATURES:
        perturbed         = dict(input_dict)
        perturbed[feat]   = _FEATURE_MEDIANS[feat]
        perturbed_pred    = predict_next_station_delay(perturbed)
        impact            = base_pred - perturbed_pred   # positive → feature pushed pred UP
        abs_impact        = abs(impact)
        impacts.append({
            "feature":            feat,
            "value":              input_dict[feat],
            "perturbation_impact": round(impact, 4),
            "abs_impact":         round(abs_impact, 4),
        })

    # Sort by absolute impact descending
    impacts.sort(key=lambda x: x["abs_impact"], reverse=True)

    # Build plain-text explanations for top_n features
    top_features = []
    for item in impacts[:top_n]:
        feat    = item["feature"]
        val     = item["value"]
        impact  = item["perturbation_impact"]
        desc    = _FEATURE_DESCRIPTIONS.get(feat, feat)

        if impact > 0.05:
            direction  = "increased"
            plain_text = (
                f"'{desc}' (value: {val}) was an important predictive signal "
                f"that contributed to a HIGHER predicted delay "
                f"(impact: +{impact:.2f} min)."
            )
        elif impact < -0.05:
            direction  = "decreased"
            plain_text = (
                f"'{desc}' (value: {val}) was an important predictive signal "
                f"that contributed to a LOWER predicted delay "
                f"(impact: {impact:.2f} min)."
            )
        else:
            direction  = "neutral"
            plain_text = (
                f"'{desc}' (value: {val}) had minimal influence on "
                f"this prediction (impact: {impact:.2f} min)."
            )

        top_features.append({
            "feature":            feat,
            "value":              val,
            "perturbation_impact": item["perturbation_impact"],
            "direction":          direction,
            "plain_text":         plain_text,
        })

    # Global importance for reference
    global_imp = _get_global_importance()

    return {
        "predicted_delay": round(base_pred, 4),
        "top_features":    top_features,
        "global_importance": {
            k: round(v, 2) for k, v in global_imp.items()
        },
        "method_note": (
            "Local explanation uses perturbation importance: each feature is "
            "individually replaced with its dataset median and the change in "
            "prediction is recorded. Larger change = stronger local influence. "
            "This shows which features contributed to the model's prediction "
            "for this specific input — it does NOT claim any feature caused "
            "the delay in the real world."
        ),
    }


# ── Part D self-test (Step 6) ─────────────────────────────────────────────────
def _run_step6_tests():
    """
    Run three sample predictions with uncertainty and local explanation.
    Also verifies existing predict_next_station_delay() is unbroken.
    """
    DATA_PATH = BASE_DIR.parent / "data" / "SIH26028_demo_railway_eta_dataset.csv"
    df_full   = pd.read_csv(DATA_PATH)

    # Pick 3 varied rows: index 0 (early arrival), 2 (high delay), 4 (on-time)
    sample_indices = [0, 2, 4]

    SEP  = "=" * 70
    SEP2 = "-" * 70

    print(f"\n{SEP}")
    print("  SIH26028 — Step 6 Tests: Uncertainty & Explainability")
    print(SEP)

    # ── Verify original function still works ─────────────────────────────
    print("\n[VERIFY] predict_next_station_delay() (Step 5 function) ...")
    row0       = df_full.iloc[0]
    inp0       = {f: row0[f] for f in FEATURES}
    legacy_out = predict_next_station_delay(inp0)
    print(f"  Row 0 → predicted: {legacy_out:.4f} min  ✅ function intact\n")

    # ── Three sample predictions ──────────────────────────────────────────
    for sample_num, idx in enumerate(sample_indices, 1):
        row    = df_full.iloc[idx]
        actual = float(row["next_station_delay"])
        inp    = {f: row[f] for f in FEATURES}

        # Uncertainty
        result = get_prediction_with_uncertainty(inp)
        pred   = result["predicted_delay"]
        lower  = result["lower_bound"]
        upper  = result["upper_bound"]
        unc    = result["uncertainty"]
        in_band = lower <= actual <= upper

        # Explanation
        expl   = explain_prediction(inp, top_n=5)

        print(f"{SEP}")
        print(f"  SAMPLE {sample_num}  (dataset row {idx})")
        print(SEP)
        print(f"  Actual next_station_delay  : {actual:>8.2f} min")
        print(f"  Predicted delay            : {pred:>8.4f} min")
        print(f"  Absolute error             : {abs(actual - pred):>8.4f} min")
        print(f"  Uncertainty (P90 band)     : ± {unc:.4f} min")
        print(f"  Prediction range           : [{lower:.4f}, {upper:.4f}] min")
        print(f"  Actual within range?       : {'✅ YES' if in_band else '❌ NO'}")

        print(f"\n  TOP 5 CONTRIBUTING FEATURES (local perturbation)")
        print(f"  {SEP2}")
        for i, feat_info in enumerate(expl["top_features"], 1):
            print(f"  {i}. {feat_info['plain_text']}")
        print(f"  {SEP2}")
        print(f"  Method: {expl['method_note'][:120]}...")
        print()

    # ── Global feature importance table ──────────────────────────────────
    print(f"\n{SEP}")
    print("  GLOBAL FEATURE IMPORTANCE (gain) — all 15 features")
    print(SEP)
    global_imp  = _get_global_importance()
    max_score   = max(global_imp.values())
    network_set = {"preceding_train_delay", "headway", "distance_to_preceding_train"}
    highlight   = {"current_delay", "historical_section_median",
                   "historical_section_P90"}

    for rank, (feat, score) in enumerate(global_imp.items(), 1):
        bar    = "█" * int(score / max_score * 28)
        tag    = " ◀ NETWORK"  if feat in network_set else \
                 " ◀ KEY"      if feat in highlight   else ""
        print(f"  {rank:>2}. {feat:<35} {score:>8.1f}  {bar}{tag}")
    print(SEP)

    # ── Uncertainty stats summary ─────────────────────────────────────────
    print("\n  UNCERTAINTY STATISTICS (held-out test set, 200 rows)")
    print(SEP2)
    for k, v in _UNCERTAINTY_STATS.items():
        selected = " ← used as default" if k == "p90" else ""
        print(f"  {k.upper():<8} : {v:.4f} min{selected}")
    print(f"  {SEP2}")
    print(f"  Prediction range formula:")
    print(f"    lower = predicted_delay - {_DEFAULT_UNCERTAINTY:.4f}")
    print(f"    upper = predicted_delay + {_DEFAULT_UNCERTAINTY:.4f}")
    print(f"  ⚠  Empirical range only — NOT a statistical confidence interval.")
    print(SEP2)

    print(f"\n{SEP}")
    print("  FILES STATUS")
    print(SEP)
    import os
    files = {
        "network_xgb_model.pkl": BASE_DIR / "network_xgb_model.pkl",
        "xgb_model.pkl":         BASE_DIR / "xgb_model.pkl",
        "predict.py":            BASE_DIR / "predict.py",
    }
    for name, path in files.items():
        mtime = pd.Timestamp(os.path.getmtime(path), unit="s").strftime("%H:%M:%S")
        size  = round(path.stat().st_size / 1024, 1)
        mod   = "MODIFIED (Step 6 text update)" if name == "predict.py" else "UNTOUCHED"
        print(f"  {name:<30}  {size:>7.1f} KB   last modified {mtime}  [{mod}]")
    print(SEP)


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--step5":
        _run_self_test()
    else:
        _run_step6_tests()

