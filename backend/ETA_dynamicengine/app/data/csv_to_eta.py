from datetime import datetime, timedelta
from app.models.train_state import TrainState
from app.models.timetable import TimetableInfo
from app.models.historical_features import HistoricalFeatures
from app.models.network_state import NetworkState
from app.data.csv_data import CSVDataAdapter
from app.models.eta_input import ETAInput


def row_to_eta_input(row):
    """
    Convert one CSV row into the existing M3 ETAInput structure.
    """

    # ---------------------------------------------------------
    # Basic time information
    # ---------------------------------------------------------

    date = datetime.strptime(
        str(row["date"]),
        "%Y-%m-%d"
    )

    # The CSV gives us time_of_day and scheduled remaining time.
    # For the MVP we construct a timestamp using the hour.
    timestamp = date.replace(
        hour=int(row["time_of_day"]),
        minute=0,
        second=0
    )

    scheduled_arrival = timestamp + timedelta(
        minutes=float(row["scheduled_remaining_time"])
    )

    # ---------------------------------------------------------
    # Train state
    # ---------------------------------------------------------

    train = TrainState(
        train_id=str(row["train_id"]),
        timestamp=timestamp,

        # CSV does not provide GPS coordinates in this dataset.
        # These are not used by the current 15-feature model.
        latitude=0.0,
        longitude=0.0,

        current_speed=float(row["current_speed"]),
        current_delay=float(row["current_delay"]),

        current_station=row["current_station"],
        current_section=row["section"],

        next_station=row["next_station"],
        distance_to_next_station=float(
            row["distance_to_next_station"]
        )
    )

    # ---------------------------------------------------------
    # Timetable
    # ---------------------------------------------------------

    timetable = TimetableInfo(
        train_id=str(row["train_id"]),
        next_station=row["next_station"],
        scheduled_arrival=scheduled_arrival
    )

    # ---------------------------------------------------------
    # Historical features
    # ---------------------------------------------------------

    historical = HistoricalFeatures(
        historical_section_median=float(
            row["historical_section_median"]
        ),
        historical_section_P90=float(
            row["historical_section_P90"]
        ),
        historical_dwell_median=float(
            row["historical_dwell_median"]
        ),
        historical_delay=float(
            row["historical_delay"]
        ),
        historical_recovery=float(
            row["historical_recovery"]
        )
    )

    # ---------------------------------------------------------
    # Network features
    # ---------------------------------------------------------

    network = NetworkState(
        preceding_train_delay=float(
            row["preceding_train_delay"]
        ),
        headway=float(
            row["headway"]
        ),
        distance_to_preceding_train=float(
            row["distance_to_preceding_train"]
        )
    )

    return ETAInput(
        train=train,
        timetable=timetable,
        historical=historical,
        network=network
    )