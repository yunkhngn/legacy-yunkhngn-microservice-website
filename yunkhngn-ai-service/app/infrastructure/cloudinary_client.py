import logging

import cloudinary
import cloudinary.uploader

from app.config import Settings

logger = logging.getLogger(__name__)


class CloudinaryUploader:
    """Handles all Cloudinary upload operations."""

    def __init__(self, settings: Settings) -> None:
        cloudinary.config(
            cloud_name=settings.cloudinary_cloud_name,
            api_key=settings.cloudinary_api_key,
            api_secret=settings.cloudinary_api_secret,
        )

    def upload_reveal_map(self, image_bytes: bytes, public_id: str) -> str:
        """Upload grayscale reveal map PNG to Cloudinary. Returns the secure URL."""
        result = cloudinary.uploader.upload(
            image_bytes,
            public_id=f"letters/reveal-maps/{public_id}",
            resource_type="image",
            format="png",
            overwrite=True,
        )
        url = result["secure_url"]
        logger.info("Uploaded reveal map: %s", url)
        return url
