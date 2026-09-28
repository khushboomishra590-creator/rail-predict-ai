"""
eta_service.py
==============
Orchestrates ETA retrieval, M3 engine calls, and DB persistence.

Flow
----
GET /api/trains/{id}/eta
    └─► get_single_eta(db, train_number)
            └─► call_dynamic_eta_engine(run, db)
                    └─► m3_adapter.get_eta_from_engine(run, db)
                            └─► ETAService.calculate_eta(ETAInput)   ← REAL M3 CALL
                                    └─► FeatureBuilder → predict.py → XGBoost
                                    └─► returns ETAResponse
            └─► persist EtaPrediction row
            └─► serialize to SingleEtaResponse JSON

GET /api/trains/{id}/route-eta
    └─► get_route_eta(db, train_number)
            └─► m3_adapter.get_route_eta_from_engine(run, db)
                    └─► RouteETAService.calculate_route(Route)       ← REAL M3 CALL
                    └─► returns RouteETAResponse
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session, joinedload

from backend.models.models import EtaPrediction, Route, Station, TrainRun
from backend.schemas.eta import EtaStationEntry, RouteEtaResponse, SingleEtaResponse
from backend.services.train_service import get_train_by_number

# M3 adapter — real engine call (no stub)
from backend.services import m3_adapter


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _fmt(dt: datetime | None) -> str:
    """Serialise a datetime to ISO-8601 string, or empty string."""
    if dt is None:
        return ""
    return dt.isoformat()


def _ensure_tz(dt: datetime) -> datetime:
    """Attach UTC timezone if datetime is naive (M3 returns tz-naive datetimes)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _latest_prediction(db: Session, train_run_id: int) -> EtaPrediction | None:
    """Fetch the most recently persisted ETA prediction row for this run."""
    return (
        db.query(EtaPrediction)
        .filter(EtaPrediction.train_run_id == train_run_id)
        .order_by(EtaPrediction.predicted_at.desc())
        .first()
    )


def _build_eta_entry(
    train_number: str,
    run: TrainRun,
    pred: EtaPrediction,
) -> EtaStationEntry:
    """Map ORM EtaPrediction + TrainRun → EtaStationEntry response schema."""
    current_station_name = run.current_station.name if run.current_station else ""
    next_station_name    = run.next_station.name    if run.next_station    else ""

    predicted_delay = int(
        (pred.ai_eta - pred.scheduled_eta).total_seconds() / 60
    ) if pred.ai_eta and pred.scheduled_eta else 0

    delay_adjustment = pred.improvement_min or 0

    return EtaStationEntry(
        train_id=train_number,
        current_station=current_station_name,
        next_station=next_station_name,
        current_speed=run.current_speed_kmh or 0,
        current_delay=run.current_delay_min,
        scheduled_eta=_fmt(pred.scheduled_eta),
        predicted_eta=_fmt(pred.ai_eta),
        predicted_delay=predicted_delay,
        eta_lower=_fmt(pred.eta_lower),
        eta_upper=_fmt(pred.eta_upper),
        uncertainty_minutes=pred.uncertainty_minutes or 0,
        delay_adjustment=delay_adjustment,
        last_updated=_fmt(run.updated_at),
    )


# ---------------------------------------------------------------------------
# Real M3 engine call (replaces the former stub)
# ---------------------------------------------------------------------------

def call_dynamic_eta_engine(run: TrainRun, db: Session) -> EtaPrediction | None:
    """
    Call M3 ETAService.calculate_eta() via m3_adapter and persist the result
    as an EtaPrediction row.

    Returns the freshly persisted EtaPrediction, or None if M3 cannot produce
    a result (missing data).

    ── M3 CALL CHAIN ──────────────────────────────────────────────────────────
    m3_adapter.get_eta_from_engine(run, db)
      → _build_eta_input(run, db)           builds ETAInput from DB
          → ETAService.calculate_eta(eta_input)
              → FeatureBuilder.build(eta_input)   builds MLInput (15 features)
              → dynamic_eta.calculate_next_station_eta()
                  → predict.get_prediction_with_uncertainty()
                      → network_xgb_model.pkl      ← REAL XGBoost inference
                  → returns ETAResponse
    """
    eta_response = m3_adapter.get_eta_from_engine(run, db)
    if eta_response is None:
        return None

    # Resolve target station DB id from next_station name
    target_station: Station | None = None
    if run.next_station_id:
        target_station = run.next_station
    elif eta_response.next_station:
        target_station = (
            db.query(Station)
            .filter(Station.name == eta_response.next_station)
            .first()
        )

    if target_station is None:
        return None

    # improvement_min = scheduled_arrival - predicted_eta (negative = faster)
    improvement = int(
        (eta_response.scheduled_arrival - eta_response.predicted_eta).total_seconds() / 60
    )

    pred = EtaPrediction(
        train_run_id=run.id,
        target_station_id=target_station.id,
        predicted_at=datetime.now(tz=timezone.utc),
        scheduled_eta=_ensure_tz(eta_response.scheduled_arrival),
        current_eta=None,
        ai_eta=_ensure_tz(eta_response.predicted_eta),
        eta_lower=_ensure_tz(eta_response.eta_lower),
        eta_upper=_ensure_tz(eta_response.eta_upper),
        uncertainty_minutes=int(round(eta_response.uncertainty_minutes)),
        improvement_min=improvement,
        model_version="network_xgb_v1",
    )
    db.add(pred)
    db.commit()
    db.refresh(pred)
    return pred


# ---------------------------------------------------------------------------
# GET /api/trains/{train_id}/eta
# ---------------------------------------------------------------------------

def get_single_eta(db: Session, train_number: str) -> SingleEtaResponse | None:
    """
    1. Find today's TrainRun.
    2. Call M3 engine → persist EtaPrediction.
    3. Fall back to last persisted prediction if M3 returns None.
    4. Serialize → SingleEtaResponse.
    """
    train = get_train_by_number(db, train_number)
    if train is None:
        return None

    from datetime import date
    run = (
        db.query(TrainRun)
        .options(
            joinedload(TrainRun.current_station),
            joinedload(TrainRun.next_station),
            joinedload(TrainRun.train),
        )
        .filter(
            TrainRun.train_id == train.id,
            TrainRun.run_date == date.today(),
        )
        .first()
    )
    if run is None:
        return None

    # Try real M3 engine first
    pred = call_dynamic_eta_engine(run, db)

    # Fallback: use last persisted prediction
    if pred is None:
        pred = _latest_prediction(db, run.id)

    if pred is None:
        return None

    # Reload run after commit to get fresh updated_at
    db.refresh(run)
    entry = _build_eta_entry(train.number, run, pred)
    return SingleEtaResponse(**entry.model_dump())


# ---------------------------------------------------------------------------
# GET /api/trains/{train_id}/route-eta
# ---------------------------------------------------------------------------

def get_route_eta(db: Session, train_number: str) -> RouteEtaResponse | None:
    """
    Call M3 RouteETAService.calculate_route() for all remaining stops.
    Persists one EtaPrediction row per station.
    Serializes to RouteEtaResponse.
    """
    train = get_train_by_number(db, train_number)
    if train is None:
        return None

    from datetime import date
    run = (
        db.query(TrainRun)
        .options(
            joinedload(TrainRun.current_station),
            joinedload(TrainRun.next_station),
            joinedload(TrainRun.train),
        )
        .filter(
            TrainRun.train_id == train.id,
            TrainRun.run_date == date.today(),
        )
        .first()
    )
    if run is None:
        return None

    # Call real M3 route engine
    route_response = m3_adapter.get_route_eta_from_engine(run, db)

    if route_response is None:
        # Fall back: build response from latest persisted predictions per station
        route_stops = (
            db.query(Route)
            .filter(Route.train_id == train.id)
            .order_by(Route.stop_sequence)
            .all()
        )
        predictions: dict[int, EtaPrediction] = {}
        for p in (
            db.query(EtaPrediction)
            .filter(EtaPrediction.train_run_id == run.id)
            .order_by(EtaPrediction.predicted_at.desc())
            .all()
        ):
            if p.target_station_id not in predictions:
                predictions[p.target_station_id] = p

        entries = [
            _build_eta_entry(train.number, run, predictions[stop.station_id])
            for stop in route_stops
            if stop.station_id in predictions
        ]
        if not entries:
            return None
        return RouteEtaResponse(
            train_id=train.number,
            updated_at=_fmt(run.updated_at),
            stations=entries,
        )

    # Persist one EtaPrediction per station from M3 route result
    db.refresh(run)
    entries: list[EtaStationEntry] = []

    for station_result in route_response.stations:
        # Resolve station DB id
        target = (
            db.query(Station)
            .filter(Station.name == station_result.station)
            .first()
        )
        if target is None:
            continue

        improvement = int(
            (station_result.scheduled_eta - station_result.predicted_eta).total_seconds() / 60
        )

        pred = EtaPrediction(
            train_run_id=run.id,
            target_station_id=target.id,
            predicted_at=datetime.now(tz=timezone.utc),
            scheduled_eta=_ensure_tz(station_result.scheduled_eta),
            current_eta=None,
            ai_eta=_ensure_tz(station_result.predicted_eta),
            eta_lower=_ensure_tz(station_result.eta_lower),
            eta_upper=_ensure_tz(station_result.eta_upper),
            uncertainty_minutes=int(round(
                (station_result.eta_upper - station_result.eta_lower).total_seconds() / 120
            )),
            improvement_min=improvement,
            model_version="network_xgb_v1",
        )
        db.add(pred)
        db.flush()

        entries.append(EtaStationEntry(
            train_id=train.number,
            current_station=run.current_station.name if run.current_station else "",
            next_station=station_result.station,
            current_speed=run.current_speed_kmh or 0,
            current_delay=run.current_delay_min,
            scheduled_eta=_fmt(_ensure_tz(station_result.scheduled_eta)),
            predicted_eta=_fmt(_ensure_tz(station_result.predicted_eta)),
            predicted_delay=int(round(station_result.predicted_delay)),
            eta_lower=_fmt(_ensure_tz(station_result.eta_lower)),
            eta_upper=_fmt(_ensure_tz(station_result.eta_upper)),
            uncertainty_minutes=int(round(
                (station_result.eta_upper - station_result.eta_lower).total_seconds() / 120
            )),
            delay_adjustment=improvement,
            last_updated=_fmt(run.updated_at),
        ))

    db.commit()

    if not entries:
        return None

    return RouteEtaResponse(
        train_id=train.number,
        updated_at=_fmt(run.updated_at),
        stations=entries,
    )
