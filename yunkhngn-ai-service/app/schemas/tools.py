from pydantic import BaseModel


class WhatToEatRequest(BaseModel):
    location: str
    timezone: str


class WhatToEatContext(BaseModel):
    weather_description: str
    temperature_c: float
    meal_type: str
    location_name: str
    current_time_vn: str  # "HH:MM"


class WhatToEatResponse(BaseModel):
    suggestion: str
    context: WhatToEatContext


from typing import List

class MovieSuggestRequest(BaseModel):
    mood: str
    genres: List[str] = []
    language: str = 'vi'

class MovieSuggestResponse(BaseModel):
    suggestion: str


class CalorieEstimateRequest(BaseModel):
    query: str

class CalorieEstimateResponse(BaseModel):
    suggestion: str
