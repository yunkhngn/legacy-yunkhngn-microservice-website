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
            # Fetch 3 random cards from tarot API
            async with httpx.AsyncClient(timeout=10.0) as client:
                tarot_resp = await client.get(TAROT_API_URL)
                tarot_resp.raise_for_status()
                cards = tarot_resp.json()

            # Generate AI analysis
            cards_for_ai = [{"name": c["name"], "description": c["description"]} for c in cards]
            analysis = await gemini_service.generate_tarot_reading(
                question=request.message,
                cards=cards_for_ai,
                api_key=x_gemini_api_key
            )

            # Build tarot card data for frontend display
            tarot_cards = [
                {
                    "name": c["name"],
                    "description": c["description"],
                    "image": f"https://tarot.yunkhngn.dev{c['image']}"
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
