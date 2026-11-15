from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.schemas.letter import ValidationResult


@pytest.fixture
def client():
    app = create_app()
    return TestClient(app)


class TestHealthEndpoint:
    def test_health_returns_ok(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


class TestLetterProcessEndpoint:
    def test_process_returns_202(self, client):
        """POST /api/v1/letter/process should return 202 with processing status."""
        with patch("app.api.v1.letter.get_letter_service") as mock_factory:
            mock_service = MagicMock()
            mock_service.process_letter = AsyncMock()
            mock_factory.return_value = mock_service

            resp = client.post(
                "/api/v1/letter/process",
                json={
                    "letterId": "test-1",
                    "pages": [{"id": "p1", "imageUrl": "https://example.com/img.jpg"}],
                    "callbackUrl": "https://backend.com/cb",
                },
            )
            assert resp.status_code == 202
            assert resp.json()["status"] == "processing"


class TestLetterValidateEndpoint:
    def test_validate_returns_result(self, client):
        """POST /api/v1/letter/validate should return validation result."""
        with patch("app.api.v1.letter.get_letter_service") as mock_factory:
            mock_service = MagicMock()
            mock_service.validate_image.return_value = ValidationResult(
                valid=True,
                issues=[],
                width=600,
                height=400,
            )
            mock_factory.return_value = mock_service

            resp = client.post(
                "/api/v1/letter/validate",
                json={
                    "imageUrl": "https://example.com/img.jpg",
                },
            )
            assert resp.status_code == 200
            assert resp.json()["valid"] is True
