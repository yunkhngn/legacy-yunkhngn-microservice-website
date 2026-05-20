import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from app.services.weather_service import get_current_weather


class TestGetCurrentWeather:
    @pytest.mark.asyncio
    async def test_returns_weather_data(self):
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "weather": [{"description": "mây thưa"}],
            "main": {"temp": 32.5},
            "name": "Hà Nội",
        }

        with patch("app.services.weather_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await get_current_weather(lat=21.0285, lon=105.8542, api_key="test-key")

        assert result["weather_description"] == "mây thưa"
        assert result["temperature_c"] == 32.5
        assert result["location_name"] == "Hà Nội"

    @pytest.mark.asyncio
    async def test_raises_on_http_error(self):
        with patch("app.services.weather_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(
                side_effect=httpx.HTTPStatusError("error", request=MagicMock(), response=MagicMock())
            )
            mock_client_cls.return_value = mock_client

            with pytest.raises(httpx.HTTPStatusError):
                await get_current_weather(lat=21.0285, lon=105.8542, api_key="test-key")
