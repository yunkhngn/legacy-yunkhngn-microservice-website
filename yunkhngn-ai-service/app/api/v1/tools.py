import logging
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException

from app.schemas.tools import WhatToEatContext, WhatToEatRequest, WhatToEatResponse
from app.services import gemini_service
from app.services.weather_service import get_current_weather

router = APIRouter()
logger = logging.getLogger(__name__)


def _get_meal_type(hour: int) -> str:
    if 5 <= hour <= 10:
        return "sáng"
    elif 11 <= hour <= 13:
        return "trưa"
    elif 14 <= hour <= 17:
        return "chiều"
    else:
        return "tối"


@router.post("/tools/what-to-eat", response_model=WhatToEatResponse)
async def what_to_eat(
    request: WhatToEatRequest,
    x_openweather_api_key: Optional[str] = Header(None),
    x_gemini_api_key: Optional[str] = Header(None),
    x_gemini_model: Optional[str] = Header(None),
):
    if not x_openweather_api_key:
        raise HTTPException(status_code=400, detail="x-openweather-api-key header is required")

    try:
        weather = await get_current_weather(
            location=request.location,
            api_key=x_openweather_api_key,
        )
    except httpx.HTTPStatusError as e:
        logger.error(f"OpenWeather API error: {e}")
        raise HTTPException(status_code=503, detail="Weather service unavailable")
    except Exception as e:
        logger.error(f"Weather fetch failed: {e}")
        raise HTTPException(status_code=503, detail="Weather service unavailable")

    vn_now = datetime.now(ZoneInfo(request.timezone))
    current_time_vn = vn_now.strftime("%H:%M")
    meal_type = _get_meal_type(vn_now.hour)

    prompt = (
        f"Bạn là chuyên gia tư vấn ẩm thực Việt Nam. Dựa trên thông tin sau, hãy gợi ý 2-3 món ăn "
        f"phù hợp. Trả lời bằng tiếng Việt, ngắn gọn và cụ thể. Với mỗi món, cho biết lý do ngắn gọn tại sao phù hợp.\n\n"
        f"Thông tin:\n"
        f"- Thời gian: {current_time_vn} (bữa {meal_type})\n"
        f"- Địa điểm: {weather['location_name']}\n"
        f"- Thời tiết: {weather['weather_description']}, {weather['temperature_c']:.0f}°C"
    )

    try:
        suggestion = await gemini_service.generate_text(prompt, api_key=x_gemini_api_key, model=x_gemini_model)
    except ValueError as e:
        logger.error(f"Gemini key error: {e}")
        raise HTTPException(status_code=503, detail="Gemini API key is missing or invalid")
    except Exception as e:
        logger.error(f"Gemini generation failed: {e}")
        raise HTTPException(status_code=503, detail="AI generation failed")

    context = WhatToEatContext(
        weather_description=weather["weather_description"],
        temperature_c=weather["temperature_c"],
        meal_type=meal_type,
        location_name=weather["location_name"],
        current_time_vn=current_time_vn,
    )

    return WhatToEatResponse(suggestion=suggestion, context=context)
