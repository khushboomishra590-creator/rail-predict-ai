from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.schemas.eta import RouteEtaResponse, SingleEtaResponse
from backend.services import eta_service

router = APIRouter(prefix="/api/trains", tags=["eta"])


@router.get("/{train_id}/eta", response_model=SingleEtaResponse)
def get_train_eta(train_id: str, db: Session = Depends(get_db)):
    """
    GET /api/trains/{train_id}/eta
    Returns the latest AI ETA for the train's next significant station.
    Falls back to last persisted prediction when engine is unavailable.
    """
    result = eta_service.get_single_eta(db, train_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No ETA data available for train '{train_id}'",
        )
    return result


@router.get("/{train_id}/route-eta", response_model=RouteEtaResponse)
def get_train_route_eta(train_id: str, db: Session = Depends(get_db)):
    """
    GET /api/trains/{train_id}/route-eta
    Returns AI ETAs for every remaining stop on today's run.
    """
    result = eta_service.get_route_eta(db, train_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No route ETA data available for train '{train_id}'",
        )
    return result
