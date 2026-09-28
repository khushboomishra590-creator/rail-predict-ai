"""
SIH26028 - Railway Dynamic ETA Prediction
Step 2: Baseline Model Evaluation
Member 1 - ML/ETA Prediction Component

Baseline strategy:
    baseline_prediction = current_delay
    (The simplest possible predictor — assume next-station delay
     equals the delay already accumulated at the current station.)
"""

import pandas as pd
import numpy as np

# ── sklearn imports with graceful fallback ────────────────────────────────────
try:
    from sklearn.metrics import mean_absolute_error
    try:
        # Available in scikit-learn >= 1.4
        from sklearn.metrics import root_mean_squared_error
        def compute_rmse(y_true, y_pred):
            return root_mean_squared_error(y_true, y_pred)
    except ImportError:
        from sklearn.metrics import mean_squared_error
        def compute_rmse(y_true, y_pred):
            return mean_squared_error(y_true, y_pred, squared=False)
    SKLEARN_AVAILABLE = True
except ImportError:
    # Fallback: pure numpy (numerically identical results)
    def mean_absolute_error(y_true, y_pred):
        return np.mean(np.abs(np.array(y_true) - np.array(y_pred)))
    def compute_rmse(y_true, y_pred):
        return np.sqrt(np.mean((np.array(y_true) - np.array(y_pred)) ** 2))
    SKLEARN_AVAILABLE = False

# ── Paths ─────────────────────────────────────────────────────────────────────
DATA_PATH = r"data/SIH26028_demo_railway_eta_dataset.csv"

# ─────────────────────────────────────────────────────────────────────────────
def run_baseline(data_path: str = DATA_PATH) -> dict:
    """
    Load dataset, generate baseline predictions, and evaluate.

    Baseline rule:
        baseline_prediction = current_delay

    Returns a dict with mae, rmse, and the result DataFrame.
    """
    df = pd.read_csv(data_path)

    # ── Baseline prediction ───────────────────────────────────────────────────
    df["baseline_prediction"] = df["current_delay"]
    df["absolute_error"]      = (df["next_station_delay"] - df["baseline_prediction"]).abs()

    y_true = df["next_station_delay"]
    y_pred = df["baseline_prediction"]

    mae  = mean_absolute_error(y_true, y_pred)
    rmse = compute_rmse(y_true, y_pred)

    return {"mae": mae, "rmse": rmse, "df": df}


# ─────────────────────────────────────────────────────────────────────────────
def print_report(result: dict) -> None:
    """Pretty-print the full baseline evaluation report."""

    mae  = result["mae"]
    rmse = result["rmse"]
    df   = result["df"]

    SEP  = "=" * 60
    SEP2 = "-" * 60

    print(f"\n{SEP}")
    print("  SIH26028 — BASELINE MODEL EVALUATION")
    print(f"  Strategy : baseline_prediction = current_delay")
    print(SEP)

    # ── Metrics ───────────────────────────────────────────────────────────────
    print(f"\n{'METRIC':30s}  {'VALUE':>10}")
    print(SEP2)
    print(f"{'Mean Absolute Error  (MAE)':30s}  {mae:>10.4f} min")
    print(f"{'Root Mean Sq Error   (RMSE)':30s}  {rmse:>10.4f} min")
    print(SEP2)

    # ── Interpretation ────────────────────────────────────────────────────────
    print(f"""
INTERPRETATION
--------------
MAE  = {mae:.2f} min
  On average, the baseline prediction is off by {mae:.2f} minutes.
  This means if we simply carry forward the current delay as our
  ETA estimate, we are wrong by about {mae:.1f} minutes per station.

RMSE = {rmse:.2f} min
  RMSE penalises large errors more heavily than MAE.
  An RMSE of {rmse:.2f} min tells us that when the baseline is wrong,
  it can be significantly wrong — large delay spikes or sudden
  recoveries are completely missed by this naive rule.

  Target for our XGBoost models: beat these numbers.
""")

    # ── 10 sample predictions ─────────────────────────────────────────────────
    print(SEP)
    print("  10 SAMPLE PREDICTIONS")
    print(SEP)
    sample = df[["current_delay", "next_station_delay",
                 "baseline_prediction", "absolute_error"]].head(10).copy()
    sample.columns = ["current_delay", "actual_next_delay",
                      "baseline_pred", "abs_error"]
    sample = sample.round(2)
    print(sample.to_string(index=True))
    print(SEP)

    # ── Error distribution summary ────────────────────────────────────────────
    print("\nERROR DISTRIBUTION")
    print(SEP2)
    ae = df["absolute_error"]
    print(f"  Errors ≤ 2 min   : {(ae <= 2).sum():>5}  ({(ae <= 2).mean()*100:.1f}%)")
    print(f"  Errors ≤ 5 min   : {(ae <= 5).sum():>5}  ({(ae <= 5).mean()*100:.1f}%)")
    print(f"  Errors > 5 min   : {(ae >  5).sum():>5}  ({(ae >  5).mean()*100:.1f}%)")
    print(f"  Errors > 10 min  : {(ae > 10).sum():>5}  ({(ae > 10).mean()*100:.1f}%)")
    print(SEP2)


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import os, pathlib

    # Support running from repo root or from model/ directory
    script_dir   = pathlib.Path(__file__).parent
    repo_root    = script_dir.parent
    data_default = repo_root / DATA_PATH

    result = run_baseline(str(data_default))
    print_report(result)

    if not SKLEARN_AVAILABLE:
        print("\n[NOTE] scikit-learn not found — metrics computed with numpy "
              "(numerically identical). Install scikit-learn to use the "
              "sklearn API directly.\n")
