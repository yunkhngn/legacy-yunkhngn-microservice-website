from fastapi import APIRouter, Header, HTTPException, BackgroundTasks
from typing import Optional
import httpx
import logging

from app.schemas.rag import RAGSyncRequest, RAGReindexRequest, RAGSimilarRequest
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
        async with httpx.AsyncClient(timeout=30.0) as client:
            # 1. Fetch and index Blogs
            logger.info(f"Reindexing blogs from {backend_url}...")
            try:
                blogs_res = await client.get(f"{backend_url}/blogs")
                if blogs_res.status_code == 200:
                    blogs = blogs_res.json()
                    if isinstance(blogs, dict) and "data" in blogs:
                        blogs = blogs["data"]
                    indexed = 0
                    for blog in blogs:
                        if blog.get("status") != "PUBLISHED":
                            continue
                        content = blog.get("contentJSON") or blog.get("content") or ""
                        metadata = {
                            "title": blog.get("title", ""),
                            "slug": blog.get("slug", ""),
                            "tags": blog.get("tags", ""),
                        }
                        await rag_service.index_document(
                            doc_type="blog",
                            doc_id=blog["id"],
                            text=content,
                            metadata=metadata,
                            api_key=api_key,
                        )
                        indexed += 1
                        import asyncio
                        await asyncio.sleep(1)
                    logger.info(f"Indexed {indexed} blogs")
            except Exception as e:
                logger.error(f"Error indexing blogs: {e}")

            # 2. Fetch and index Projects
            logger.info(f"Reindexing projects from {backend_url}...")
            try:
                projects_res = await client.get(f"{backend_url}/projects")
                if projects_res.status_code == 200:
                    projects = projects_res.json()
                    if isinstance(projects, dict) and "data" in projects:
                        projects = projects["data"]
                    indexed = 0
                    for project in projects:
                        content = project.get("contentJSON") or project.get("description") or ""
                        metadata = {
                            "title": project.get("title", ""),
                            "slug": project.get("slug", ""),
                            "techStack": str(project.get("techStack", "")),
                        }
                        await rag_service.index_document(
                            doc_type="project",
                            doc_id=project["id"],
                            text=content,
                            metadata=metadata,
                            api_key=api_key,
                        )
                        indexed += 1
                        import asyncio
                        await asyncio.sleep(1)
                    logger.info(f"Indexed {indexed} projects")
            except Exception as e:
                logger.error(f"Error indexing projects: {e}")

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

@router.post("/rag/similar")
async def find_similar(
    request: RAGSimilarRequest,
    x_gemini_api_key: Optional[str] = Header(None)
):
    try:
        results = await rag_service.find_similar(
            doc_type=request.doc_type,
            doc_id=request.doc_id,
            top_k=request.top_k,
            api_key=x_gemini_api_key
        )
        return {"status": "success", "results": results}
    except Exception as e:
        logger.error(f"Error finding similar documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))
