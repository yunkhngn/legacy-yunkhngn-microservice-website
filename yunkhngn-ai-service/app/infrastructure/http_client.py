import logging

import cv2
import httpx
import numpy as np

from app.schemas.letter import CallbackPayload

logger = logging.getLogger(__name__)


def download_image(url: str) -> np.ndarray:
    """Download image from URL and decode to OpenCV BGR format."""
    resp = httpx.get(url, timeout=30)
    resp.raise_for_status()
    arr = np.frombuffer(resp.content, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Failed to decode image")
    return img


async def send_callback(url: str, payload: CallbackPayload) -> None:
    """POST processing results back to the NestJS backend."""
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(url, json=payload.model_dump())
            logger.info("Callback response: %s", resp.status_code)
        except Exception as e:
            logger.error("Callback failed: %s", e)
