from app.models.route import Route
from app.models.eta_input import ETAInput
from app.models.eta_response import (
    RouteETAResponse,
    StationETAResponse,
)
from app.services.feature_builder import FeatureBuilder

from scripts.dynamic_eta import calculate_route_eta


class RouteETAService:

    def __init__(self):
        self.feature_builder = FeatureBuilder()

    def calculate_route(self, route: Route) -> RouteETAResponse:

        route_data = []

        for stop in route.stops:

            eta_input = ETAInput(
                train=stop.train,
                timetable=stop.timetable,
                historical=stop.historical,
                network=stop.network,
            )

            ml_input = self.feature_builder.build(eta_input)

            input_data = ml_input.model_dump()

            input_data["train_id"] = stop.train.train_id
            input_data["current_station"] = stop.train.current_station
            input_data["next_station"] = stop.train.next_station
            input_data["current_time"] = stop.train.timestamp

            route_data.append(input_data)

        results = calculate_route_eta(route_data)

        stations = []

        for result in results:

            station = StationETAResponse(
                station=result["next_station"],
                scheduled_eta=result["scheduled_arrival"],
                predicted_eta=result["predicted_eta"],
                predicted_delay=result["predicted_delay"],
                eta_lower=result["eta_lower"],
                eta_upper=result["eta_upper"],
            )

            stations.append(station)

        return RouteETAResponse(
            train_id=route.stops[0].train.train_id,
            updated_at=route.stops[0].train.timestamp,
            stations=stations,
        )