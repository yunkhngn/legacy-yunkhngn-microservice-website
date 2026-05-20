from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client():
    app = create_app()
    return TestClient(app)


class TestWhatToEatEndpoint:
    def test_returns_200_with_suggestion(self, client):
        mock_weather = {
            "weather_description": "trời quang",
            "temperature_c": 30.0,
            "location_name": "Hà Nội",
        }

        with patch("app.api.v1.tools.get_current_weather", new=AsyncMock(return_value=mock_weather)), \
             patch("app.api.v1.tools.gemini_service.generate_text", new=AsyncMock(return_value="Bún bò Huế — phù hợp bữa trưa nóng bức.")):

            resp = client.post(
                "/api/v1/tools/what-to-eat",
                headers={"x-openweather-api-key": "test-key"},
                json={"lat": 21.0285, "lon": 105.8542, "timezone": "Asia/Ho_Chi_Minh"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert "suggestion" in data
        assert data["suggestion"] == "Bún bò Huế — phù hợp bữa trưa nóng bức."
        assert "context" in data
        assert data["context"]["meal_type"] in ["sáng", "trưa", "chiều", "tối"]
        assert data["context"]["temperature_c"] == 30.0
        assert data["context"]["location_name"] == "Hà Nội"

    def test_returns_400_when_api_key_missing(self, client):
        resp = client.post(
            "/api/v1/tools/what-to-eat",
            json={"lat": 21.0285, "lon": 105.8542, "timezone": "Asia/Ho_Chi_Minh"},
        )
        assert resp.status_code == 400

    def test_returns_503_on_weather_error(self, client):
        import httpx

        with patch("app.api.v1.tools.get_current_weather",
                   new=AsyncMock(side_effect=httpx.HTTPStatusError("error", request=None, response=None))):
            resp = client.post(
                "/api/v1/tools/what-to-eat",
                headers={"x-openweather-api-key": "test-key"},
                json={"lat": 21.0285, "lon": 105.8542, "timezone": "Asia/Ho_Chi_Minh"},
            )
        assert resp.status_code == 503
