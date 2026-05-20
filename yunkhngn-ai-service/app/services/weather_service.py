import httpx

OPENWEATHER_BASE = "https://api.openweathermap.org/data/2.5/weather"


async def get_current_weather(location: str, api_key: str) -> dict:
    """Returns weather_description, temperature_c, location_name."""
    params = {
        "q": location,
        "appid": api_key,
        "units": "metric",
        "lang": "vi",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(OPENWEATHER_BASE, params=params)
        response.raise_for_status()
        data = response.json()

    return {
        "weather_description": data["weather"][0]["description"],
        "temperature_c": data["main"]["temp"],
        "location_name": data.get("name", "Không rõ"),
    }
