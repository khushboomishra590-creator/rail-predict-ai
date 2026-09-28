from app.data.csv_data import CSVDataAdapter
from app.data.csv_to_eta import row_to_eta_input

from app.services.feature_builder import FeatureBuilder
from app.services.prediction_service import PredictionService
# ---------------------------------------------------------
# 1. Load one real row from M2 dataset
# ---------------------------------------------------------

adapter = CSVDataAdapter(
    "data/SIH26028_demo_railway_eta_dataset.csv"
)

row = adapter.get_feature_row(0)

print("\n--- 1. CSV ROW ---")
print(f"Train: {row['train_id']}")
print(f"Current station: {row['current_station']}")
print(f"Next station: {row['next_station']}")
print(f"Section: {row['section']}")
print(f"Actual next-station delay: {row['next_station_delay']}")


# ---------------------------------------------------------
# 2. Convert CSV → ETAInput
# ---------------------------------------------------------

eta_input = row_to_eta_input(row)

print("\n--- 2. ETA INPUT ---")
print(eta_input)


# ---------------------------------------------------------
# 3. Build M1 feature input
# ---------------------------------------------------------

feature_builder = FeatureBuilder()

ml_input = feature_builder.build(eta_input)
print("\n--- 2. PREDICTION SERVICE ---")

prediction_service = PredictionService()

predicted_delay = prediction_service.predict(ml_input)

print(f"Predicted delay: {predicted_delay:.4f} minutes")

print("\n--- 3. M1 FEATURE INPUT ---")

for key, value in ml_input.model_dump().items():
    print(f"{key}: {value}")


print("\n--- 3. PREDICTION VS ACTUAL ---")

actual_delay = row["next_station_delay"]

print(f"Predicted delay: {predicted_delay:.4f} minutes")
print(f"Actual delay:    {actual_delay:.4f} minutes")
print(f"Absolute error:  {abs(predicted_delay - actual_delay):.4f} minutes")