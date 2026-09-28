

from app.models.train_state import TrainState
from app.models.timetable import TimetableInfo
from app.models.historical_features import HistoricalFeatures
from app.models.network_state import NetworkState

from app.services.feature_builder import FeatureBuilder
from app.services.eta_service import ETAService
from app.models.eta_input import ETAInput

class DynamicUpdateService:

    def __init__(self):
        self.feature_builder = FeatureBuilder()
        self.eta_service = ETAService()

    def update_eta(
        self,
        old_train: TrainState,
        new_train: TrainState,
        timetable: TimetableInfo,
        historical: HistoricalFeatures,
        old_network: NetworkState,
        new_network: NetworkState,
    ) -> dict:

        # -------------------------
        # OLD STATE
        # -------------------------

        old_ml_input = self.feature_builder.build(
    ETAInput(
        train=old_train,
        timetable=timetable,
        historical=historical,
        network=old_network,
    )
        )

        old_eta = self.eta_service.calculate_eta(
    eta_input=ETAInput(
        train=old_train,
        timetable=timetable,
        historical=historical,
        network=old_network,
    ),
    include_explanation=False,
)

        # -------------------------
        # NEW STATE
        # -------------------------

        new_ml_input = self.feature_builder.build(
    ETAInput(
        train=new_train,
        timetable=timetable,
        historical=historical,
        network=new_network,
    )
        )

        new_eta = self.eta_service.calculate_eta(
    eta_input=ETAInput(
        train=new_train,
        timetable=timetable,
        historical=historical,
        network=new_network,
    ),
    include_explanation=False,
)

        # -------------------------
        # COMPARE
        # -------------------------

        eta_change_minutes = round(
            (
                new_eta.predicted_eta
                - old_eta.predicted_eta
            ).total_seconds() / 60,
            4,
        )

        delay_change = round(
            new_eta.predicted_delay
            - old_eta.predicted_delay,
            4,
        )

        return {
            "before": old_eta,
            "after": new_eta,
            "eta_change_minutes": eta_change_minutes,
            "delay_change": delay_change,
        }