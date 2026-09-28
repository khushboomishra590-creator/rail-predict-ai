from app.data.csv_data import CSVDataAdapter


adapter = CSVDataAdapter(
    "data/SIH26028_demo_railway_eta_dataset.csv"
)

row = adapter.get_feature_row(0)

print("\n--- CSV DATA TEST ---")

for key, value in row.items():
    print(f"{key}: {value}")