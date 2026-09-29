"""
disruption_service.py
=====================
Orchestration layer for the Scenario Disruption Planner.

Responsibility (M4 only):
  1. Persist the disruption event to PostgreSQL.
  2. Map disruption type → M3 feature overrides (only real MLInput features).
  3. Collect all trains with an active run today.
  4. Capture BEFORE ETA by calling existing M3 pipeline.
  5. Apply feature overrides, call M3 again for AFTER ETA.
  6. Persist the new EtaPrediction rows.
  7. Return structured before/after response.
  8. On clear: deactivate disruptions, re-run M3 baseline, return updated ETAs.

Feature override mapping (only keys that exist in the 15-feature MLInput):
  dense_fog        → current_speed reduced to simulate fog speed restriction
  freight_conflict → preceding_train_delay increased + headway tightened
  signal_failure   → current_delay increased (signal hold propagates delay)
  emergency_tsr    → current_speed capped at 30 km/h (TSR enforcement)
  custom           → current_delay += impact_minutes (generic delay injection)

No features are invented. No ETA arithmetic is performed in this file.
All predictions come from M3 → XGBoost.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session, joinedload

from backend.models.models import Disruption, EtaPrediction, Station, Train, TrainRun
from backend.schemas.disruption import (
    DisruptionInfo,
    DisruptionRequest,
    DisruptionResponse,
    ClearDisruptionsResponse,
    TrainDisruptionResult,
)
from backend.services import m3_adapter
from backend.services.eta_service import _ensure_tz, _fmt


# ---------------------------------------------------------------------------
# Feature override mapping
# ---------------------------------------------------------------------------

def _build_feature_overrides(
    disruption_type: str,
    impact_minutes: int,
    run: TrainRun,
) -> dict[str, Any]:
    """
    Translate a disruption type into M3 MLInput feature overrides.

    Only modifies features that exist in the 15-feature FEATURES list
    in predict.py. Returns a dict of {feature_name: new_value}.

    Parameters
    ----------
    disruption_type : str
        One of: dense_fog, freight_conflict, signal_failure, emergency_tsr, custom.
    impact_minutes : int
        User-supplied hint (used for custom type; presets compute their own impact).
    run : TrainRun
        Current live run — used to read baseline speed/delay for relative changes.
    """
    baseline_speed = float(run.current_speed_kmh or 80)
    baseline_delay = float(run.current_delay_min)
    baseline_ptd   = 5.0   # CSV dataset median for preceding_train_delay

    if disruption_type == "dense_fog":
        # Fog imposes a speed restriction — reduce current_speed by ~50%, min 25 km/h
        return {
            "current_speed": max(25.0, baseline_speed * 0.5),
        }

    elif disruption_type == "freight_conflict":
        # Freight ahead: preceding train delay and headway compression
        return {
            "preceding_train_delay": baseline_ptd + 12.0,
            "headway": 2.0,          # compressed headway
        }

    elif disruption_type == "signal_failure":
        # Signal hold: train must wait — translates directly to increased current_delay
        return {
            "current_delay": baseline_delay + 15.0,
        }

    elif disruption_type == "emergency_tsr":
        # TSR caps speed at 30 km/h
        return {
            "current_speed": min(baseline_speed, 30.0),
        }

    else:
        # custom — use the impact_minutes hint as an added delay
        added = float(max(impact_minutes, 5))
        return {
            "current_delay": baseline_delay + added,
        }


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _active_runs_today(db: Session) -> list[TrainRun]:
    """
    Return the most recent TrainRun per train that has station context.
    Prefers today's run; falls back to the latest available run so the
    disruption planner works even when runs have not been seeded for today.
    """
    from datetime import date

    # Sub-select: max run_date per train_id with station context
    from sqlalchemy import func as sqlfunc
    subq = (
        db.query(
            TrainRun.train_id,
            sqlfunc.max(TrainRun.run_date).label("latest_date"),
        )
        .filter(TrainRun.current_station_id.isnot(None))
        .group_by(TrainRun.train_id)
        .subquery()
    )

    return (
        db.query(TrainRun)
        .options(
            joinedload(TrainRun.train),
            joinedload(TrainRun.current_station),
            joinedload(TrainRun.next_station),
        )
        .join(
            subq,
            (TrainRun.train_id == subq.c.train_id) &
            (TrainRun.run_date == subq.c.latest_date),
        )
        .all()
    )


def _persist_disruption(db: Session, req: DisruptionRequest) -> Disruption:
    d = Disruption(
        disruption_type=req.type.value,
        description=req.description,
        section_code=req.section,
        severity=req.severity.value,
        impact_minutes=req.impact_minutes,
        is_active=True,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


def _disruption_to_info(d: Disruption) -> DisruptionInfo:
    return DisruptionInfo(
        id=d.id,
        type=d.disruption_type,
        description=d.description,
        severity=d.severity,
        section=d.section_code,
        impact_minutes=d.impact_minutes,
        is_active=d.is_active,
        created_at=d.created_at.isoformat(),
        cleared_at=d.cleared_at.isoformat() if d.cleared_at else None,
    )


def _persist_eta_prediction(
    db: Session,
    run: TrainRun,
    eta_resp,            # M3 ETAResponse
) -> EtaPrediction | None:
    """Persist a new EtaPrediction row and return it."""
    # Resolve target station
    target: Station | None = None
    if run.next_station_id:
        target = run.next_station
    elif eta_resp.next_station:
        target = (
            db.query(Station)
            .filter(Station.name == eta_resp.next_station)
            .first()
        )
    if target is None:
        return None

    improvement = int(
        (eta_resp.scheduled_arrival - eta_resp.predicted_eta).total_seconds() / 60
    )
    pred = EtaPrediction(
        train_run_id=run.id,
        target_station_id=target.id,
        predicted_at=datetime.now(tz=timezone.utc),
        scheduled_eta=_ensure_tz(eta_resp.scheduled_arrival),
        current_eta=None,
        ai_eta=_ensure_tz(eta_resp.predicted_eta),
        eta_lower=_ensure_tz(eta_resp.eta_lower),
        eta_upper=_ensure_tz(eta_resp.eta_upper),
        uncertainty_minutes=int(round(eta_resp.uncertainty_minutes)),
        improvement_min=improvement,
        model_version="network_xgb_v1_disruption",
    )
    db.add(pred)
    db.flush()
    return pred


def _eta_change_minutes(before, after) -> float:
    """Return signed minute delta: positive = later after disruption."""
    try:
        b = before.predicted_eta
        a = after.predicted_eta
        return round((a - b).total_seconds() / 60, 1)
    except Exception:
        return 0.0


# ---------------------------------------------------------------------------
# Public API — POST /api/disruptions
# ---------------------------------------------------------------------------

def inject_disruption(db: Session, req: DisruptionRequest) -> DisruptionResponse:
    """
    1. Persist disruption record.
    2. Get BEFORE ETA for all active trains (baseline M3 call).
    3. Apply feature overrides, get AFTER ETA (disrupted M3 call).
    4. Persist new ETA predictions.
    5. Return before/after response.
    """
    disruption = _persist_disruption(db, req)
    runs = _active_runs_today(db)

    results: list[TrainDisruptionResult] = []
    affected_train_ids: list[str] = []

    for run in runs:
        train_id = run.train.number if run.train else str(run.train_id)

        # ── BEFORE ETA ─────────────────────────────────────────────────────
        before_eta = m3_adapter.get_eta_from_engine(run, db)
        if before_eta is None:
            results.append(TrainDisruptionResult(
                train_id=train_id,
                status="no_eta_available",
                reason="M3 could not produce baseline ETA (missing route data)",
            ))
            continue

        # ── Build feature overrides ────────────────────────────────────────
        overrides = _build_feature_overrides(
            disruption_type=req.type.value,
            impact_minutes=req.impact_minutes,
            run=run,
        )

        # ── AFTER ETA ──────────────────────────────────────────────────────
        after_eta = m3_adapter.get_eta_from_engine_with_overrides(run, db, overrides)
        if after_eta is None:
            results.append(TrainDisruptionResult(
                train_id=train_id,
                status="no_eta_available",
                reason="M3 could not produce disrupted ETA",
            ))
            continue

        # ── Persist new ETA prediction (after-disruption) ──────────────────
        _persist_eta_prediction(db, run, after_eta)

        delta = _eta_change_minutes(before_eta, after_eta)
        affected_train_ids.append(train_id)

        results.append(TrainDisruptionResult(
            train_id=train_id,
            status="recalculated",
            before_eta=_fmt(_ensure_tz(before_eta.predicted_eta)),
            after_eta=_fmt(_ensure_tz(after_eta.predicted_eta)),
            before_eta_lower=_fmt(_ensure_tz(before_eta.eta_lower)),
            before_eta_upper=_fmt(_ensure_tz(before_eta.eta_upper)),
            after_eta_lower=_fmt(_ensure_tz(after_eta.eta_lower)),
            after_eta_upper=_fmt(_ensure_tz(after_eta.eta_upper)),
            eta_change_minutes=delta,
            predicted_delay_minutes=int(round(after_eta.predicted_delay)),
            uncertainty_minutes=int(round(after_eta.uncertainty_minutes)),
        ))

    db.commit()

    return DisruptionResponse(
        disruption=_disruption_to_info(disruption),
        affected_trains=affected_train_ids,
        results=results,
    )


# ---------------------------------------------------------------------------
# Public API — POST /api/disruptions/clear
# ---------------------------------------------------------------------------

def clear_disruptions(db: Session) -> ClearDisruptionsResponse:
    """
    1. Mark all active disruptions as cleared.
    2. Re-run M3 baseline (no overrides) for all active trains.
    3. Persist new EtaPrediction rows.
    4. Return updated ETAs.
    """
    now = datetime.now(tz=timezone.utc)
    cleared = (
        db.query(Disruption)
        .filter(Disruption.is_active == True)  # noqa: E712
        .all()
    )
    for d in cleared:
        d.is_active = False
        d.cleared_at = now
    db.flush()

    runs = _active_runs_today(db)
    results: list[TrainDisruptionResult] = []

    for run in runs:
        train_id = run.train.number if run.train else str(run.train_id)
        baseline = m3_adapter.get_eta_from_engine(run, db)
        if baseline is None:
            results.append(TrainDisruptionResult(
                train_id=train_id,
                status="no_eta_available",
                reason="M3 could not produce baseline ETA after clear",
            ))
            continue

        _persist_eta_prediction(db, run, baseline)

        results.append(TrainDisruptionResult(
            train_id=train_id,
            status="recalculated",
            after_eta=_fmt(_ensure_tz(baseline.predicted_eta)),
            after_eta_lower=_fmt(_ensure_tz(baseline.eta_lower)),
            after_eta_upper=_fmt(_ensure_tz(baseline.eta_upper)),
            predicted_delay_minutes=int(round(baseline.predicted_delay)),
            uncertainty_minutes=int(round(baseline.uncertainty_minutes)),
        ))

    db.commit()
    return ClearDisruptionsResponse(cleared_count=len(cleared), results=results)


# ---------------------------------------------------------------------------
# Public API — GET /api/disruptions
# ---------------------------------------------------------------------------

def get_active_disruptions(db: Session) -> list[Disruption]:
    return (
        db.query(Disruption)
        .filter(Disruption.is_active == True)  # noqa: E712
        .order_by(Disruption.created_at.desc())
        .all()
    )
