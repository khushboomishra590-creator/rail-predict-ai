from app.data.demo_data import (
    get_demo_eta_input,
    get_demo_updated_input,
    get_demo_route,
)

from app.services.eta_service import ETAService
from app.services.dynamic_update_service import DynamicUpdateService
from app.services.route_eta_service import RouteETAService


print("=" * 60)
print("        M3 — DYNAMIC ETA ENGINE DEMONSTRATION")
print("=" * 60)

print("\nNOTE: Synthetic/demo data for software integration testing only.")


# ---------------------------------------------------------
# 1. INITIAL ETA
# ---------------------------------------------------------

print("\n--- 1. INITIAL ETA ---")

initial_input = get_demo_eta_input()

eta_service = ETAService()

initial_eta = eta_service.calculate_eta(
    eta_input=initial_input
)

print(f"Train:             {initial_eta.train_id}")
print(f"Next station:      {initial_eta.next_station}")
print(f"Current delay:     {initial_eta.current_delay:.2f} min")
print(f"Scheduled ETA:     {initial_eta.scheduled_arrival}")
print(f"Predicted ETA:     {initial_eta.predicted_eta}")
print(f"Predicted delay:   {initial_eta.predicted_delay:.4f} min")
print(
    f"ETA range:         "
    f"{initial_eta.eta_lower} - {initial_eta.eta_upper}"
)


# ---------------------------------------------------------
# 2. DYNAMIC UPDATE
# ---------------------------------------------------------

print("\n--- 2. DYNAMIC ETA UPDATE ---")

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

old_eta = update_result["before"]
new_eta = update_result["after"]

print(f"Initial ETA:       {old_eta.predicted_eta}")
print(f"Updated ETA:       {new_eta.predicted_eta}")

print(
    f"ETA change:        "
    f"{update_result['eta_change_minutes']:.4f} min"
)

print(
    f"Delay change:      "
    f"{update_result['delay_change']:.4f} min"
)


# ---------------------------------------------------------
# 3. MULTI-STATION ROUTE ETA
# ---------------------------------------------------------

print("\n--- 3. ROUTE ETA ---")

demo_route = get_demo_route()

route_service = RouteETAService()

route_result = route_service.calculate_route(
    demo_route
)

print(f"Train:             {route_result.train_id}")
print(f"Updated at:        {route_result.updated_at}")

for station in route_result.stations:

    print(
        f"\n{station.station}"
        f"\n  Scheduled ETA:   {station.scheduled_eta}"
        f"\n  Predicted ETA:   {station.predicted_eta}"
        f"\n  Predicted delay: {station.predicted_delay:.4f} min"
        f"\n  ETA range:       "
        f"{station.eta_lower} - {station.eta_upper}"
    )


print("\n" + "=" * 60)
print("              M3 DEMONSTRATION COMPLETE")
print("=" * 60)