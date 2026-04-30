from fastapi import APIRouter, Header, HTTPException, Request
from typing import Optional
import logging

from app.schemas.chat import PublicChatRequest
from app.services.chat_service import chat_service
from app.services.image_service import image_service
from app.infrastructure.limiter import limiter

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/chat/public")
@limiter.limit("10/minute")
async def public_chat(
    request: PublicChatRequest,
    fastapi_request: Request,
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
                "sources": []
            }
        
        # 2. Otherwise, standard RAG chat
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
            "sources": result["sources"]
        }

    except Exception as e:
        logger.error(f"Error in public chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))
