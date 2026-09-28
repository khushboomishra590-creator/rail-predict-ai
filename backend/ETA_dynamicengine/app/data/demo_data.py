from datetime import datetime

from app.models.eta_input import ETAInput
from app.models.train_state import TrainState
from app.models.timetable import TimetableInfo
from app.models.historical_features import HistoricalFeatures
from app.models.network_state import NetworkState
from app.models.route import Route
from app.models.route_input import RouteInput

def get_demo_eta_input() -> ETAInput:

    train = TrainState(
        train_id="12951",
        timestamp=datetime(2026, 9, 24, 14, 30),
        latitude=21.17,
        longitude=72.83,
        current_speed=72.0,
        current_delay=5.2,
        current_station=None,
        current_section="BRC_SECTION",
        next_station="Vadodara",
        distance_to_next_station=45.0,
    )

    timetable = TimetableInfo(
        train_id="12951",
        next_station="Vadodara",
        scheduled_arrival=datetime(2026, 9, 24, 15, 8),
    )

    historical = HistoricalFeatures(
        historical_section_median=30.0,
        historical_section_P90=48.0,
        historical_dwell_median=3.0,
        historical_delay=4.5,
        historical_recovery=2.0,
    )

    network = NetworkState(
        preceding_train_delay=3.0,
        headway=7.5,
        distance_to_preceding_train=5.0,
    )

    return ETAInput(
        train=train,
        timetable=timetable,
        historical=historical,
        network=network,
    )
def get_demo_updated_input() -> ETAInput:

    eta_input = get_demo_eta_input()

    updated_train = eta_input.train.model_copy(
        update={
            "current_speed": 54.0,
            "current_delay": 9.0,
        }
    )

    updated_network = eta_input.network.model_copy(
        update={
            "preceding_train_delay": 7.0,
        }
    )

    return ETAInput(
        train=updated_train,
        timetable=eta_input.timetable,
        historical=eta_input.historical,
        network=updated_network,
    )
def get_demo_route() -> Route:

    stop_1_data = get_demo_eta_input()

    stop_1 = RouteInput(
       train=stop_1_data.train,
       timetable=stop_1_data.timetable,
       historical=stop_1_data.historical,
       network=stop_1_data.network,
      )

    stop_2 = RouteInput(
        train=TrainState(
            train_id="12951",
            timestamp=datetime(2026, 9, 24, 15, 8),
            latitude=22.30,
            longitude=73.18,
            current_speed=85.0,
            current_delay=3.8,
            current_station="Vadodara",
            current_section="ADI_SECTION",
            next_station="Ratlam",
            distance_to_next_station=210.0,
        ),

        timetable=TimetableInfo(
            train_id="12951",
            next_station="Ratlam",
            scheduled_arrival=datetime(2026, 9, 24, 17, 42),
        ),

        historical=HistoricalFeatures(
            historical_section_median=135.0,
            historical_section_P90=155.0,
            historical_dwell_median=4.0,
            historical_delay=6.0,
            historical_recovery=3.0,
        ),

        network=NetworkState(
            preceding_train_delay=5.0,
            headway=8.0,
            distance_to_preceding_train=7.0,
        ),
    )

    stop_3 = RouteInput(
        train=TrainState(
            train_id="12951",
            timestamp=datetime(2026, 9, 24, 17, 42),
            latitude=24.60,
            longitude=73.72,
            current_speed=82.0,
            current_delay=8.0,
            current_station="Ratlam",
            current_section="JP_SECTION",
            next_station="Kota",
            distance_to_next_station=190.0,
        ),

        timetable=TimetableInfo(
            train_id="12951",
            next_station="Kota",
            scheduled_arrival=datetime(2026, 9, 24, 20, 55),
        ),

        historical=HistoricalFeatures(
            historical_section_median=175.0,
            historical_section_P90=195.0,
            historical_dwell_median=5.0,
            historical_delay=7.0,
            historical_recovery=3.5,
        ),

        network=NetworkState(
            preceding_train_delay=6.0,
            headway=9.0,
            distance_to_preceding_train=10.0,
        ),
    )

    return Route(
        stops=[
            stop_1,
            stop_2,
            stop_3,
        ]
    )