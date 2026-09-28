"""
ETA response schemas — exact JSON contract agreed with M3/M1.

Uncertainty is represented ONLY as eta_lower, eta_upper, uncertainty_minutes.
There is NO confidence_pct field anywhere in these schemas.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class EtaStationEntry(BaseModel):
    """
    Single-station ETA entry used both as the top-level response for
    GET /api/trains/{train_id}/eta  and  as each element of the
    `stations` list in GET /api/trains/{train_id}/route-eta.
    """
    train_id: str
    current_station: str
    next_station: str
    current_speed: int
    current_delay: int            # minutes
    scheduled_eta: str            # ISO-8601 datetime string
    predicted_eta: str            # AI ETA — ISO-8601 datetime string
    predicted_delay: int          # minutes vs schedule
    eta_lower: str                # lower bound — ISO-8601 datetime string
    eta_upper: str                # upper bound — ISO-8601 datetime string
    uncertainty_minutes: int      # half-width of the uncertainty window
    delay_adjustment: int         # delta applied by the engine (minutes)
    last_updated: str             # ISO-8601 datetime string


class SingleEtaResponse(EtaStationEntry):
    """
    Response body for GET /api/trains/{train_id}/eta
    Identical fields to EtaStationEntry — aliased for clarity.
    """
    model_config = ConfigDict(from_attributes=False)


class RouteEtaResponse(BaseModel):
    """
    Response body for GET /api/trains/{train_id}/route-eta
    Contains one EtaStationEntry per remaining stop on the route.
    """
    train_id: str
    updated_at: str               # ISO-8601 datetime string
    stations: list[EtaStationEntry]

    model_config = ConfigDict(from_attributes=False)
