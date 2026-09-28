from pydantic import BaseModel

from app.models.train_state import TrainState
from app.models.timetable import TimetableInfo
from app.models.historical_features import HistoricalFeatures
from app.models.network_state import NetworkState


class RouteInput(BaseModel):
    train: TrainState
    timetable: TimetableInfo
    historical: HistoricalFeatures
    network: NetworkState