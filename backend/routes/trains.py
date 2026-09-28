from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.schemas.movement import MovementUpdateRequest, MovementUpdateResponse
from backend.schemas.train import TrainDetailResponse, TrainResponse
from backend.services import train_service

router = APIRouter(prefix="/api/trains", tags=["trains"])


@router.get("", response_model=list[TrainResponse])
def list_trains(db: Session = Depends(get_db)):
    """
    GET /api/trains
    Return every train in the master table.
    """
    return train_service.get_all_trains(db)


@router.get("/{train_id}", response_model=TrainDetailResponse)
def get_train(train_id: str, db: Session = Depends(get_db)):
    """
    GET /api/trains/{train_id}
    train_id is the train number, e.g. "12951".
    """
    train = train_service.get_train_by_number(db, train_id)
    if train is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Train '{train_id}' not found",
        )
    return train


@router.post(
    "/{train_id}/update",
    response_model=MovementUpdateResponse,
    status_code=status.HTTP_201_CREATED,
)
def update_train_position(
    train_id: str,
    payload: MovementUpdateRequest,
    db: Session = Depends(get_db),
):
    """
    POST /api/trains/{train_id}/update
    Simulated RTIS input — persists a movement_event row.
    The train_id in the URL must match payload.train_id.
    """
    if payload.train_id != train_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="URL train_id must match payload train_id",
        )
    try:
        movement = train_service.record_movement(db, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc

    return MovementUpdateResponse(
        movement_id=movement.id,
        train_run_id=movement.train_run_id,
        recorded_at=movement.recorded_at,
    )
