import logging
import httpx
from fastapi import APIRouter, HTTPException

from app.schemas.gemini import (
    GenerateTextRequest, ProjectInfoRequest, BlogContentRequest,
    DashboardSummaryRequest, ChatRequest,
)
from app.services import gemini_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Gemini AI"])

@router.post("/generate")
async def generate_text(req: GenerateTextRequest):
    try:
        text = await gemini_service.generate_text(req.prompt)
        return {"text": text}
    except Exception as e:
        logger.error(f"generate_text failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/project-info")
async def generate_project_info(req: ProjectInfoRequest):
    try:
        # Fetch README from GitHub if a URL is passed
        readme = req.readme_content
        if readme.startswith("http"):
            async with httpx.AsyncClient() as client:
                resp = await client.get(readme, headers={"Accept": "application/vnd.github.raw"})
                resp.raise_for_status()
                readme = resp.text
        return await gemini_service.generate_project_info(readme, req.language)
    except Exception as e:
        logger.error(f"generate_project_info failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/blog-content")
async def generate_blog_content(req: BlogContentRequest):
    try:
        content = await gemini_service.generate_blog_content(req.prompt, req.current_content, req.language)
        return {"content": content}
    except Exception as e:
        logger.error(f"generate_blog_content failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/dashboard-summary")
async def generate_dashboard_summary(req: DashboardSummaryRequest):
    try:
        summary = await gemini_service.generate_dashboard_summary(req.stats, req.recent_activities, req.language)
        return {"summary": summary}
    except Exception as e:
        logger.error(f"generate_dashboard_summary failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
async def chat(req: ChatRequest):
    try:
        response = await gemini_service.chat_with_context(req.message, req.history, req.context_data, req.language)
        return {"response": response}
    except Exception as e:
        logger.error(f"chat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
