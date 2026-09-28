from app.models.ml_input import MLInput

from scripts.predict import predict_next_station_delay

class PredictionService:

    def predict(self, ml_input: MLInput) -> float:
        """
        Send MLInput to Member 1's prediction model.

        Returns:
            Predicted next-station delay in minutes.
        """

        input_data = ml_input.model_dump()

        predicted_delay = predict_next_station_delay(input_data)

        return predicted_delay