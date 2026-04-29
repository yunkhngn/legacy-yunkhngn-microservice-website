from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class RAGDocument(BaseModel):
    id: str
    type: str
    content: str
    metadata: Dict[str, Any] = {}

class RAGSyncRequest(BaseModel):
    type: str
    action: str  # upsert, delete
    document: RAGDocument

class RAGReindexRequest(BaseModel):
    backend_url: Optional[str] = None
