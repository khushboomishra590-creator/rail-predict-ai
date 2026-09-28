"""
historical_lookup.py
====================
Lookup for HistoricalFeatures and NetworkState defaults.

SOURCE: M2 dataset — SIH26028_demo_railway_eta_dataset.csv
        Located at: backend/ETA_dynamicengine/data/SIH26028_demo_railway_eta_dataset.csv

LOOKUP STRATEGY (priority order):
  1. train_id + section  — most specific; used when the same train's
                           historical patterns for that section are available
                           in the CSV (e.g. train 12951 has 132 rows).
  2. section only        — fallback when the train is not in the CSV for
                           that section but the section itself is present.
  3. dataset-wide median — final fallback when section is unknown.

NetworkState defaults use dataset-wide medians (all train IDs).
In a production system these would come from a live operational feed.

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
_train_section_stats: dict[tuple, dict[str, float]] | None = None   # (train_id, section) → medians
_section_stats: dict[str, dict[str, float]] | None = None            # section → medians
_dataset_defaults: dict[str, float] | None = None


class HistoricalValues(TypedDict):
    historical_section_median: float
    historical_section_P90: float
    historical_dwell_median: float
    historical_delay: float
    historical_recovery: float
    source: str   # "csv_train_section" | "csv_section" | "csv_dataset_fallback"


class NetworkDefaults(TypedDict):
    preceding_train_delay: float
    headway: float
    distance_to_preceding_train: float


_HIST_COLS = [
    "historical_section_median",
    "historical_section_P90",
    "historical_dwell_median",
    "historical_delay",
    "historical_recovery",
]
_NET_COLS = ["preceding_train_delay", "headway", "distance_to_preceding_train"]


def _load() -> None:
    """Load CSV and pre-compute per-(train,section), per-section and
    dataset-wide medians (once, then cached)."""
    global _df, _train_section_stats, _section_stats, _dataset_defaults

    if _df is not None:
        return  # already loaded

    _df = pd.read_csv(_CSV_PATH)

    # ── Per-(train_id, section) medians — most specific lookup ────────────────
    _train_section_stats = {}
    ts_grouped = _df.groupby(["train_id", "section"])[_HIST_COLS].median()
    for (train_id, section), row in ts_grouped.iterrows():
        _train_section_stats[(str(train_id), section)] = row.to_dict()

    # ── Per-section medians (all trains) — section fallback ───────────────────
    _section_stats = (
        _df.groupby("section")[_HIST_COLS]
        .median()
        .to_dict(orient="index")
    )

    # ── Dataset-wide medians — final fallback + network defaults ──────────────
    _dataset_defaults = {
        col: float(_df[col].median())
        for col in _HIST_COLS + _NET_COLS
    }


def get_historical_features(
    section: str | None,
    train_id: str | None = None,
) -> HistoricalValues:
    """
    Return HistoricalFeatures values using the best available match.

    Lookup priority:
      1. (train_id, section) — if both provided and present in CSV
      2. section only        — if section found in CSV
      3. dataset-wide median — final fallback

    Parameters
    ----------
    section : str | None
        M3 section identifier, e.g. "BRC_SECTION".
    train_id : str | None
        Train number string, e.g. "12951".  Optional — when provided,
        enables train-specific historical lookup.

    Returns
    -------
    HistoricalValues dict — keys match HistoricalFeatures field names exactly.
    """
    _load()
    assert _train_section_stats is not None
    assert _section_stats is not None
    assert _dataset_defaults is not None

    # Priority 1: train + section specific
    if train_id and section:
        key = (str(train_id), section)
        if key in _train_section_stats:
            row = _train_section_stats[key]
            return HistoricalValues(
                historical_section_median=float(row["historical_section_median"]),
                historical_section_P90=float(row["historical_section_P90"]),
                historical_dwell_median=float(row["historical_dwell_median"]),
                historical_delay=float(row["historical_delay"]),
                historical_recovery=float(row["historical_recovery"]),
                source="csv_train_section",
            )

    # Priority 2: section only
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

    # Priority 3: dataset-wide fallback
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
