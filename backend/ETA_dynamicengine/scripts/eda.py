"""
SIH26028 - Railway Dynamic ETA Prediction
EDA Script - Member 1 (ML/ETA Prediction Component)
No model training. Analysis only.
"""

import pandas as pd
import numpy as np

DATA_PATH = r"c:\Users\nhatm\OneDrive\Desktop\nipun\SIH2026\ETA\data\SIH26028_demo_railway_eta_dataset.csv"

df = pd.read_csv(DATA_PATH)

SEP = "=" * 60

# ── 1. Shape ─────────────────────────────────────────────────
print(SEP)
print("1. SHAPE")
print(SEP)
print(f"   Rows    : {df.shape[0]}")
print(f"   Columns : {df.shape[1]}")

# ── 2. Column list (already known from header) ────────────────
print(f"\n{SEP}")
print("2. COLUMNS")
print(SEP)
for col in df.columns:
    print(f"   {col}")

# ── 3. Data Types ─────────────────────────────────────────────
print(f"\n{SEP}")
print("3. DATA TYPES")
print(SEP)
print(df.dtypes.to_string())

# ── 4. Missing Values ─────────────────────────────────────────
print(f"\n{SEP}")
print("4. MISSING VALUES")
print(SEP)
missing = df.isnull().sum()
missing_pct = (missing / len(df) * 100).round(2)
mv = pd.DataFrame({"missing_count": missing, "missing_%": missing_pct})
print(mv[mv["missing_count"] > 0].to_string() if mv["missing_count"].sum() > 0 else "   No missing values found.")

# ── 5. Duplicate Rows ─────────────────────────────────────────
print(f"\n{SEP}")
print("5. DUPLICATE ROWS")
print(SEP)
dupes = df.duplicated().sum()
print(f"   Duplicate rows : {dupes}")

# ── 6. Numerical Stats ────────────────────────────────────────
print(f"\n{SEP}")
print("6. NUMERICAL STATISTICS")
print(SEP)
num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
print(df[num_cols].describe().round(3).to_string())

# ── 7. Categorical Columns ────────────────────────────────────
print(f"\n{SEP}")
print("7. CATEGORICAL COLUMNS")
print(SEP)
cat_cols = df.select_dtypes(include=["object"]).columns.tolist()
for col in cat_cols:
    n_unique = df[col].nunique()
    sample = df[col].unique()[:5].tolist()
    print(f"   {col:<35} unique={n_unique:>4}  sample={sample}")

# ── 8. Target variable check ──────────────────────────────────
print(f"\n{SEP}")
print("8. TARGET VARIABLE: next_station_delay")
print(SEP)
target = "next_station_delay"
print(f"   Min    : {df[target].min()}")
print(f"   Max    : {df[target].max()}")
print(f"   Mean   : {df[target].mean():.3f}")
print(f"   Median : {df[target].median():.3f}")
print(f"   Std    : {df[target].std():.3f}")
print(f"   Zeros  : {(df[target] == 0).sum()}")
print(f"   Negative (early arrivals): {(df[target] < 0).sum()}")

# ── 9. Feature / Target split ─────────────────────────────────
print(f"\n{SEP}")
print("9. FEATURE / TARGET SPLIT")
print(SEP)
# Leakage candidates are columns that reveal the answer directly
leakage_candidates = []  # identified in step 10 below
features = [c for c in df.columns if c != target]
print(f"   Features ({len(features)}): {features}")
print(f"   Target       : {target}")

# ── 10. Leakage Analysis ──────────────────────────────────────
print(f"\n{SEP}")
print("10. DATA LEAKAGE ANALYSIS")
print(SEP)
corr = df[num_cols].corr()[target].drop(target).sort_values(key=abs, ascending=False)
print("   Pearson |correlation| with target (numerical cols):")
print(corr.round(3).to_string())
