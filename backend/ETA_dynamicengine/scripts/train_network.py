"""
SIH26028 - Railway Dynamic ETA Prediction
Step 4: Network-aware XGBoost Regression Model
Member 1 - ML/ETA Prediction Component

Extends Step 3 by adding three network-aware features:
    preceding_train_delay   — delay of the train immediately ahead
    headway                 — time gap to that preceding train (min)
    distance_to_preceding_train — physical separation (km)

These features capture inter-train congestion propagation, which
the plain XGBoost model in Step 3 had no visibility into.

Same 80/20 split + random_state=42 as Step 3 for a fair comparison.
"""

import pathlib
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error, root_mean_squared_error
from xgboost import XGBRegressor

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT         = pathlib.Path(__file__).parent.parent
DATA_PATH    = ROOT / "data" / "SIH26028_demo_railway_eta_dataset.csv"
MODEL_DIR    = ROOT / "model"
MODEL_PATH   = MODEL_DIR / "network_xgb_model.pkl"     # separate file — Step 3 untouched
ENCODER_PATH = MODEL_DIR / "label_encoder_section.pkl"  # reuse same encoder

# ── Config ────────────────────────────────────────────────────────────────────
TARGET       = "next_station_delay"
RANDOM_STATE = 42          # identical to Step 3 for fair split comparison
TEST_SIZE    = 0.20

# Step 3 features
BASE_FEATURES = [
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
    "section",
]

# New network-aware features added in Step 4
NETWORK_FEATURES = [
    "preceding_train_delay",
    "headway",
    "distance_to_preceding_train",
]

FEATURES = BASE_FEATURES + NETWORK_FEATURES   # 15 total

# Reference benchmarks
BASELINE_MAE   = 3.3816
BASELINE_RMSE  = 4.2393
XGB_MAE        = 2.6666
XGB_RMSE       = 3.3670

SEP  = "=" * 70
SEP2 = "-" * 70


# ── 1. Load ───────────────────────────────────────────────────────────────────
def load_data(path: pathlib.Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    print(f"  Loaded {len(df):,} rows × {len(df.columns)} cols")
    return df


# ── 2. Preprocess ─────────────────────────────────────────────────────────────
def preprocess(df: pd.DataFrame):
    df = df[FEATURES + [TARGET]].copy()
    le = LabelEncoder()
    df["section"] = le.fit_transform(df["section"])
    X = df[FEATURES]
    y = df[TARGET]
    return X, y, le


# ── 3. Train ──────────────────────────────────────────────────────────────────
def train(X_train: pd.DataFrame, y_train: pd.Series) -> XGBRegressor:
    """Same hyperparameter config as Step 3 — only the feature set changes."""
    model = XGBRegressor(
        n_estimators=200,
        learning_rate=0.1,
        max_depth=5,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=RANDOM_STATE,
        n_jobs=-1,
        verbosity=0,
    )
    model.fit(X_train, y_train)
    return model


# ── 4. Evaluate ───────────────────────────────────────────────────────────────
def evaluate(model, X_test, y_test):
    y_pred = model.predict(X_test)
    mae    = mean_absolute_error(y_test, y_pred)
    rmse   = root_mean_squared_error(y_test, y_pred)
    return mae, rmse, y_pred


# ── 5. Report ─────────────────────────────────────────────────────────────────
def pct_improvement(old_val, new_val):
    return (old_val - new_val) / old_val * 100


def print_report(mae: float, rmse: float,
                 y_test: pd.Series, y_pred: np.ndarray,
                 model: XGBRegressor) -> None:

    imp_vs_baseline_mae  = pct_improvement(BASELINE_MAE,  mae)
    imp_vs_baseline_rmse = pct_improvement(BASELINE_RMSE, rmse)
    imp_vs_xgb_mae       = pct_improvement(XGB_MAE,       mae)
    imp_vs_xgb_rmse      = pct_improvement(XGB_RMSE,      rmse)

    beats_baseline = mae < BASELINE_MAE and rmse < BASELINE_RMSE
    beats_xgb      = mae < XGB_MAE      and rmse < XGB_RMSE

    print(f"\n{SEP}")
    print("  SIH26028 — NETWORK-AWARE XGBoost EVALUATION (Step 4)")
    print(f"  Features : {len(FEATURES)} (Base {len(BASE_FEATURES)} + Network {len(NETWORK_FEATURES)})")
    print(f"  Test size: 20%  |  random_state={RANDOM_STATE}")
    print(SEP)

    # ── Three-way comparison table ────────────────────────────────────────────
    print(f"\n{'Metric':<8}  {'Baseline':>10}  {'XGBoost':>10}  {'Net-XGBoost':>12}  {'vs Baseline':>12}  {'vs XGBoost':>12}")
    print(SEP2)
    print(f"{'MAE':<8}  {BASELINE_MAE:>9.4f}m  {XGB_MAE:>9.4f}m  {mae:>11.4f}m"
          f"  {imp_vs_baseline_mae:>+11.2f}%  {imp_vs_xgb_mae:>+11.2f}%")
    print(f"{'RMSE':<8}  {BASELINE_RMSE:>9.4f}m  {XGB_RMSE:>9.4f}m  {rmse:>11.4f}m"
          f"  {imp_vs_baseline_rmse:>+11.2f}%  {imp_vs_xgb_rmse:>+11.2f}%")
    print(SEP2)

    b_verdict = "✅ Beats baseline" if beats_baseline else "❌ Does not beat baseline"
    x_verdict = "✅ Beats XGBoost"  if beats_xgb      else "❌ Does not beat XGBoost"
    print(f"\n  {b_verdict}   |   {x_verdict}\n")

    # ── Interpretation ────────────────────────────────────────────────────────
    print("INTERPRETATION")
    print(SEP2)
    print(f"  MAE  = {mae:.4f} min")
    print(f"    vs Baseline  : {imp_vs_baseline_mae:+.1f}%  ({BASELINE_MAE:.4f} → {mae:.4f})")
    print(f"    vs XGBoost   : {imp_vs_xgb_mae:+.1f}%  ({XGB_MAE:.4f} → {mae:.4f})")
    print(f"\n  RMSE = {rmse:.4f} min")
    print(f"    vs Baseline  : {imp_vs_baseline_rmse:+.1f}%  ({BASELINE_RMSE:.4f} → {rmse:.4f})")
    print(f"    vs XGBoost   : {imp_vs_xgb_rmse:+.1f}%  ({XGB_RMSE:.4f} → {rmse:.4f})")
    print(SEP2)

    # ── 10 sample predictions ─────────────────────────────────────────────────
    print(f"\n{'':5}  {'actual':>10}  {'predicted':>10}  {'abs_error':>10}")
    print(SEP2)
    y_arr  = np.array(y_test)
    errors = np.abs(y_arr - y_pred)
    for i in range(10):
        print(f"  [{i}]  {y_arr[i]:>10.2f}  {y_pred[i]:>10.2f}  {errors[i]:>10.2f}")
    print(SEP2)

    # ── Feature importance — all 15 features ─────────────────────────────────
    print("\nFEATURE IMPORTANCE (gain) — all 15 features")
    print(SEP2)
    importance  = model.get_booster().get_score(importance_type="gain")
    sorted_imp  = sorted(importance.items(), key=lambda x: x[1], reverse=True)
    max_score   = max(v for _, v in sorted_imp)
    network_set = set(NETWORK_FEATURES)

    for feat, score in sorted_imp:
        bar    = "█" * int(score / max_score * 30)
        marker = " ◀ NETWORK" if feat in network_set else ""
        print(f"  {feat:<35}  {score:>9.1f}  {bar}{marker}")
    print(SEP2)

    # ── Network-feature focused summary ──────────────────────────────────────
    print("\nNETWORK FEATURES SUMMARY")
    print(SEP2)
    score_dict = dict(sorted_imp)
    for feat in NETWORK_FEATURES:
        score = score_dict.get(feat, 0.0)
        rank  = next((i+1 for i, (f, _) in enumerate(sorted_imp) if f == feat), "N/A")
        print(f"  {feat:<35}  gain={score:>8.1f}  rank={rank}/{len(sorted_imp)}")
    print(SEP2)


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print(f"\n{SEP}")
    print("  SIH26028 — Step 4: Network-aware XGBoost Training Pipeline")
    print(SEP)

    # 1. Load
    df = load_data(DATA_PATH)

    # 2. Preprocess
    X, y, le = preprocess(df)
    print(f"  Feature matrix shape : {X.shape}  (Base={len(BASE_FEATURES)}, Network={len(NETWORK_FEATURES)})")
    print(f"  Target shape         : {y.shape}")
    print(f"  New network features : {NETWORK_FEATURES}")

    # 3. Split — identical seed to Step 3
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE
    )
    print(f"  Train rows : {len(X_train):,}  |  Test rows : {len(X_test):,}")

    # 4. Train
    print(f"\n  Training Network-aware XGBoost ...")
    model = train(X_train, y_train)
    print("  Training complete.")

    # 5. Evaluate
    mae, rmse, y_pred = evaluate(model, X_test, y_test)

    # 6. Report
    print_report(mae, rmse, y_test, y_pred, model)

    # 7. Save — does NOT overwrite xgb_model.pkl
    joblib.dump(model, MODEL_PATH)
    joblib.dump(le,    ENCODER_PATH)   # overwrite encoder (identical encoding)
    print(f"\n  Network model saved → {MODEL_PATH}")
    print(f"  xgb_model.pkl       → UNTOUCHED (Step 3 model preserved)")
    print(f"\n{SEP}\n")

    return mae, rmse


if __name__ == "__main__":
    main()
