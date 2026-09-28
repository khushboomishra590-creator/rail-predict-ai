from app.data.csv_data import CSVDataAdapter
from app.data.csv_to_eta import row_to_eta_input
from datetime import datetime
from app.models.train_state import TrainState
from app.models.timetable import TimetableInfo
from app.models.historical_features import HistoricalFeatures
from app.models.network_state import NetworkState


from app.models.route import Route
from app.models.route_input import RouteInput
from app.services.route_eta_service import RouteETAService


# ---------------------------------------------------------
# 1. Load M2 dataset
# ---------------------------------------------------------

adapter = CSVDataAdapter(
    "data/SIH26028_demo_railway_eta_dataset.csv"
)


# ---------------------------------------------------------
# 2. Get one real observation
# ---------------------------------------------------------

row = adapter.get_feature_row(0)

eta_input = row_to_eta_input(row)


# ---------------------------------------------------------
# 3. Convert ETAInput → RouteInput
# ---------------------------------------------------------

route_input = RouteInput(
    train=eta_input.train,
    timetable=eta_input.timetable,
    historical=eta_input.historical,
    network=eta_input.network,
)

# ---------------------------------------------------------
# 4. Create 3-stop Route
# ---------------------------------------------------------

# Stop 1 = REAL M2 CSV observation
stop_1 = route_input


# Stop 2 = controlled future route state
stop_2 = RouteInput(
    train=TrainState(
        train_id="22953",
        timestamp=datetime(2025, 9, 10, 16, 1, 30),
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
        train_id="22953",
        next_station="Ratlam",
        scheduled_arrival=datetime(2025, 9, 10, 17, 42),
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


# Stop 3 = controlled future route state
stop_3 = RouteInput(
    train=TrainState(
        train_id="22953",
        timestamp=datetime(2025, 9, 10, 17, 42),
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
        train_id="22953",
        next_station="Kota",
        scheduled_arrival=datetime(2025, 9, 10, 20, 55),
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


route = Route(
    stops=[
        stop_1,
        stop_2,
        stop_3,
    ]
)
# ---------------------------------------------------------
# 5. Run Route ETA Service
# ---------------------------------------------------------

route_service = RouteETAService()

route_result = route_service.calculate_route(route)


# ---------------------------------------------------------
# 6. Display result
# ---------------------------------------------------------

print("\n============================================================")
print("       M3 — CSV → ROUTE ETA INTEGRATION")
print("============================================================")

print(f"Train: {row['train_id']}")
print(f"Current station: {row['current_station']}")
print(f"Next station: {row['next_station']}")

print("\n--- ROUTE RESULT ---")
print(route_result)

print("\n============================================================")
print("              INTEGRATION COMPLETE")
print("============================================================")