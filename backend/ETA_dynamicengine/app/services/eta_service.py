from datetime import datetime

from app.models.eta_input import ETAInput
from app.models.eta_response import ETAResponse
from app.services.feature_builder import FeatureBuilder

from scripts.dynamic_eta import calculate_next_station_eta


class ETAService:

    def __init__(self):
        self.feature_builder = FeatureBuilder()

    def calculate_eta(
        self,
        eta_input: ETAInput,
        include_explanation: bool = False,
    ) -> ETAResponse:

        ml_input = self.feature_builder.build(eta_input)

        input_data = ml_input.model_dump()

        train = eta_input.train

        input_data["train_id"] = train.train_id
        input_data["current_station"] = train.current_station
        input_data["next_station"] = train.next_station

        result = calculate_next_station_eta(
            current_time=train.timestamp,
            input_data=input_data,
            include_explanation=include_explanation,
        )

        return ETAResponse(
            train_id=result["train_id"],
            current_station=result.get("current_station"),
            next_station=result.get("next_station"),
            current_time=datetime.strptime(
                result["current_time"], "%Y-%m-%d %H:%M:%S"
            ),
            scheduled_arrival=datetime.strptime(
                result["scheduled_arrival"], "%Y-%m-%d %H:%M:%S"
            ),
            predicted_eta=datetime.strptime(
                result["predicted_eta"], "%Y-%m-%d %H:%M:%S"
            ),
            current_delay=result["current_delay"],
            predicted_delay=result["predicted_delay"],
            delay_adjustment=result["delay_adjustment"],
            eta_lower=datetime.strptime(
                result["eta_lower"], "%Y-%m-%d %H:%M:%S"
            ),
            eta_upper=datetime.strptime(
                result["eta_upper"], "%Y-%m-%d %H:%M:%S"
            ),
            uncertainty_minutes=result["uncertainty_minutes"],
            last_updated=train.timestamp,
        )