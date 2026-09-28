from app.data.csv_data import CSVDataAdapter
from app.data.csv_to_eta import row_to_eta_input


adapter = CSVDataAdapter(
    "data/SIH26028_demo_railway_eta_dataset.csv"
)

row = adapter.get_feature_row(0)

eta_input = row_to_eta_input(row)

print("\n--- CSV → ETA INPUT ---")
print(eta_input)

print("\n--- TRAIN ---")
print(eta_input.train)

print("\n--- TIMETABLE ---")
print(eta_input.timetable)

print("\n--- HISTORICAL ---")
print(eta_input.historical)

print("\n--- NETWORK ---")
print(eta_input.network)