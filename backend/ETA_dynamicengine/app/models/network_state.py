from pydantic import BaseModel
class NetworkState(BaseModel):
    preceding_train_delay: float
    headway: float
    distance_to_preceding_train: float