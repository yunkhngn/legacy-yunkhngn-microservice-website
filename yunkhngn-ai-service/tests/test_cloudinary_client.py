from unittest.mock import patch

from app.config import Settings
from app.infrastructure.cloudinary_client import CloudinaryUploader


def test_upload_reveal_map_returns_url():
    """CloudinaryUploader.upload_reveal_map should return the secure_url from cloudinary."""
    settings = Settings(
        cloudinary_cloud_name="test_cloud",
        cloudinary_api_key="test_key",
        cloudinary_api_secret="test_secret",
    )
    uploader = CloudinaryUploader(settings)

    with patch("app.infrastructure.cloudinary_client.cloudinary.uploader.upload") as mock_upload:
        mock_upload.return_value = {"secure_url": "https://res.cloudinary.com/test/image.png"}

        url = uploader.upload_reveal_map(b"fake-png-bytes", "letter1-page1")

        assert url == "https://res.cloudinary.com/test/image.png"
        mock_upload.assert_called_once()
