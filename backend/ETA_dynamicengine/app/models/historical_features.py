from pydantic import BaseModel


class HistoricalFeatures(BaseModel):
    historical_section_median: float
    historical_section_P90: float
    historical_dwell_median: float
    historical_delay: float
    historical_recovery: float