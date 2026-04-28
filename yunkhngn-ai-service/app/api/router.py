from fastapi import APIRouter

from app.api.health import router as health_router
from app.api.v1.letter import router as letter_router
from app.api.v1.gemini import router as gemini_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(letter_router, prefix="/api/v1")
api_router.include_router(gemini_router, prefix="/api/v1/gemini")
