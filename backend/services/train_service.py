"""
train_service.py — DB operations for trains, train_runs, and train_movements.
"""

from datetime import date, datetime, timezone

from sqlalchemy.orm import Session, joinedload

from backend.models.models import Train, TrainMovement, TrainRun
from backend.schemas.movement import MovementUpdateRequest


def get_all_trains(db: Session) -> list[Train]:
    return db.query(Train).order_by(Train.number).all()


def get_train_by_number(db: Session, train_number: str) -> Train | None:
    return (
        db.query(Train)
        .options(
            joinedload(Train.origin_station),
            joinedload(Train.destination_station),
        )
        .filter(Train.number == train_number)
        .first()
    )


def get_or_create_run(db: Session, train: Train, run_date: date) -> TrainRun:
    """
    Return the existing TrainRun for this train+date, or create one
    with status='running'.
    """
    run = (
        db.query(TrainRun)
        .filter(TrainRun.train_id == train.id, TrainRun.run_date == run_date)
        .first()
    )
    if run is None:
        run = TrainRun(
            train_id=train.id,
            run_date=run_date,
            status="running",
            current_delay_min=0,
        )
        db.add(run)
        db.flush()  # get the id without committing
    return run


def record_movement(
    db: Session, payload: MovementUpdateRequest
) -> TrainMovement:
    """
    Write a movement event row and refresh the parent TrainRun's live fields.
    Called by POST /api/trains/{train_id}/update.
    """
    train = get_train_by_number(db, payload.train_id)
    if train is None:
        raise ValueError(f"Train '{payload.train_id}' not found")

    run_date = payload.timestamp.date()
    run = get_or_create_run(db, train, run_date)

    # Persist movement row
    movement = TrainMovement(
        train_run_id=run.id,
        recorded_at=payload.timestamp,
        latitude=payload.latitude,
        longitude=payload.longitude,
        speed_kmh=payload.speed,
        delay_min=payload.current_delay_min,
        source="rtis",
    )
    db.add(movement)

    # Refresh live snapshot on the run
    run.current_speed_kmh = payload.speed
    run.current_delay_min = payload.current_delay_min
    run.updated_at = datetime.now(tz=timezone.utc)

    # If no station context on this run, copy from the most recent run for
    # this train (handles the case where a new run is created mid-journey)
    if run.current_station_id is None or run.next_station_id is None:
        from backend.models.models import TrainRun as TR
        prev_run = (
            db.query(TR)
            .filter(
                TR.train_id == train.id,
                TR.id != run.id,
                TR.current_station_id.isnot(None),
            )
            .order_by(TR.run_date.desc())
            .first()
        )
        if prev_run:
            if run.current_station_id is None:
                run.current_station_id = prev_run.current_station_id
            if run.next_station_id is None:
                run.next_station_id = prev_run.next_station_id

    db.commit()
    db.refresh(movement)
    return movement
