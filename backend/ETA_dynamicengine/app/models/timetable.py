from datetime import datetime

from pydantic import BaseModel


class TimetableInfo(BaseModel):
    train_id: str
    next_station: str
    scheduled_arrival: datetime