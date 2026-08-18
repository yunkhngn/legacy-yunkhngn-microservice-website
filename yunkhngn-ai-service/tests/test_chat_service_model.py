import sys
from unittest.mock import MagicMock, AsyncMock, patch

sys.modules['chromadb'] = MagicMock()
sys.modules['chromadb.config'] = MagicMock()

import pytest
from app.services.chat_service import chat_service

@pytest.mark.asyncio
async def test_chat_service_uses_configured_ai_model():
    mock_response = MagicMock()
    mock_response.text = "Hello from AI"
    
    with patch("app.services.chat_service.rag_service.search", new=AsyncMock(return_value=[])), \
         patch("app.services.chat_service.genai.Client") as mock_client_cls:
        
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        mock_client_cls.return_value = mock_client
        
        res = await chat_service.get_chat_response(
            message="Xin chào",
            history=[],
            api_key="test-key"
        )
        
        # Verify generate_content was called with gemini-3.6-flash
        mock_client.models.generate_content.assert_called_once()
        call_kwargs = mock_client.models.generate_content.call_args.kwargs
        assert call_kwargs["model"] == "gemini-3.6-flash"
