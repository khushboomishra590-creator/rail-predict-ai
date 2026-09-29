"""
disruptions.py
==============
FastAPI routes for the Scenario Disruption Planner.

Endpoints:
  POST /api/disruptions         — inject a disruption, recalculate ETAs via M3
  POST /api/disruptions/clear   — clear all active disruptions, restore baseline
  GET  /api/disruptions         — list currently active disruptions
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.schemas.disruption import (
    ActiveDisruptionsResponse,
    ClearDisruptionsResponse,
    DisruptionInfo,
    DisruptionRequest,
    DisruptionResponse,
)
from backend.services import disruption_service

router = APIRouter(prefix="/api/disruptions", tags=["disruptions"])


@router.post(
    "",
    response_model=DisruptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Inject a disruption event and recalculate ETAs via M3 XGBoost",
)
def inject_disruption(
    payload: DisruptionRequest,
    db: Session = Depends(get_db),
) -> DisruptionResponse:
    """
    POST /api/disruptions

    1. Validates and persists the disruption.
    2. Maps the disruption type to M3 feature overrides (only real MLInput features).
    3. Calls the existing M3 ETAService for BEFORE and AFTER predictions.
    4. Persists new EtaPrediction rows.
    5. Returns a structured before/after comparison for all affected trains.
    """
    return disruption_service.inject_disruption(db, payload)


@router.post(
    "/clear",
    response_model=ClearDisruptionsResponse,
    summary="Clear all active disruptions and restore baseline M3 ETAs",
)
def clear_disruptions(
    db: Session = Depends(get_db),
) -> ClearDisruptionsResponse:
    """
    POST /api/disruptions/clear

    Marks all active disruptions as cleared, re-runs M3 baseline prediction
    for all active trains today, persists new EtaPrediction rows, and returns
    the restored ETAs.
    """
    return disruption_service.clear_disruptions(db)


@router.get(
    "",
    response_model=ActiveDisruptionsResponse,
    summary="List currently active disruptions",
)
def list_active_disruptions(
    db: Session = Depends(get_db),
) -> ActiveDisruptionsResponse:
    """
    GET /api/disruptions

    Returns all disruptions where is_active = true.
    Supports the "Active Network Advisories & Cautions" panel in the UI.
    """
    rows = disruption_service.get_active_disruptions(db)
    infos = [
        DisruptionInfo(
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
        for d in rows
    ]
    return ActiveDisruptionsResponse(disruptions=infos, total=len(infos))
