import numpy as np
import pytest
import cv2

from app.infrastructure.http_client import download_image, send_callback
from app.schemas.letter import CallbackPayload


def test_download_image_decodes_jpeg(httpx_mock):
    """download_image should decode valid JPEG bytes into a numpy array."""
    img = np.zeros((2, 2, 3), dtype=np.uint8)
    img[:] = (0, 0, 255)
    _, buf = cv2.imencode(".jpg", img)
    jpeg_bytes = buf.tobytes()

    httpx_mock.add_response(url="https://example.com/img.jpg", content=jpeg_bytes)

    result = download_image("https://example.com/img.jpg")
    assert isinstance(result, np.ndarray)
    assert result.shape == (2, 2, 3)


def test_download_image_raises_on_invalid(httpx_mock):
    """download_image should raise ValueError for non-image content."""
    httpx_mock.add_response(url="https://example.com/bad.jpg", content=b"not an image")

    with pytest.raises(ValueError, match="Failed to decode image"):
        download_image("https://example.com/bad.jpg")


@pytest.mark.asyncio
async def test_send_callback_posts_payload(httpx_mock):
    """send_callback should POST the CallbackPayload as JSON."""
    httpx_mock.add_response(url="https://backend.com/callback", status_code=200)

    payload = CallbackPayload(
        letterId="letter-1",
        pages=[],
        success=True,
    )
    await send_callback("https://backend.com/callback", payload)

    request = httpx_mock.get_request()
    assert request is not None
    assert request.method == "POST"
