"""
SIH26028 - Railway Dynamic ETA Prediction
Step 3: XGBoost Regression Model
Member 1 - ML/ETA Prediction Component

Features used (no network features yet):
    current_delay, current_speed, distance_to_next_station,
    scheduled_remaining_time, historical_section_median,
    historical_section_P90, historical_dwell_median,
    historical_delay, historical_recovery,
    time_of_day, day_of_week, section (encoded)

Excluded (added in Step 4 - Network-aware XGBoost):
    preceding_train_delay, headway, distance_to_preceding_train

Excluded (identifiers / leakage):
    train_id, date, current_station, next_station
"""

import pathlib
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error
from sklearn.metrics import root_mean_squared_error
from xgboost import XGBRegressor

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT      = pathlib.Path(__file__).parent.parent          # repo root
DATA_PATH = ROOT / "data" / "SIH26028_demo_railway_eta_dataset.csv"
MODEL_DIR = ROOT / "model"
MODEL_PATH = MODEL_DIR / "xgb_model.pkl"
ENCODER_PATH = MODEL_DIR / "label_encoder_section.pkl"

# ── Config ────────────────────────────────────────────────────────────────────
TARGET       = "next_station_delay"
RANDOM_STATE = 42
TEST_SIZE    = 0.20

FEATURES = [
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
    "section",           # categorical → label-encoded below
]

# Baseline benchmarks from Step 2
BASELINE_MAE  = 3.3816
BASELINE_RMSE = 4.2393

SEP  = "=" * 65
SEP2 = "-" * 65


# ── 1. Load data ──────────────────────────────────────────────────────────────
def load_data(path: pathlib.Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    print(f"  Loaded {len(df):,} rows × {len(df.columns)} cols from:\n  {path}")
    return df


# ── 2. Preprocess ─────────────────────────────────────────────────────────────
def preprocess(df: pd.DataFrame):
    """
    - Select relevant features + target
    - Label-encode `section` (6 unique values, low cardinality)
    - Return X, y, and the fitted encoder
    """
    df = df[FEATURES + [TARGET]].copy()

    le = LabelEncoder()
    df["section"] = le.fit_transform(df["section"])

    X = df[FEATURES]
    y = df[TARGET]
    return X, y, le


# ── 3. Train ──────────────────────────────────────────────────────────────────
def train(X_train: pd.DataFrame, y_train: pd.Series) -> XGBRegressor:
    """
    Simple starting configuration — no extensive tuning yet.
    n_estimators=200, learning_rate=0.1, max_depth=5 are
    reasonable defaults for a tabular regression task of this size.
    """
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
def evaluate(model: XGBRegressor, X_test: pd.DataFrame,
             y_test: pd.Series) -> tuple[float, float, np.ndarray]:
    y_pred = model.predict(X_test)
    mae    = mean_absolute_error(y_test, y_pred)
    rmse   = root_mean_squared_error(y_test, y_pred)
    return mae, rmse, y_pred


# ── 5. Report ─────────────────────────────────────────────────────────────────
def print_report(mae: float, rmse: float,
                 y_test: pd.Series, y_pred: np.ndarray) -> None:

    mae_improvement  = (BASELINE_MAE  - mae)  / BASELINE_MAE  * 100
    rmse_improvement = (BASELINE_RMSE - rmse) / BASELINE_RMSE * 100
    beat_baseline    = mae < BASELINE_MAE and rmse < BASELINE_RMSE

    print(f"\n{SEP}")
    print("  SIH26028 — XGBoost MODEL EVALUATION (Step 3)")
    print(f"  Features : {len(FEATURES)}  |  Test size: {TEST_SIZE*100:.0f}%  |  random_state={RANDOM_STATE}")
    print(SEP)

    # ── Metric comparison table ───────────────────────────────────────────────
    print(f"\n{'Metric':<10}  {'Baseline':>12}  {'XGBoost':>12}  {'Improvement':>13}")
    print(SEP2)
    print(f"{'MAE':<10}  {BASELINE_MAE:>11.4f}m  {mae:>11.4f}m  {mae_improvement:>+12.2f}%")
    print(f"{'RMSE':<10}  {BASELINE_RMSE:>11.4f}m  {rmse:>11.4f}m  {rmse_improvement:>+12.2f}%")
    print(SEP2)

    verdict = "✅ XGBoost BEATS the baseline on both MAE and RMSE." \
              if beat_baseline else \
              "❌ XGBoost did NOT beat the baseline on at least one metric."
    print(f"\n  {verdict}\n")

    # ── Interpretation ────────────────────────────────────────────────────────
    print("INTERPRETATION")
    print(SEP2)
    print(f"  MAE  = {mae:.4f} min")
    print(f"    The XGBoost model is on average off by {mae:.2f} minutes per station.")
    if mae_improvement > 0:
        print(f"    That is a {mae_improvement:.1f}% reduction vs the naive carry-forward baseline.")
    else:
        print(f"    The baseline is still better on MAE by {abs(mae_improvement):.1f}%.")

    print(f"\n  RMSE = {rmse:.4f} min")
    print(f"    RMSE of {rmse:.2f} min accounts for penalising large errors.")
    if rmse_improvement > 0:
        print(f"    A {rmse_improvement:.1f}% improvement shows the model handles outlier")
        print(f"    delay spikes better than the naive rule.")
    else:
        print(f"    The baseline is still better on RMSE by {abs(rmse_improvement):.1f}%.")
    print(SEP2)

    # ── 10 sample predictions ─────────────────────────────────────────────────
    print(f"\n{'':5}  {'actual':>10}  {'predicted':>10}  {'abs_error':>10}")
    print(SEP2)
    y_test_arr = np.array(y_test)
    abs_errors = np.abs(y_test_arr - y_pred)
    for i in range(10):
        print(f"  [{i}]  {y_test_arr[i]:>10.2f}  {y_pred[i]:>10.2f}  {abs_errors[i]:>10.2f}")
    print(SEP2)

    # ── Feature importance (top 10) ───────────────────────────────────────────
    print("\nFEATURE IMPORTANCE (gain)")
    print(SEP2)
    # model is accessible via closure; handled by caller


def print_feature_importance(model: XGBRegressor) -> None:
    importance = model.get_booster().get_score(importance_type="gain")
    sorted_imp = sorted(importance.items(), key=lambda x: x[1], reverse=True)
    for feat, score in sorted_imp[:12]:
        bar = "█" * int(score / max(v for _, v in sorted_imp) * 30)
        print(f"  {feat:<35}  {score:>9.1f}  {bar}")
    print(SEP2)


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print(f"\n{SEP}")
    print("  SIH26028 — Step 3: XGBoost Training Pipeline")
    print(SEP)

    # 1. Load
    df = load_data(DATA_PATH)

    # 2. Preprocess
    X, y, le = preprocess(df)
    print(f"\n  Feature matrix shape : {X.shape}")
    print(f"  Target shape         : {y.shape}")

    # 3. Train/test split (80/20, stratified by nothing — regression task)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE
    )
    print(f"  Train rows : {len(X_train):,}  |  Test rows : {len(X_test):,}")

    # 4. Train
    print(f"\n  Training XGBoost (n_estimators=200, lr=0.1, max_depth=5) ...")
    model = train(X_train, y_train)
    print("  Training complete.")

    # 5. Evaluate
    mae, rmse, y_pred = evaluate(model, X_test, y_test)

    # 6. Print report
    print_report(mae, rmse, y_test, y_pred)
    print_feature_importance(model)

    # 7. Save model + encoder
    joblib.dump(model, MODEL_PATH)
    joblib.dump(le,    ENCODER_PATH)
    print(f"\n  Model saved   → {MODEL_PATH}")
    print(f"  Encoder saved → {ENCODER_PATH}")
    print(f"\n{SEP}\n")

    return mae, rmse


if __name__ == "__main__":
    main()
