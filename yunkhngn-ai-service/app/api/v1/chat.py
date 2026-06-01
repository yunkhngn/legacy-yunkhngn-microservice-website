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
    x_gemini_api_key: Optional[str] = Header(None),
    x_gemini_model: Optional[str] = Header(None),
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
                logger.warning(f"Failed to fetch tarot cards from {TAROT_API_URL}: {e}")
                return {
                    "text": "Xin lỗi, hệ thống bói Tarot đang bảo trì hoặc gặp sự cố kết nối. Hãy thử lại sau nhé! 🔮",
                    "imageUrl": None,
                    "tarotCards": None,
                    "sources": []
                }

            # Generate AI analysis
            try:
                # Prepare minimal card data for AI to reduce token usage and improve reliability
                cards_for_ai = [{"name": c["name"], "description": c["description"]} for c in cards]
                analysis = await gemini_service.generate_tarot_reading(
                    question=request.message,
                    cards=cards_for_ai,
                    api_key=x_gemini_api_key,
                    model=x_gemini_model,
                )
            except Exception as e:
                logger.error(f"Failed to generate tarot analysis: {e}", exc_info=True)
                analysis = f"Tớ đã rút được các lá bài cho cậu, nhưng hiện tại tớ không thể phân tích sâu hơn được. Cậu có thể tự xem ý nghĩa các lá bài bên dưới nhé!"

            # Build tarot card data for frontend display with absolute URLs
            # Use rstrip/lstrip to ensure no double slashes or missing slashes
            base_url = "https://tarot.yunkhngn.dev"
            tarot_cards = []
            for c in cards:
                img_path = c.get("image", "")
                if not img_path.startswith("http"):
                    # Ensure path starts with a single slash
                    img_path = "/" + img_path.lstrip("/")
                    full_img_url = f"{base_url}{img_path}"
                else:
                    full_img_url = img_path
                
                tarot_cards.append({
                    "name": c.get("name", "Unknown Card"),
                    "description": c.get("description", ""),
                    "image": full_img_url
                })

            logger.info(f"Successfully prepared tarot response with {len(tarot_cards)} cards")
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
        logger.error(f"Error in public chat: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
