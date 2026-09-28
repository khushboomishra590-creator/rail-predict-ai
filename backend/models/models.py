"""
SQLAlchemy ORM models — mirrors the approved railpredict_db schema exactly.
No extra tables or columns beyond what was reviewed.
"""

from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database.session import Base


# ---------------------------------------------------------------------------
# zones
# ---------------------------------------------------------------------------
class Zone(Base):
    __tablename__ = "zones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    code: Mapped[str] = mapped_column(String(10), nullable=False, unique=True)
    headquarters: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # relationships
    stations: Mapped[list["Station"]] = relationship("Station", back_populates="zone")
    trains: Mapped[list["Train"]] = relationship("Train", back_populates="zone")
    sections: Mapped[list["Section"]] = relationship("Section", back_populates="zone")


# ---------------------------------------------------------------------------
# stations
# ---------------------------------------------------------------------------
class Station(Base):
    __tablename__ = "stations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(10), nullable=False, unique=True)
    zone_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("zones.id", ondelete="SET NULL"), nullable=True
    )
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    map_x: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    map_y: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    is_major: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # relationships
    zone: Mapped["Zone | None"] = relationship("Zone", back_populates="stations")
    trains_as_origin: Mapped[list["Train"]] = relationship(
        "Train", foreign_keys="Train.origin_station_id", back_populates="origin_station"
    )
    trains_as_destination: Mapped[list["Train"]] = relationship(
        "Train",
        foreign_keys="Train.destination_station_id",
        back_populates="destination_station",
    )
    routes: Mapped[list["Route"]] = relationship("Route", back_populates="station")
    sections_from: Mapped[list["Section"]] = relationship(
        "Section", foreign_keys="Section.from_station_id", back_populates="from_station"
    )
    sections_to: Mapped[list["Section"]] = relationship(
        "Section", foreign_keys="Section.to_station_id", back_populates="to_station"
    )
    runs_as_current: Mapped[list["TrainRun"]] = relationship(
        "TrainRun",
        foreign_keys="TrainRun.current_station_id",
        back_populates="current_station",
    )
    runs_as_next: Mapped[list["TrainRun"]] = relationship(
        "TrainRun",
        foreign_keys="TrainRun.next_station_id",
        back_populates="next_station",
    )
    stop_actuals: Mapped[list["StopActual"]] = relationship(
        "StopActual", back_populates="station"
    )
    eta_predictions: Mapped[list["EtaPrediction"]] = relationship(
        "EtaPrediction", back_populates="target_station"
    )
    movements: Mapped[list["TrainMovement"]] = relationship(
        "TrainMovement", back_populates="station"
    )


# ---------------------------------------------------------------------------
# trains
# ---------------------------------------------------------------------------
class Train(Base):
    __tablename__ = "trains"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    number: Mapped[str] = mapped_column(String(10), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    short_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    train_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    origin_station_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stations.id", ondelete="RESTRICT"), nullable=False
    )
    destination_station_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stations.id", ondelete="RESTRICT"), nullable=False
    )
    zone_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("zones.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # relationships
    zone: Mapped["Zone | None"] = relationship("Zone", back_populates="trains")
    origin_station: Mapped["Station"] = relationship(
        "Station", foreign_keys=[origin_station_id], back_populates="trains_as_origin"
    )
    destination_station: Mapped["Station"] = relationship(
        "Station",
        foreign_keys=[destination_station_id],
        back_populates="trains_as_destination",
    )
    routes: Mapped[list["Route"]] = relationship("Route", back_populates="train")
    runs: Mapped[list["TrainRun"]] = relationship("TrainRun", back_populates="train")


# ---------------------------------------------------------------------------
# routes
# ---------------------------------------------------------------------------
class Route(Base):
    __tablename__ = "routes"
    __table_args__ = (
        UniqueConstraint("train_id", "station_id", name="uq_route_train_station"),
        UniqueConstraint("train_id", "stop_sequence", name="uq_route_train_sequence"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    train_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trains.id", ondelete="CASCADE"), nullable=False
    )
    station_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stations.id", ondelete="RESTRICT"), nullable=False
    )
    stop_sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    scheduled_arrival: Mapped[time | None] = mapped_column(Time, nullable=True)
    scheduled_departure: Mapped[time | None] = mapped_column(Time, nullable=True)
    distance_from_origin_km: Mapped[Decimal | None] = mapped_column(
        Numeric(7, 2), nullable=True
    )
    day_offset: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # relationships
    train: Mapped["Train"] = relationship("Train", back_populates="routes")
    station: Mapped["Station"] = relationship("Station", back_populates="routes")


# ---------------------------------------------------------------------------
# sections
# ---------------------------------------------------------------------------
class Section(Base):
    __tablename__ = "sections"
    __table_args__ = (
        UniqueConstraint(
            "from_station_id", "to_station_id", name="uq_section_from_to"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    from_station_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stations.id", ondelete="RESTRICT"), nullable=False
    )
    to_station_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stations.id", ondelete="RESTRICT"), nullable=False
    )
    zone_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("zones.id", ondelete="SET NULL"), nullable=True
    )
    distance_km: Mapped[Decimal | None] = mapped_column(Numeric(7, 2), nullable=True)
    max_speed_kmh: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # relationships
    zone: Mapped["Zone | None"] = relationship("Zone", back_populates="sections")
    from_station: Mapped["Station"] = relationship(
        "Station", foreign_keys=[from_station_id], back_populates="sections_from"
    )
    to_station: Mapped["Station"] = relationship(
        "Station", foreign_keys=[to_station_id], back_populates="sections_to"
    )
    movements: Mapped[list["TrainMovement"]] = relationship(
        "TrainMovement", back_populates="section"
    )
    alerts: Mapped[list["Alert"]] = relationship("Alert", back_populates="section")
    conditions: Mapped[list["SectionCondition"]] = relationship(
        "SectionCondition", back_populates="section"
    )


# ---------------------------------------------------------------------------
# train_runs
# ---------------------------------------------------------------------------
class TrainRun(Base):
    __tablename__ = "train_runs"
    __table_args__ = (
        UniqueConstraint("train_id", "run_date", name="uq_run_train_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    train_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trains.id", ondelete="RESTRICT"), nullable=False
    )
    run_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="scheduled", nullable=False
    )
    current_station_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("stations.id", ondelete="SET NULL"), nullable=True
    )
    next_station_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("stations.id", ondelete="SET NULL"), nullable=True
    )
    current_speed_kmh: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    current_delay_min: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)
    route_progress_pct: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    map_x: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    map_y: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # relationships
    train: Mapped["Train"] = relationship("Train", back_populates="runs")
    current_station: Mapped["Station | None"] = relationship(
        "Station",
        foreign_keys=[current_station_id],
        back_populates="runs_as_current",
    )
    next_station: Mapped["Station | None"] = relationship(
        "Station", foreign_keys=[next_station_id], back_populates="runs_as_next"
    )
    movements: Mapped[list["TrainMovement"]] = relationship(
        "TrainMovement", back_populates="train_run"
    )
    stop_actuals: Mapped[list["StopActual"]] = relationship(
        "StopActual", back_populates="train_run"
    )
    eta_predictions: Mapped[list["EtaPrediction"]] = relationship(
        "EtaPrediction", back_populates="train_run"
    )
    delay_factors: Mapped[list["DelayFactor"]] = relationship(
        "DelayFactor", back_populates="train_run"
    )
    alerts: Mapped[list["Alert"]] = relationship("Alert", back_populates="train_run")


# ---------------------------------------------------------------------------
# train_movements
# ---------------------------------------------------------------------------
class TrainMovement(Base):
    __tablename__ = "train_movements"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    train_run_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("train_runs.id", ondelete="CASCADE"), nullable=False
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    station_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("stations.id", ondelete="SET NULL"), nullable=True
    )
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    speed_kmh: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    delay_min: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    section_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("sections.id", ondelete="SET NULL"), nullable=True
    )
    source: Mapped[str] = mapped_column(String(30), default="api", nullable=False)

    # relationships
    train_run: Mapped["TrainRun"] = relationship("TrainRun", back_populates="movements")
    station: Mapped["Station | None"] = relationship(
        "Station", back_populates="movements"
    )
    section: Mapped["Section | None"] = relationship(
        "Section", back_populates="movements"
    )


# ---------------------------------------------------------------------------
# stop_actuals
# ---------------------------------------------------------------------------
class StopActual(Base):
    __tablename__ = "stop_actuals"
    __table_args__ = (
        UniqueConstraint(
            "train_run_id", "station_id", name="uq_stop_actual_run_station"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    train_run_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("train_runs.id", ondelete="CASCADE"), nullable=False
    )
    station_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stations.id", ondelete="RESTRICT"), nullable=False
    )
    scheduled_arrival: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    scheduled_departure: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    actual_arrival: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    actual_departure: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    arrival_delay_min: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    departure_delay_min: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    platform: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # relationships
    train_run: Mapped["TrainRun"] = relationship(
        "TrainRun", back_populates="stop_actuals"
    )
    station: Mapped["Station"] = relationship(
        "Station", back_populates="stop_actuals"
    )


# ---------------------------------------------------------------------------
# eta_predictions
# ---------------------------------------------------------------------------
class EtaPrediction(Base):
    __tablename__ = "eta_predictions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    train_run_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("train_runs.id", ondelete="CASCADE"), nullable=False
    )
    target_station_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stations.id", ondelete="RESTRICT"), nullable=False
    )
    predicted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    scheduled_eta: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    current_eta: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ai_eta: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Uncertainty represented as a time window — NO confidence_pct column
    eta_lower: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    eta_upper: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    uncertainty_minutes: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    improvement_min: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    model_version: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # relationships
    train_run: Mapped["TrainRun"] = relationship(
        "TrainRun", back_populates="eta_predictions"
    )
    target_station: Mapped["Station"] = relationship(
        "Station", back_populates="eta_predictions"
    )


# ---------------------------------------------------------------------------
# delay_factors
# ---------------------------------------------------------------------------
class DelayFactor(Base):
    __tablename__ = "delay_factors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    train_run_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("train_runs.id", ondelete="CASCADE"), nullable=False
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    track_congestion_pct: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    preceding_train_delay_pct: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    station_dwell_pct: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    speed_restriction_pct: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    weather_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    other_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)

    # relationships
    train_run: Mapped["TrainRun"] = relationship(
        "TrainRun", back_populates="delay_factors"
    )


# ---------------------------------------------------------------------------
# alerts
# ---------------------------------------------------------------------------
class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    train_run_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("train_runs.id", ondelete="SET NULL"), nullable=True
    )
    section_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("sections.id", ondelete="SET NULL"), nullable=True
    )
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    impact: Mapped[str | None] = mapped_column(String(50), nullable=True)
    recommended_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # relationships
    train_run: Mapped["TrainRun | None"] = relationship(
        "TrainRun", back_populates="alerts"
    )
    section: Mapped["Section | None"] = relationship(
        "Section", back_populates="alerts"
    )


# ---------------------------------------------------------------------------
# section_conditions
# ---------------------------------------------------------------------------
class SectionCondition(Base):
    __tablename__ = "section_conditions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    section_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sections.id", ondelete="CASCADE"), nullable=False
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    condition_type: Mapped[str] = mapped_column(String(30), nullable=False)
    severity: Mapped[str | None] = mapped_column(String(20), nullable=True)
    delay_impact_min: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # relationships
    section: Mapped["Section"] = relationship(
        "Section", back_populates="conditions"
    )
