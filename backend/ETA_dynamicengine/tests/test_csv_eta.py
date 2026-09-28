from app.data.csv_data import CSVDataAdapter
from app.data.csv_to_eta import row_to_eta_input

from app.services.feature_builder import FeatureBuilder
from app.services.prediction_service import PredictionService
from app.services.eta_service import ETAService


# ---------------------------------------------------------
# 1. Load one real M2 row
# ---------------------------------------------------------

adapter = CSVDataAdapter(
    "data/SIH26028_demo_railway_eta_dataset.csv"
)

row = adapter.get_feature_row(0)

print("\n--- 1. M2 CSV DATA ---")
print(f"Train: {row['train_id']}")
print(f"Current station: {row['current_station']}")
print(f"Next station: {row['next_station']}")
print(f"Section: {row['section']}")
print(f"Actual delay: {row['next_station_delay']:.4f} min")


# ---------------------------------------------------------
# 2. CSV → ETAInput
# ---------------------------------------------------------

eta_input = row_to_eta_input(row)


# ---------------------------------------------------------
# 3. ETAInput → MLInput
# ---------------------------------------------------------

feature_builder = FeatureBuilder()

ml_input = feature_builder.build(eta_input)


# ---------------------------------------------------------
# 4. M1 prediction
# ---------------------------------------------------------

prediction_service = PredictionService()

prediction = prediction_service.predict(ml_input)

print("\n--- 2. M1 PREDICTION ---")
print(f"Predicted delay: {prediction:.4f} min")


# ---------------------------------------------------------
# 5. M3 ETA calculation
# ---------------------------------------------------------

eta_service = ETAService()

eta_result = eta_service.calculate_eta(
    eta_input
)

print("\n--- 3. M3 ETA RESULT ---")
print(eta_result)
print("\n--- TRAINS WITH MULTIPLE OBSERVATIONS ---")

counts = adapter.df["train_id"].value_counts()

multi_trains = counts[counts > 1]

print(multi_trains)

print("\n--- 12951 OBSERVATIONS ---")

train_rows = adapter.df[
    adapter.df["train_id"].astype(str) == "12951"
].copy()

print(
    train_rows[
        [
            "train_id",
            "date",
            "current_station",
            "next_station",
            "current_delay",
            "current_speed",
            "distance_to_next_station",
            "scheduled_remaining_time"
        ]
    ].head(10).to_string(index=False)
)