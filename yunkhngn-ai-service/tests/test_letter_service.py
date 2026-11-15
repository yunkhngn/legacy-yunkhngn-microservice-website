from unittest.mock import AsyncMock, patch

import numpy as np
import pytest

from app.config import Settings
from app.schemas.letter import PageInput, ProcessRequest
from app.services.letter_service import LetterService


@pytest.fixture
def settings():
    return Settings(
        cloudinary_cloud_name="test",
        cloudinary_api_key="test",
        cloudinary_api_secret="test",
    )


@pytest.fixture
def letter_service(settings):
    return LetterService(settings)


class TestLetterService:
    @pytest.mark.asyncio
    async def test_process_letter_success(self, letter_service):
        """Process should download, validate, generate map, upload, and callback."""
        fake_img = np.ones((400, 600, 3), dtype=np.uint8) * 255

        with (
            patch("app.services.letter_service.download_image", return_value=fake_img) as mock_dl,
            patch(
                "app.services.letter_service.validate_scan",
                return_value={"valid": True, "issues": [], "width": 600, "height": 400},
            ),
            patch(
                "app.services.letter_service.generate_reveal_map",
                return_value=b"fake-png",
            ) as mock_gen,
            patch.object(
                letter_service.uploader,
                "upload_reveal_map",
                return_value="https://cdn.com/map.png",
            ) as mock_up,
            patch("app.services.letter_service.send_callback", new_callable=AsyncMock) as mock_cb,
        ):
            req = ProcessRequest(
                letterId="letter-1",
                pages=[PageInput(id="page-1", imageUrl="https://example.com/img.jpg")],
                callbackUrl="https://backend.com/callback",
            )
            await letter_service.process_letter(req)

            mock_dl.assert_called_once_with("https://example.com/img.jpg")
            mock_gen.assert_called_once()
            mock_up.assert_called_once_with(b"fake-png", "letter-1-page-1")
            mock_cb.assert_called_once()
            payload = mock_cb.call_args[0][1]
            assert payload.success is True
            assert len(payload.pages) == 1
            assert payload.pages[0].revealMapUrl == "https://cdn.com/map.png"

    @pytest.mark.asyncio
    async def test_process_letter_validation_failure(self, letter_service):
        """If validation fails, callback should report success=False."""
        fake_img = np.ones((100, 50, 3), dtype=np.uint8) * 255

        with (
            patch("app.services.letter_service.download_image", return_value=fake_img),
            patch(
                "app.services.letter_service.validate_scan",
                return_value={
                    "valid": False,
                    "issues": ["Too small"],
                    "width": 50,
                    "height": 100,
                },
            ),
            patch("app.services.letter_service.send_callback", new_callable=AsyncMock) as mock_cb,
        ):
            req = ProcessRequest(
                letterId="letter-2",
                pages=[PageInput(id="page-1", imageUrl="https://example.com/small.jpg")],
                callbackUrl="https://backend.com/callback",
            )
            await letter_service.process_letter(req)

            mock_cb.assert_called_once()
            payload = mock_cb.call_args[0][1]
            assert payload.success is False
            assert "Too small" in (payload.error or "")
