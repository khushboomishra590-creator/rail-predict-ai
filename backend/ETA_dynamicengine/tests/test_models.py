from app.models.train_state import TrainState
from app.models.timetable import TimetableInfo
from app.models.historical_features import HistoricalFeatures
from app.models.network_state import NetworkState
from app.models.ml_input import MLInput
from datetime import datetime

from app.services.feature_builder import FeatureBuilder
from app.services.prediction_service import PredictionService
from app.services.eta_service import ETAService
from app.services.dynamic_update_service import DynamicUpdateService
from scripts.dynamic_eta import calculate_route_eta
from app.services.route_eta_service import RouteETAService
from app.models.route import Route
from app.models.route_input import RouteInput


from app.models.eta_input import ETAInput
from app.data.demo_data import (
    get_demo_eta_input,
    get_demo_updated_input,get_demo_route,
)
 
print("\n--- DEMO ROUTE DATA ---")

demo_route = get_demo_route()

print(f"Number of stops: {len(demo_route.stops)}")

for stop in demo_route.stops:
    print(
        f"{stop.train.current_station} "
        f"→ {stop.train.next_station}"
    )
print("\n--- DEMO ROUTE ETA ---")

demo_route = get_demo_route()

demo_route_service = RouteETAService()

demo_route_result = demo_route_service.calculate_route(
    demo_route
)

print(f"Train: {demo_route_result.train_id}")
print(f"Updated at: {demo_route_result.updated_at}")

for station in demo_route_result.stations:
    print(
        f"{station.station} → "
        f"ETA: {station.predicted_eta} | "
        f"Delay: {station.predicted_delay:.4f} min | "
        f"Range: {station.eta_lower} - {station.eta_upper}"
    )
    
print("\n--- 0. DEMO DATA ---")

demo_input = get_demo_eta_input()

print(demo_input)
print("\n--- DEMO M3 PIPELINE ---")

demo_eta_service = ETAService()

demo_eta_result = demo_eta_service.calculate_eta(
    eta_input=demo_input
)

print(f"Train: {demo_eta_result.train_id}")
print(f"Next station: {demo_eta_result.next_station}")
print(f"Scheduled ETA: {demo_eta_result.scheduled_arrival}")
print(f"Predicted ETA: {demo_eta_result.predicted_eta}")
print(f"Predicted delay: {demo_eta_result.predicted_delay}")
print(
    f"ETA range: "
    f"{demo_eta_result.eta_lower} - {demo_eta_result.eta_upper}"
)

print("\n--- DEMO DYNAMIC ETA ---")

initial_input = get_demo_eta_input()
updated_input = get_demo_updated_input()

dynamic_service = DynamicUpdateService()

update_result = dynamic_service.update_eta(
    old_train=initial_input.train,
    new_train=updated_input.train,
    timetable=initial_input.timetable,
    historical=initial_input.historical,
    old_network=initial_input.network,
    new_network=updated_input.network,
)

print(f"Initial ETA: {update_result['before'].predicted_eta}")
print(f"Updated ETA: {update_result['after'].predicted_eta}")

print(
    f"ETA change: "
    f"{update_result['eta_change_minutes']:.4f} minutes"
)

print(
    f"Delay change: "
    f"{update_result['delay_change']:.4f} minutes"
)



train = TrainState(
    train_id="12951",
    timestamp="2026-09-24T14:30:00",
    latitude=21.17,
    longitude=72.83,
    current_speed=72.0,
    current_delay=5.2,
    current_section="BRC_SECTION",
    next_station="Vadodara",
    distance_to_next_station=45.0
)

timetable = TimetableInfo(
    train_id="12951",
    next_station="Vadodara",
    scheduled_arrival="2026-09-24T15:08:00"
)

historical = HistoricalFeatures(
    historical_section_median=30.0,
    historical_section_P90=48.0,
    historical_dwell_median=3.0,
    historical_delay=4.5,
    historical_recovery=2.0
)

network = NetworkState(
    preceding_train_delay=3.0,
    headway=7.5,
    distance_to_preceding_train=5.0
)



route_input_1 = RouteInput(
    train=train,
    timetable=timetable,
    historical=historical,
    network=network
)
train_2 = TrainState(
    train_id="12951",
    timestamp="2026-09-24T15:12:00",
    current_speed=70.0,
    current_delay=0.0,
    current_section="BRC_SECTION",
    next_station="Ratlam",
    distance_to_next_station=180.0
)

timetable_2 = TimetableInfo(
    train_id="12951",
    next_station="Ratlam",
    scheduled_arrival="2026-09-24T17:42:00"
)

historical_2 = HistoricalFeatures(
    historical_section_median=120.0,
    historical_section_P90=150.0,
    historical_dwell_median=3.0,
    historical_delay=5.0,
    historical_recovery=2.0
)

network_2 = NetworkState(
    preceding_train_delay=4.0,
    headway=8.0,
    distance_to_preceding_train=6.0
)

route_input_2 = RouteInput(
    train=train_2,
    timetable=timetable_2,
    historical=historical_2,
    network=network_2
)
train_3 = TrainState(
    train_id="12951",
    timestamp="2026-09-24T17:42:00",
    current_speed=68.0,
    current_delay=0.0,
    current_section="AII_SECTION",
    next_station="Kota",
    distance_to_next_station=300.0
)

timetable_3 = TimetableInfo(
    train_id="12951",
    next_station="Kota",
    scheduled_arrival="2026-09-24T21:12:00"
)

historical_3 = HistoricalFeatures(
    historical_section_median=180.0,
    historical_section_P90=220.0,
    historical_dwell_median=4.0,
    historical_delay=6.0,
    historical_recovery=2.5
)

network_3 = NetworkState(
    preceding_train_delay=5.0,
    headway=9.0,
    distance_to_preceding_train=7.0
)

route_input_3 = RouteInput(
    train=train_3,
    timetable=timetable_3,
    historical=historical_3,
    network=network_3
)
print("\n--- 5. ROUTE ETA SERVICE ---")

route_service = RouteETAService()
route = Route(
    stops=[
        route_input_1,
        route_input_2,
        route_input_3
    ]
)
route_result = route_service.calculate_route(route)

print(f"Train: {route_result.train_id}")
print(f"Updated at: {route_result.updated_at}")

for station in route_result.stations:
    print(
        f"{station.station} → "
        f"ETA: {station.predicted_eta} | "
        f"Delay: {station.predicted_delay:.4f} min | "
        f"Range: {station.eta_lower} - {station.eta_upper}"
    )

    eta_input = ETAInput(
    train=train,
    timetable=timetable,
    historical=historical,
    network=network,
)

print("\n--- ETA INPUT ---")
print(eta_input)

feature_builder = FeatureBuilder()

ml_input = feature_builder.build(
    eta_input
)

print("\n--- FEATURE BUILDER ---")
print(ml_input)

print("\n--- 2. PREDICTION SERVICE ---")

prediction_service = PredictionService()

predicted_delay = prediction_service.predict(ml_input)

print(f"Predicted delay: {predicted_delay:.4f} minutes")
print("\n--- 3. ETA SERVICE ---")

eta_service = ETAService()

eta_result = eta_service.calculate_eta(
    eta_input=eta_input
)

print(f"Train: {eta_result.train_id}")
print(f"Next station: {eta_result.next_station}")
print(f"Predicted ETA: {eta_result.predicted_eta}")
print(f"Predicted delay: {eta_result.predicted_delay:.4f} min")
print(
    f"ETA range: "
    f"{eta_result.eta_lower} - {eta_result.eta_upper}"
)
print("\n--- 4. DYNAMIC UPDATE SERVICE ---")

updated_train = train.model_copy(
    update={
        "current_speed": 54.0,
        "current_delay": 9.0
    }
)

dynamic_service = DynamicUpdateService()

update_result = dynamic_service.update_eta(
    old_train=train,
    new_train=updated_train,
    timetable=timetable,
    historical=historical,
    old_network=network,
    new_network=network
)

print(f"Old ETA: {update_result['before'].predicted_eta}")
print(f"New ETA: {update_result['after'].predicted_eta}")

print(
    f"ETA change: "
    f"{update_result['eta_change_minutes']:.4f} minutes"
)

print(
    f"Delay change: "
    f"{update_result['delay_change']:.4f} minutes"
)