from fastapi import APIRouter

from app.api.health import router as health_router
from app.api.v1.letter import router as letter_router
from app.api.v1.gemini import router as gemini_router
from app.api.v1.rag import router as rag_router
from app.api.v1.chat import router as chat_router
from app.api.v1.tools import router as tools_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(letter_router, prefix="/api/v1")
api_router.include_router(gemini_router, prefix="/api/v1/gemini")
api_router.include_router(rag_router, prefix="/api/v1")
api_router.include_router(chat_router, prefix="/api/v1")
api_router.include_router(tools_router, prefix="/api/v1")

