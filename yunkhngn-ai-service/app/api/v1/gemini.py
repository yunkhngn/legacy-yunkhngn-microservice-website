import logging
import httpx
from fastapi import APIRouter, HTTPException, Header
from typing import Optional

from app.schemas.gemini import (
    GenerateTextRequest, ProjectInfoRequest, BlogContentRequest,
    DashboardSummaryRequest, ChatRequest, TarotReadingRequest,
)
from app.services import gemini_service, github_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Gemini AI"])

@router.post("/generate")
async def generate_text(
    req: GenerateTextRequest, 
    x_gemini_api_key: Optional[str] = Header(None)
):
    try:
        text = await gemini_service.generate_text(req.prompt, x_gemini_api_key)
        return {"text": text}
    except Exception as e:
        logger.error(f"generate_text failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/project-info")
async def generate_project_info(
    req: ProjectInfoRequest, 
    x_gemini_api_key: Optional[str] = Header(None)
):
    try:
        readme = req.readme_content
        repo_structure = None
        
        if readme.startswith("http"):
            # Use the new GitHub service to fetch README and structure
            readme, repo_structure = await github_service.get_github_data(readme)
            if not readme:
                # If readme is still empty, it might be a private repo or invalid URL
                # We can either raise an error or proceed with whatever we got
                raise HTTPException(status_code=400, detail="Could not fetch content from the provided URL")
        
        return await gemini_service.generate_project_info(
            readme, repo_structure, req.language, x_gemini_api_key
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"generate_project_info failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/blog-content")
async def generate_blog_content(
    req: BlogContentRequest, 
    x_gemini_api_key: Optional[str] = Header(None)
):
    try:
        content = await gemini_service.generate_blog_content(
            req.prompt, req.current_content, req.language, x_gemini_api_key
        )
        return {"content": content}
    except Exception as e:
        logger.error(f"generate_blog_content failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/dashboard-summary")
async def generate_dashboard_summary(
    req: DashboardSummaryRequest, 
    x_gemini_api_key: Optional[str] = Header(None)
):
    try:
        summary = await gemini_service.generate_dashboard_summary(
            req.stats, req.recent_activities, req.language, x_gemini_api_key
        )
        return {"summary": summary}
    except Exception as e:
        logger.error(f"generate_dashboard_summary failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
async def chat(
    req: ChatRequest, 
    x_gemini_api_key: Optional[str] = Header(None)
):
    try:
        response = await gemini_service.chat_with_context(
            req.message, req.history, req.context_data, req.language, x_gemini_api_key
        )
        return {"response": response}
    except Exception as e:
        logger.error(f"chat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tarot")
async def generate_tarot_reading(
    req: TarotReadingRequest,
    x_gemini_api_key: Optional[str] = Header(None)
):
    try:
        cards = [{"name": c.name, "description": c.description} for c in req.cards]
        analysis = await gemini_service.generate_tarot_reading(
            req.question, cards, x_gemini_api_key
        )
        return {"analysis": analysis}
    except Exception as e:
        logger.error(f"generate_tarot_reading failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
