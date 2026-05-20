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
