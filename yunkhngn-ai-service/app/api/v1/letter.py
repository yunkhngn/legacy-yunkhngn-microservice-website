import asyncio
import logging

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.schemas.letter import ProcessRequest, ProcessResponse, ValidateRequest
from app.services.letter_service import LetterService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/letter", tags=["Letter Processing"])


def get_letter_service() -> LetterService:
    """Factory function for LetterService — allows easy mocking in tests."""
    return LetterService(get_settings())


@router.post("/process", response_model=ProcessResponse, status_code=202)
async def process_letter(req: ProcessRequest):
    """Process letter pages in background, callback when done."""
    logger.info(
        "Received processing request for letter %s with %s pages",
        req.letterId,
        len(req.pages),
    )
    service = get_letter_service()
    asyncio.create_task(service.process_letter(req))
    return ProcessResponse(letterId=req.letterId)


@router.post("/validate")
async def validate_image(req: ValidateRequest):
    """Quick validation check for a scan before creating the letter."""
    try:
        service = get_letter_service()
        return service.validate_image(req.imageUrl)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
