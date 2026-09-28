from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class TrainState(BaseModel):
    train_id: str
    timestamp: datetime

    latitude: Optional[float] = None
    longitude: Optional[float] = None

    current_speed: Optional[float] = None
    current_delay: float = 0.0

    current_station: Optional[str] = None
    current_section: Optional[str] = None
    next_station: Optional[str] = None

    distance_to_next_station: Optional[float] = None