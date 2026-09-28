from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_validator


class MovementUpdateRequest(BaseModel):
    """
    Simulated RTIS input — posted to POST /api/trains/{train_id}/update.
    Writes a row to train_movements and refreshes train_runs.

    Optional M3-required fields
    ---------------------------
    current_delay_min : current delay in minutes (updates train_runs).
    current_section   : M3 section code, e.g. "BRC_SECTION".
                        Must be one of M3 VALID_SECTIONS:
                        ADI_SECTION, AII_SECTION, BRC_SECTION,
                        JP_SECTION, SBT_SECTION, ST_SECTION.
                        If omitted, historical lookup uses dataset fallback.
    distance_to_next_station_km : distance to next station (km).
                        Used by M3 FeatureBuilder for scheduled_remaining_time.
                        If omitted, derived from routes table if available.
    """
    train_id: str          # train number, e.g. "12951"
    latitude: Decimal
    longitude: Decimal
    speed: int             # km/h
    timestamp: datetime    # ISO-8601 with timezone

    # Optional M3 fields
    current_delay_min: int = 0
    current_section: str | None = None
    distance_to_next_station_km: float | None = None

    @field_validator("speed")
    @classmethod
    def speed_must_be_positive(cls, v: int) -> int:
        if v < 0:
            raise ValueError("speed must be >= 0")
        return v


class MovementUpdateResponse(BaseModel):
    """Confirmation returned after a movement event is persisted."""
    movement_id: int
    train_run_id: int
    recorded_at: datetime
    message: str = "Movement recorded"

    model_config = ConfigDict(from_attributes=True)
