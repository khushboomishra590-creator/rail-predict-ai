from app.models.eta_input import ETAInput
from app.models.ml_input import MLInput


class FeatureBuilder:

    def build(self, eta_input: ETAInput) -> MLInput:

        train = eta_input.train
        timetable = eta_input.timetable
        historical = eta_input.historical
        network = eta_input.network

        scheduled_remaining_time = (
            timetable.scheduled_arrival - train.timestamp
        ).total_seconds() / 60

        return MLInput(
            current_delay=train.current_delay,
            current_speed=train.current_speed,
            distance_to_next_station=train.distance_to_next_station,
            scheduled_remaining_time=scheduled_remaining_time,
            historical_section_median=historical.historical_section_median,
            historical_section_P90=historical.historical_section_P90,
            historical_dwell_median=historical.historical_dwell_median,
            historical_delay=historical.historical_delay,
            historical_recovery=historical.historical_recovery,
            time_of_day=train.timestamp.hour,
            day_of_week=train.timestamp.weekday(),
            section=train.current_section,
            preceding_train_delay=network.preceding_train_delay,
            headway=network.headway,
            distance_to_preceding_train=network.distance_to_preceding_train,
        )