from pydantic import BaseModel
from typing import List, Optional, Any

class ChatMessage(BaseModel):
    role: str
    content: str

class PublicChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    language: str = "vi"
    persona: Optional[dict] = None
