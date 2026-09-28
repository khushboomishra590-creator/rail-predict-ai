"""
m3_adapter.py
=============
Bridge between M4 (FastAPI / PostgreSQL) and M3 (Dynamic ETA Engine).

DESIGN RULES:
  - No os.chdir()
  - No M3 prediction logic duplicated here
  - No M3 source files modified
  - Constructs real M3 ETAInput from M4 PostgreSQL data
  - Calls real ETAService.calculate_eta() and RouteETAService.calculate_route()

FALLBACKS (documented):
  - distance_to_next_station : routes.distance_from_origin_km diff when
    available; CSV section-median otherwise.
  - current_section          : movement.section FK → "{CODE}_SECTION" when
    set; CSV most-frequent section (BRC_SECTION) otherwise.
  - HistoricalFeatures       : CSV per-section medians via historical_lookup.
  - NetworkState             : CSV dataset medians via historical_lookup.
"""

from __future__ import annotations

import pathlib
import sys
from datetime import date, datetime, time, timedelta, timezone

# ── Add M3 source dirs to sys.path (idempotent, no os.chdir) ──────────────────
_M3_ROOT    = pathlib.Path(__file__).resolve().parent.parent / "ETA_dynamicengine"
_M3_APP     = str(_M3_ROOT)
_M3_SCRIPTS = str(_M3_ROOT / "scripts")

for _p in (_M3_APP, _M3_SCRIPTS):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# ── Real M3 imports ────────────────────────────────────────────────────────────
from app.models.eta_input          import ETAInput
from app.models.train_state        import TrainState
from app.models.timetable          import TimetableInfo
from app.models.historical_features import HistoricalFeatures
from app.models.network_state      import NetworkState
from app.models.route              import Route
from app.models.route_input        import RouteInput
from app.models.eta_response       import ETAResponse, RouteETAResponse
from app.services.eta_service      import ETAService
from app.services.route_eta_service import RouteETAService

# ── M4 imports ─────────────────────────────────────────────────────────────────
from sqlalchemy.orm import Session, joinedload

from backend.models.models import Route as DBRoute, TrainRun, TrainMovement
from backend.services.historical_lookup import get_historical_features, get_network_defaults

# ── Lazy singletons ────────────────────────────────────────────────────────────
_eta_service:   ETAService | None   = None
_route_service: RouteETAService | None = None

def _get_eta_service() -> ETAService:
    global _eta_service
    if _eta_service is None:
        _eta_service = ETAService()
    return _eta_service

def _get_route_service() -> RouteETAService:
    global _route_service
    if _route_service is None:
        _route_service = RouteETAService()
    return _route_service


# ── CSV fallback helpers ───────────────────────────────────────────────────────

def _csv_distance_fallback(section: str | None) -> float:
    """Section-median distance from M2 CSV, or dataset median if not found."""
    import backend.services.historical_lookup as _hl
    _hl._load()
    df = _hl._df
    if df is None:
        return 64.3
    if section and section in df["section"].values:
        return float(df[df["section"] == section]["distance_to_next_station"].median())
    return float(df["distance_to_next_station"].median())


def _csv_section_fallback() -> str:
    """Most-frequent section in M2 CSV."""
    import backend.services.historical_lookup as _hl
    _hl._load()
    df = _hl._df
    if df is None:
        return "BRC_SECTION"
    return str(df["section"].mode()[0])


# ── Internal helpers ───────────────────────────────────────────────────────────

def _combine_date_time(run_date: date, t: time, day_offset: int = 0) -> datetime:
    return datetime.combine(run_date, t) + timedelta(days=day_offset)


def _latest_movement(db: Session, run_id: int) -> TrainMovement | None:
    return (
        db.query(TrainMovement)
        .filter(TrainMovement.train_run_id == run_id)
        .order_by(TrainMovement.recorded_at.desc())
        .first()
    )


def _next_route_stop(db: Session, train_id: int, next_station_id: int | None):
    if next_station_id is None:
        return None
    return (
        db.query(DBRoute)
        .filter(DBRoute.train_id == train_id, DBRoute.station_id == next_station_id)
        .first()
    )


# ── ETAInput builder ───────────────────────────────────────────────────────────

def _build_eta_input(run: TrainRun, db: Session) -> ETAInput | None:
    """
    Construct M3 ETAInput from M4 DB data.
    Returns None if next_station or scheduled_arrival cannot be resolved.

    Fallbacks used (documented):
      section          → CSV most-frequent (BRC_SECTION) when not in DB
      distance         → CSV section-median when not in routes table
      HistoricalFeatures → CSV per-section medians
      NetworkState     → CSV dataset-wide medians
    """
    movement     = _latest_movement(db, run.id)
    train_number = run.train.number if run.train else str(run.train_id)

    # ── section ───────────────────────────────────────────────────────────────
    current_section: str
    if movement and movement.section and movement.section.from_station:
        current_section = f"{movement.section.from_station.code}_SECTION"
    else:
        current_section = _csv_section_fallback()

    # ── distance_to_next_station ──────────────────────────────────────────────
    distance_to_next: float | None = None
    if run.current_station_id and run.next_station_id:
        cur_stop = (
            db.query(DBRoute)
            .filter(DBRoute.train_id == run.train_id,
                    DBRoute.station_id == run.current_station_id)
            .first()
        )
        nxt_stop = _next_route_stop(db, run.train_id, run.next_station_id)
        if (cur_stop and nxt_stop
                and cur_stop.distance_from_origin_km is not None
                and nxt_stop.distance_from_origin_km is not None):
            distance_to_next = float(
                nxt_stop.distance_from_origin_km - cur_stop.distance_from_origin_km
            )

    if distance_to_next is None or distance_to_next <= 0:
        distance_to_next = _csv_distance_fallback(current_section)

    # ── timestamp ─────────────────────────────────────────────────────────────
    if movement:
        ts = movement.recorded_at
        timestamp = ts.replace(tzinfo=None) if ts.tzinfo else ts
    else:
        timestamp = datetime.now().replace(second=0, microsecond=0)

    # ── TrainState ────────────────────────────────────────────────────────────
    train_state = TrainState(
        train_id=train_number,
        timestamp=timestamp,
        latitude=float(movement.latitude)  if (movement and movement.latitude)  else None,
        longitude=float(movement.longitude) if (movement and movement.longitude) else None,
        current_speed=float(run.current_speed_kmh) if run.current_speed_kmh else None,
        current_delay=float(run.current_delay_min),
        current_station=run.current_station.name if run.current_station else None,
        current_section=current_section,
        next_station=run.next_station.name if run.next_station else None,
        distance_to_next_station=distance_to_next,
    )

    # ── TimetableInfo ─────────────────────────────────────────────────────────
    if run.next_station_id is None:
        return None

    nxt_stop = _next_route_stop(db, run.train_id, run.next_station_id)
    if nxt_stop is None or nxt_stop.scheduled_arrival is None:
        return None

    sched_arr = _combine_date_time(run.run_date, nxt_stop.scheduled_arrival, nxt_stop.day_offset)
    if sched_arr < timestamp:
        sched_arr += timedelta(days=1)

    timetable = TimetableInfo(
        train_id=train_number,
        next_station=run.next_station.name,
        scheduled_arrival=sched_arr,
    )

    # ── HistoricalFeatures (CSV) ──────────────────────────────────────────────
    hist = get_historical_features(current_section)
    historical = HistoricalFeatures(
        historical_section_median=hist["historical_section_median"],
        historical_section_P90=hist["historical_section_P90"],
        historical_dwell_median=hist["historical_dwell_median"],
        historical_delay=hist["historical_delay"],
        historical_recovery=hist["historical_recovery"],
    )

    # ── NetworkState (CSV medians) ────────────────────────────────────────────
    net = get_network_defaults()
    network = NetworkState(
        preceding_train_delay=net["preceding_train_delay"],
        headway=net["headway"],
        distance_to_preceding_train=net["distance_to_preceding_train"],
    )

    return ETAInput(
        train=train_state,
        timetable=timetable,
        historical=historical,
        network=network,
    )


# ── Public API ─────────────────────────────────────────────────────────────────

def get_eta_from_engine(run: TrainRun, db: Session) -> ETAResponse | None:
    """Build ETAInput → call M3 ETAService.calculate_eta() → return ETAResponse."""
    db.refresh(run)
    eta_input = _build_eta_input(run, db)
    if eta_input is None:
        return None
    return _get_eta_service().calculate_eta(eta_input)


def get_route_eta_from_engine(run: TrainRun, db: Session) -> RouteETAResponse | None:
    """
    Build Route (list of RouteInput) from remaining stops →
    call M3 RouteETAService.calculate_route() → return RouteETAResponse.
    """
    db.refresh(run)

    all_stops = (
        db.query(DBRoute)
        .options(joinedload(DBRoute.station))
        .filter(DBRoute.train_id == run.train_id)
        .order_by(DBRoute.stop_sequence)
        .all()
    )

    # Remaining stops = stops after current station sequence
    current_seq = 0
    if run.current_station_id:
        for s in all_stops:
            if s.station_id == run.current_station_id:
                current_seq = s.stop_sequence
                break

    remaining = [s for s in all_stops if s.stop_sequence > current_seq]
    if not remaining:
        return None

    movement = _latest_movement(db, run.id)
    if movement:
        ts = movement.recorded_at
        timestamp_base = ts.replace(tzinfo=None) if ts.tzinfo else ts
    else:
        timestamp_base = datetime.now().replace(second=0, microsecond=0)

    train_number      = run.train.number if run.train else str(run.train_id)
    propagated_delay  = float(run.current_delay_min)

    # section for first stop
    first_section: str
    if movement and movement.section and movement.section.from_station:
        first_section = f"{movement.section.from_station.code}_SECTION"
    else:
        first_section = _csv_section_fallback()

    route_stops: list[RouteInput] = []
    prev_time = timestamp_base

    for i, stop in enumerate(remaining):
        if stop.scheduled_arrival is None:
            continue

        sched_arr = _combine_date_time(run.run_date, stop.scheduled_arrival, stop.day_offset)
        if sched_arr < prev_time:
            sched_arr += timedelta(days=1)

        # section: first stop uses live section; subsequent stops use CSV fallback
        section_for_stop = first_section if i == 0 else _csv_section_fallback()

        # distance: derive from routes table; fall back to CSV median
        dist: float | None = None
        if i == 0 and run.current_station_id:
            cur = next((s for s in all_stops if s.station_id == run.current_station_id), None)
            if (cur and cur.distance_from_origin_km is not None
                    and stop.distance_from_origin_km is not None):
                dist = float(stop.distance_from_origin_km - cur.distance_from_origin_km)
        elif i > 0:
            prev = remaining[i - 1]
            if (prev.distance_from_origin_km is not None
                    and stop.distance_from_origin_km is not None):
                dist = float(stop.distance_from_origin_km - prev.distance_from_origin_km)

        if dist is None or dist <= 0:
            dist = _csv_distance_fallback(section_for_stop)

        ts_for_stop = TrainState(
            train_id=train_number,
            timestamp=prev_time,
            latitude=float(movement.latitude)  if (movement and movement.latitude)  else None,
            longitude=float(movement.longitude) if (movement and movement.longitude) else None,
            current_speed=float(run.current_speed_kmh) if run.current_speed_kmh else None,
            current_delay=propagated_delay,
            current_station=run.current_station.name if (i == 0 and run.current_station) else None,
            current_section=section_for_stop,
            next_station=stop.station.name if stop.station else None,
            distance_to_next_station=dist,
        )

        timetable = TimetableInfo(
            train_id=train_number,
            next_station=stop.station.name if stop.station else "",
            scheduled_arrival=sched_arr,
        )

        hist = get_historical_features(section_for_stop)
        historical = HistoricalFeatures(
            historical_section_median=hist["historical_section_median"],
            historical_section_P90=hist["historical_section_P90"],
            historical_dwell_median=hist["historical_dwell_median"],
            historical_delay=hist["historical_delay"],
            historical_recovery=hist["historical_recovery"],
        )

        net = get_network_defaults()
        network = NetworkState(
            preceding_train_delay=net["preceding_train_delay"],
            headway=net["headway"],
            distance_to_preceding_train=net["distance_to_preceding_train"],
        )

        route_stops.append(RouteInput(
            train=ts_for_stop,
            timetable=timetable,
            historical=historical,
            network=network,
        ))

        prev_time = sched_arr

    if not route_stops:
        return None

    return _get_route_service().calculate_route(Route(stops=route_stops))
