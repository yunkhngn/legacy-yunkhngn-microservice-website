import logging

from app.config import Settings
from app.infrastructure.cloudinary_client import CloudinaryUploader
from app.infrastructure.http_client import download_image, send_callback
from app.processors.image_processor import generate_reveal_map, validate_scan
from app.schemas.letter import (
    CallbackPayload,
    PageResult,
    ProcessRequest,
    ValidationResult,
)

logger = logging.getLogger(__name__)


class LetterService:
    """Orchestrates letter page processing: download → validate → process → upload → callback."""

    def __init__(self, settings: Settings) -> None:
        self.uploader = CloudinaryUploader(settings)

    async def process_letter(self, req: ProcessRequest) -> None:
        """Process all pages of a letter and send callback with results."""
        results: list[PageResult] = []
        success = True
        error_msg: str | None = None

        try:
            for page in req.pages:
                logger.info("Processing page %s for letter %s", page.id, req.letterId)

                img = download_image(page.imageUrl)
                validation = validate_scan(img)

                if not validation["valid"]:
                    logger.warning(
                        "Validation failed for page %s: %s",
                        page.id,
                        validation["issues"],
                    )
                    success = False
                    error_msg = f"Validation failed: {', '.join(validation['issues'])}"
                    break

                reveal_map_bytes = generate_reveal_map(img)
                logger.info("Generated reveal map for page %s, uploading...", page.id)

                reveal_map_url = self.uploader.upload_reveal_map(
                    reveal_map_bytes,
                    f"{req.letterId}-{page.id}",
                )
                results.append(PageResult(id=page.id, revealMapUrl=reveal_map_url))
                logger.info("Uploaded reveal map for page %s: %s", page.id, reveal_map_url)

        except Exception as e:
            logger.error(
                "Processing failed for letter %s: %s",
                req.letterId,
                e,
                exc_info=True,
            )
            success = False
            error_msg = str(e)

        payload = CallbackPayload(
            letterId=req.letterId,
            pages=results,
            success=success,
            error=error_msg,
        )
        await send_callback(req.callbackUrl, payload)

    def validate_image(self, image_url: str) -> ValidationResult:
        """Quick validation check for a single image."""
        img = download_image(image_url)
        result = validate_scan(img)
        return ValidationResult(**result)
