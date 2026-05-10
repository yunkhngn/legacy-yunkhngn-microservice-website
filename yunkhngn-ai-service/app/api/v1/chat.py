from fastapi import APIRouter, Header, HTTPException
from typing import Optional
import logging
import httpx

from app.schemas.chat import PublicChatRequest
from app.services.chat_service import chat_service
from app.services.image_service import image_service
from app.services import gemini_service

router = APIRouter()
logger = logging.getLogger(__name__)

TAROT_API_URL = "https://tarot.yunkhngn.dev/api/cards/threecards"

@router.post("/chat/public")
async def public_chat(
    request: PublicChatRequest,
    x_gemini_api_key: Optional[str] = Header(None)
):
    try:
        # 1. Detect if it's an image request
        if chat_service.is_image_request(request.message):
            logger.info(f"Image generation request: {request.message}")
            result = await image_service.generate_and_upload_image(
                prompt=request.message,
                api_key=x_gemini_api_key
            )
            return {
                "text": result["text"],
                "imageUrl": result["imageUrl"],
                "tarotCards": None,
                "sources": []
            }

        # 2. Detect if it's a tarot request
        if chat_service.is_tarot_request(request.message):
            logger.info(f"Tarot reading request: {request.message}")
            cards = []
            try:
                # Fetch 3 random cards from tarot API
                async with httpx.AsyncClient(timeout=10.0) as client:
                    tarot_resp = await client.get(TAROT_API_URL)
                    tarot_resp.raise_for_status()
                    cards = tarot_resp.json()
            except Exception as e:
                logger.warning(f"Failed to fetch tarot cards: {e}")
                return {
                    "text": "Xin lỗi, hệ thống bói Tarot đang bảo trì hoặc gặp sự cố kết nối. Hãy thử lại sau nhé! 🔮",
                    "imageUrl": None,
                    "tarotCards": None,
                    "sources": []
                }

            # Generate AI analysis
            try:
                cards_for_ai = [{"name": c["name"], "description": c["description"]} for c in cards]
                analysis = await gemini_service.generate_tarot_reading(
                    question=request.message,
                    cards=cards_for_ai,
                    api_key=x_gemini_api_key
                )
            except Exception as e:
                logger.error(f"Failed to generate tarot analysis: {e}")
                analysis = "Tớ đã rút được các lá bài cho cậu, nhưng hiện tại tớ không thể phân tích sâu hơn được. Cậu có thể tự xem ý nghĩa các lá bài bên dưới nhé!"

            # Build tarot card data for frontend display
            tarot_cards = [
                {
                    "name": c["name"],
                    "description": c["description"],
                    "image": c["image"] if c["image"].startswith('http') else f"https://tarot.yunkhngn.dev{c['image']}"
                }
                for c in cards
            ]

            return {
                "text": analysis,
                "imageUrl": None,
                "tarotCards": tarot_cards,
                "sources": []
            }

        # 3. Otherwise, standard RAG chat
        logger.info(f"Public chat request: {request.message}")
        result = await chat_service.get_chat_response(
            message=request.message,
            history=[{"role": m.role, "content": m.content} for m in request.history],
            language=request.language,
            api_key=x_gemini_api_key,
            persona_override=request.persona
        )
        return {
            "text": result["text"],
            "imageUrl": None,
            "tarotCards": None,
            "sources": result["sources"]
        }

    except Exception as e:
        logger.error(f"Error in public chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))
