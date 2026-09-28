import pandas as pd
from pathlib import Path


class CSVDataAdapter:

    def __init__(self, csv_path):
        self.csv_path = Path(csv_path)
        self.df = pd.read_csv(self.csv_path)

    def get_row(self, index=0):
        return self.df.iloc[index]

    def get_rows(self, n=5):
        return self.df.head(n)

    def get_train_rows(self, train_id):
        return self.df[self.df["train_id"] == train_id]

    def get_feature_row(self, index=0):
        row = self.get_row(index)

        return {
            "train_id": str(row["train_id"]),
            "date": row["date"],

            "current_station": row["current_station"],
            "next_station": row["next_station"],
            "section": row["section"],

            "current_delay": float(row["current_delay"]),
            "current_speed": float(row["current_speed"]),
            "distance_to_next_station": float(
                row["distance_to_next_station"]
            ),
            "scheduled_remaining_time": float(
                row["scheduled_remaining_time"]
            ),

            "historical_section_median": float(
                row["historical_section_median"]
            ),
            "historical_section_P90": float(
                row["historical_section_P90"]
            ),
            "historical_dwell_median": float(
                row["historical_dwell_median"]
            ),
            "historical_delay": float(
                row["historical_delay"]
            ),
            "historical_recovery": float(
                row["historical_recovery"]
            ),

            "time_of_day": int(row["time_of_day"]),
            "day_of_week": int(row["day_of_week"]),

            "preceding_train_delay": float(
                row["preceding_train_delay"]
            ),
            "headway": float(row["headway"]),
            "distance_to_preceding_train": float(
                row["distance_to_preceding_train"]
            ),

            # Ground truth, used for testing/evaluation
            "next_station_delay": float(
                row["next_station_delay"]
            ),
        }