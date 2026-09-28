from app.data.csv_data import CSVDataAdapter
from app.data.csv_to_eta import row_to_eta_input

from app.services.feature_builder import FeatureBuilder
from app.services.prediction_service import PredictionService
import numpy as np

adapter = CSVDataAdapter(
    "data/SIH26028_demo_railway_eta_dataset.csv"
)

feature_builder = FeatureBuilder()
prediction_service = PredictionService()

predictions = []
actuals = []


for i in range(len(adapter.df)):

    row = adapter.get_feature_row(i)

    eta_input = row_to_eta_input(row)

    ml_input = feature_builder.build(eta_input)

    prediction = prediction_service.predict(ml_input)

    actual = row["next_station_delay"]

    predictions.append(float(prediction))
    actuals.append(float(actual))


print("\n--- BATCH EVALUATION ---")
print(f"Samples evaluated: {len(predictions)}")


predictions = np.array(predictions)
actuals = np.array(actuals)

errors = predictions - actuals

mae = np.mean(np.abs(errors))
rmse = np.sqrt(np.mean(errors ** 2))
mean_error = np.mean(errors)

print(f"MAE:         {mae:.4f} minutes")
print(f"RMSE:        {rmse:.4f} minutes")
print(f"Mean error:  {mean_error:.4f} minutes")