"""
historical_lookup.py
====================
MVP lookup for HistoricalFeatures and NetworkState defaults.

SOURCE: M2 dataset — SIH26028_demo_railway_eta_dataset.csv
        Located at: backend/ETA_dynamicengine/data/SIH26028_demo_railway_eta_dataset.csv

BEHAVIOUR:
- On first call the CSV is loaded once and section-level medians are
  pre-computed.  Subsequent calls use the cached values.
- Lookup key: section code (e.g. "BRC_SECTION").
- If the section is not found in the CSV the overall dataset median is
  returned as a safe fallback (documented in the return value).
- NetworkState defaults are the dataset-wide medians for the three
  network features.  In a production system these would come from a
  live feed.

NO os.chdir() is used.  All paths are resolved relative to this file.
"""

from __future__ import annotations

import pathlib
from typing import TypedDict

import pandas as pd

# ── Path resolved from this file → no dependency on working directory ─────────
_CSV_PATH = (
    pathlib.Path(__file__).resolve().parent.parent   # backend/
    / "ETA_dynamicengine"
    / "data"
    / "SIH26028_demo_railway_eta_dataset.csv"
)

# ── Module-level cache ─────────────────────────────────────────────────────────
_df: pd.DataFrame | None = None
_section_stats: dict[str, dict[str, float]] | None = None
_dataset_defaults: dict[str, float] | None = None


class HistoricalValues(TypedDict):
    historical_section_median: float
    historical_section_P90: float
    historical_dwell_median: float
    historical_delay: float
    historical_recovery: float
    source: str   # "csv_section" | "csv_dataset_fallback"


class NetworkDefaults(TypedDict):
    preceding_train_delay: float
    headway: float
    distance_to_preceding_train: float


def _load() -> None:
    """Load CSV and pre-compute per-section and dataset-wide medians (once)."""
    global _df, _section_stats, _dataset_defaults

    if _df is not None:
        return  # already loaded

    _df = pd.read_csv(_CSV_PATH)

    # ── Per-section medians ────────────────────────────────────────────────────
    hist_cols = [
        "historical_section_median",
        "historical_section_P90",
        "historical_dwell_median",
        "historical_delay",
        "historical_recovery",
    ]
    _section_stats = (
        _df.groupby("section")[hist_cols]
        .median()
        .to_dict(orient="index")
    )

    # ── Dataset-wide medians (fallback + network defaults) ────────────────────
    network_cols = ["preceding_train_delay", "headway", "distance_to_preceding_train"]
    _dataset_defaults = {
        col: float(_df[col].median())
        for col in hist_cols + network_cols
    }


def get_historical_features(section: str | None) -> HistoricalValues:
    """
    Return HistoricalFeatures values for the given section code.

    Parameters
    ----------
    section : str | None
        M3 section identifier, e.g. "BRC_SECTION".
        If None or not found in the CSV the dataset-wide median is used.

    Returns
    -------
    HistoricalValues dict — keys match HistoricalFeatures field names exactly.
    """
    _load()
    assert _section_stats is not None and _dataset_defaults is not None

    if section and section in _section_stats:
        row = _section_stats[section]
        return HistoricalValues(
            historical_section_median=float(row["historical_section_median"]),
            historical_section_P90=float(row["historical_section_P90"]),
            historical_dwell_median=float(row["historical_dwell_median"]),
            historical_delay=float(row["historical_delay"]),
            historical_recovery=float(row["historical_recovery"]),
            source="csv_section",
        )

    # Fallback to dataset median
    return HistoricalValues(
        historical_section_median=float(_dataset_defaults["historical_section_median"]),
        historical_section_P90=float(_dataset_defaults["historical_section_P90"]),
        historical_dwell_median=float(_dataset_defaults["historical_dwell_median"]),
        historical_delay=float(_dataset_defaults["historical_delay"]),
        historical_recovery=float(_dataset_defaults["historical_recovery"]),
        source="csv_dataset_fallback",
    )


def get_network_defaults() -> NetworkDefaults:
    """
    Return MVP network state defaults (dataset-wide medians).

    In production these should come from a live operational feed.
    For the MVP we use the CSV medians to avoid arbitrary hardcoding.
    """
    _load()
    assert _dataset_defaults is not None

    return NetworkDefaults(
        preceding_train_delay=float(_dataset_defaults["preceding_train_delay"]),
        headway=float(_dataset_defaults["headway"]),
        distance_to_preceding_train=float(_dataset_defaults["distance_to_preceding_train"]),
    )
