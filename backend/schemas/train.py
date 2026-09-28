from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Train
# ---------------------------------------------------------------------------
class TrainBase(BaseModel):
    number: str
    name: str
    short_name: str | None = None
    train_type: str | None = None
    origin_station_id: int
    destination_station_id: int
    zone_id: int | None = None


class TrainCreate(TrainBase):
    pass


class TrainResponse(TrainBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Station (minimal — used inside train responses)
# ---------------------------------------------------------------------------
class StationBrief(BaseModel):
    id: int
    name: str
    code: str

    model_config = ConfigDict(from_attributes=True)


class TrainDetailResponse(BaseModel):
    """Full train detail including resolved station names."""
    id: int
    number: str
    name: str
    short_name: str | None
    train_type: str | None
    origin_station: StationBrief
    destination_station: StationBrief
    zone_id: int | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# TrainRun status (embedded in list responses)
# ---------------------------------------------------------------------------
class TrainRunBrief(BaseModel):
    id: int
    run_date: str                    # ISO date string
    status: str
    current_delay_min: int
    route_progress_pct: Decimal | None

    model_config = ConfigDict(from_attributes=True)
