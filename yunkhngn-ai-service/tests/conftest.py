import pytest

from app.config import Settings


@pytest.fixture
def test_settings() -> Settings:
    return Settings(
        cloudinary_cloud_name="test_cloud",
        cloudinary_api_key="test_key",
        cloudinary_api_secret="test_secret",
    )
