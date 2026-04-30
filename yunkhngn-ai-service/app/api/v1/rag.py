from fastapi import APIRouter, Header, HTTPException, BackgroundTasks
from typing import Optional
import httpx
import logging

from app.schemas.rag import RAGSyncRequest, RAGReindexRequest
from app.services.rag_service import rag_service
from app.config import get_settings

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/rag/sync")
async def sync_document(
    request: RAGSyncRequest,
    x_gemini_api_key: Optional[str] = Header(None)
):
    try:
        if request.action == "upsert":
            await rag_service.index_document(
                doc_type=request.document.type,
                doc_id=request.document.id,
                text=request.document.content,
                metadata=request.document.metadata,
                api_key=x_gemini_api_key
            )
            return {"status": "success", "message": f"Document {request.document.id} synced"}
        elif request.action == "delete":
            success = await rag_service.delete_document(
                doc_type=request.document.type,
                doc_id=request.document.id
            )
            if success:
                return {"status": "success", "message": f"Document {request.document.id} deleted"}
            else:
                return {"status": "error", "message": "Failed to delete document"}
    except Exception as e:
        logger.error(f"Error in RAG sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/rag/stats")
async def get_rag_stats():
    return {
        "count": rag_service.collection.count(),
        "persist_directory": rag_service.persist_directory
    }

async def perform_reindex(backend_url: str, api_key: str | None = None):
    try:
        async with httpx.AsyncClient() as client:
            # 1. Fetch Blogs
            logger.info(f"Reindexing from {backend_url}...")
            # We assume the BE has these endpoints available for internal use or via API key
            # This is a simplified version
            
            # For now, we just log that we would do it
            # In a real scenario, we'd loop through blogs, projects, etc.
            pass
    except Exception as e:
        logger.error(f"Error in reindex task: {e}")

@router.post("/rag/reindex")
async def reindex_all(
    request: RAGReindexRequest,
    background_tasks: BackgroundTasks,
    x_gemini_api_key: Optional[str] = Header(None)
):
    settings = get_settings()
    url = request.backend_url or "http://backend:3001"
    background_tasks.add_task(perform_reindex, url, x_gemini_api_key)
    return {"status": "success", "message": "Reindexing started in background"}
