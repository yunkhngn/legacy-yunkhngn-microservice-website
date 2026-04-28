from pydantic import BaseModel
from typing import List, Optional, Any

class GenerateTextRequest(BaseModel):
    prompt: str

class ProjectInfoRequest(BaseModel):
    readme_content: str
    language: str = "vi"

class BlogContentRequest(BaseModel):
    prompt: str
    current_content: Optional[str] = None
    language: str = "vi"

class DashboardSummaryRequest(BaseModel):
    stats: dict
    recent_activities: List[Any] = []
    language: str = "vi"

class ChatRequest(BaseModel):
    message: str
    history: List[Any] = []
    context_data: dict = {}
    language: str = "vi"
