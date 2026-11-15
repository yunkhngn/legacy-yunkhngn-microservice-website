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

class RAGSimilarRequest(BaseModel):
    doc_type: str       # "blog" or "project"
    doc_id: str         # ID of the current document
    top_k: int = 3      # Number of similar items to return

class RAGSimilarResult(BaseModel):
    doc_id: str
    doc_type: str
    score: float
    title: Optional[str] = None
    slug: Optional[str] = None
