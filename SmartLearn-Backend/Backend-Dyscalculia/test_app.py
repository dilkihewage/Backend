"""Regression tests for the Dyscalculia digit prediction API."""

import base64
import io
import unittest

import numpy as np
from PIL import Image, ImageDraw

import app as prediction_app


class FakeDigitModel:
    def predict(self, image_array, verbose=0):
        assert image_array.shape == (1, 28, 28, 1)
        probabilities = np.zeros((1, 10), dtype=np.float32)
        probabilities[0, 5] = 1.0
        return probabilities


class PredictionApiTests(unittest.TestCase):
    def setUp(self):
        self.original_model = prediction_app.model
        prediction_app.model = FakeDigitModel()
        self.client = prediction_app.app.test_client()

    def tearDown(self):
        prediction_app.model = self.original_model

    def test_predicts_a_base64_canvas(self):
        image = Image.new("RGB", (120, 120), "white")
        draw = ImageDraw.Draw(image)
        draw.line((80, 20, 40, 60, 80, 100), fill="black", width=10)
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")

        response = self.client.post(
            "/api/dyscalculia/tracing/predict",
            json={"image": f"data:image/png;base64,{encoded}", "actualNumber": 5},
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json["success"])
        self.assertTrue(response.json["isCorrect"])
        self.assertEqual(response.json["predictedNumber"], 5)

    def test_invalid_image_is_a_client_error_instead_of_500(self):
        response = self.client.post(
            "/api/dyscalculia/tracing/predict",
            json={"image": "not-base64", "actualNumber": 5},
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json["success"])


if __name__ == "__main__":
    unittest.main()
