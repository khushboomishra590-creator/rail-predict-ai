from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ETAResponse(BaseModel):
    train_id: str

    current_station: Optional[str] = None
    next_station: Optional[str] = None

    current_time: datetime
    scheduled_arrival: datetime
    predicted_eta: datetime

    current_delay: float
    predicted_delay: float
    delay_adjustment: float

    eta_lower: datetime
    eta_upper: datetime
    uncertainty_minutes: float

    last_updated: datetime

class StationETAResponse(BaseModel):
    station: str

    scheduled_eta: datetime
    predicted_eta: datetime

    predicted_delay: float

    eta_lower: datetime
    eta_upper: datetime

class RouteETAResponse(BaseModel):
    train_id: str
    updated_at: datetime

    stations: list[StationETAResponse]