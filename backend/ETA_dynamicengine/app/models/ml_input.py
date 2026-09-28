from pydantic import BaseModel


class MLInput(BaseModel):
    current_delay: float
    current_speed: float
    distance_to_next_station: float
    scheduled_remaining_time: float

    historical_section_median: float
    historical_section_P90: float
    historical_dwell_median: float
    historical_delay: float
    historical_recovery: float

    time_of_day: int
    day_of_week: int

    section: str

    preceding_train_delay: float
    headway: float
    distance_to_preceding_train: float