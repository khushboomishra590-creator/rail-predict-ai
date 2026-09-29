"""
disruption.py
=============
Pydantic schemas for the disruption planning API.

Disruption types map directly to M3 feature overrides:
  dense_fog       → current_speed reduced (fog speed restriction)
  freight_conflict → preceding_train_delay + headway increased
  signal_failure  → current_delay increased (signal hold)
  emergency_tsr   → current_speed capped at 30 km/h
  custom          → current_delay += impact_minutes (generic delay injection)

Only features that exist in the 15-feature XGBoost MLInput are modified.
No fake features are invented.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class DisruptionType(str, Enum):
    dense_fog        = "dense_fog"
    freight_conflict = "freight_conflict"
    signal_failure   = "signal_failure"
    emergency_tsr    = "emergency_tsr"
    custom           = "custom"


class DisruptionSeverity(str, Enum):
    high   = "high"
    medium = "medium"
    low    = "low"


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------

class DisruptionRequest(BaseModel):
    """
    Body for POST /api/disruptions.

    The 'section' field is for display / advisory purposes only
    (stored as section_code).  It is NOT used to filter which trains
    are affected — all trains with an active run today are affected.
    The disruption is applied by overriding relevant M3 input features.
    """
    description: str = Field(..., min_length=3, max_length=500,
                              examples=["Signal Failure - Mathura Jn"])
    type: DisruptionType = Field(..., examples=["signal_failure"])
    severity: DisruptionSeverity = Field(DisruptionSeverity.medium,
                                         examples=["high"])
    section: str | None = Field(None, examples=["SEC-MTJ-AGC"])
    impact_minutes: int = Field(0, ge=0, le=120,
                                 description="Hint for custom disruptions only. "
                                             "For preset types the feature mapping "
                                             "determines the actual delay impact.")


# ---------------------------------------------------------------------------
# Per-train result
# ---------------------------------------------------------------------------

class TrainDisruptionResult(BaseModel):
    train_id: str
    status: str            # "recalculated" | "no_run_today" | "no_eta_available"
    before_eta: str | None = None          # ISO-8601
    after_eta: str | None  = None          # ISO-8601
    before_eta_lower: str | None = None
    before_eta_upper: str | None = None
    after_eta_lower: str | None  = None
    after_eta_upper: str | None  = None
    eta_change_minutes: float | None = None
    predicted_delay_minutes: int | None = None
    uncertainty_minutes: int | None = None
    reason: str | None = None              # populated on error/skip


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------

class DisruptionInfo(BaseModel):
    id: int
    type: str
    description: str
    severity: str
    section: str | None
    impact_minutes: int
    is_active: bool
    created_at: str        # ISO-8601
    cleared_at: str | None

    model_config = ConfigDict(from_attributes=False)


class DisruptionResponse(BaseModel):
    """Response for POST /api/disruptions"""
    disruption: DisruptionInfo
    affected_trains: list[str]
    results: list[TrainDisruptionResult]


class ClearDisruptionsResponse(BaseModel):
    """Response for POST /api/disruptions/clear"""
    cleared_count: int
    results: list[TrainDisruptionResult]


class ActiveDisruptionsResponse(BaseModel):
    """Response for GET /api/disruptions"""
    disruptions: list[DisruptionInfo]
    total: int
