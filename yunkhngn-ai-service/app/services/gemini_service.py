import json
import logging
from google import genai
from app.config import get_settings

logger = logging.getLogger(__name__)

def _get_client(api_key: str | None = None):
    settings = get_settings()
    # Priority: Header API Key > Environment Variable
    final_key = api_key or settings.gemini_api_key
    if not final_key:
        raise ValueError("GEMINI_API_KEY is missing")
    return genai.Client(api_key=final_key)

async def generate_text(prompt: str, api_key: str | None = None) -> str:
    client = _get_client(api_key)
    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=prompt,
    )
    return response.text

async def generate_project_info(readme_content: str, language: str = "vi", api_key: str | None = None) -> dict:
    lang = "Vietnamese" if language == "vi" else "English"
    prompt = f"""Analyze the following README content and extract/generate the following information in JSON format.
Please write the content in {lang}.

{{
  "title": "Project Title",
  "description": "A short, engaging description (max 200 chars)",
  "content": "Generate a full project introduction in clean HTML (TipTap-compatible) using only <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> (no <h1>).",
  "techStack": ["Tech 1", "Tech 2 (Max 5)"],
  "tags": ["Tag 1 (Max 1)"],
  "demoLink": "URL if found, otherwise null"
}}

README Content:
{readme_content[:10000]}"""
    
    client = _get_client(api_key)
    response = client.models.generate_content(model="gemini-3-flash-preview", contents=prompt)
    text = response.text.replace("```json\n", "").replace("\n```", "").strip()
    return json.loads(text)

async def generate_blog_content(prompt: str, current_content: str | None, language: str = "vi", api_key: str | None = None) -> dict:
    lang = "Vietnamese" if language == "vi" else "English"
    if current_content:
        system_prompt = f"""You are a professional blog editor. EDIT or EXTEND the following blog content.
Current Content (HTML): {current_content}
User Instructions: {prompt}
Return JSON: {{"title": "...", "tags": ["..."], "content": "Full HTML..."}}
Write in {lang}. No markdown code blocks."""
    else:
        system_prompt = f"""You are a professional blog writer. Write a new blog post.
User Instructions: {prompt}
Return JSON: {{"title": "...", "tags": ["..."], "content": "Full HTML..."}}
Write in {lang}. No markdown code blocks."""
    
    client = _get_client(api_key)
    response = client.models.generate_content(model="gemini-3-flash-preview", contents=system_prompt)
    text = response.text.replace("```json\n", "").replace("\n```", "").replace("```html\n", "").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        first = text.find("{")
        last = text.rfind("}")
        if first != -1 and last > first:
            try:
                return json.loads(text[first:last+1])
            except json.JSONDecodeError:
                pass
        return {"title": "", "tags": [], "content": text}

async def generate_dashboard_summary(stats: dict, recent_activities: list, language: str = "vi", api_key: str | None = None) -> str:
    lang = "Vietnamese" if language == "vi" else "English"
    activities_text = "\n".join(
        f"- [{a.get('type','').upper()}] {a.get('action','')}: {a.get('title','')} ({a.get('timestamp','')})"
        for a in recent_activities
    )
    prompt = f"""Analyze dashboard data for a personal blog/portfolio website.
Data:
- Total Blogs: {stats.get('blogs',0)} ({stats.get('blogsPublished',0)} published, {stats.get('blogsDraft',0)} drafts)
- Total Projects: {stats.get('projects',0)}
- Total Photos: {stats.get('gallery',0)}
- Total Comments: {stats.get('comments',0)}
- Mail: {stats.get('mailTotal',0)} total ({stats.get('mailReceived',0)} received, {stats.get('mailSent',0)} responded)

Recent Activity:
{activities_text}

Generate:
<h3>Weekly Summary</h3><ul>...</ul>
<h3>Future Direction</h3><ul>...</ul>

Respond in {lang}. Professional but encouraging."""
    
    client = _get_client(api_key)
    response = client.models.generate_content(model="gemini-3-flash-preview", contents=prompt)
    return response.text.replace("```html\n", "").replace("\n```", "").strip()

async def chat_with_context(message: str, history: list, context_data: dict, language: str = "vi", api_key: str | None = None) -> str:
    lang_instruction = "Always respond in Vietnamese." if language == "vi" else "Always respond in English."
    
    system_context = f"""You are the AI Assistant for Khoa Nguyen's Portfolio Admin Panel.
Database Content:
[BLOGS]
{context_data.get('blogs', 'No data')}
[PROJECTS]
{context_data.get('projects', 'No data')}
[GALLERY]
{context_data.get('gallery', 'No data')}

Instructions: Answer based on provided content. Be helpful, concise, professional. {lang_instruction}"""

    contents = [
        {"role": "user", "parts": [{"text": system_context}]},
        {"role": "model", "parts": [{"text": "Understood. I am ready to assist."}]},
    ]
    for msg in history:
        role = "user" if msg.get("role") == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg.get("content", "")}]})
    contents.append({"role": "user", "parts": [{"text": message}]})

    client = _get_client(api_key)
    response = client.models.generate_content(model="gemini-3-flash-preview", contents=contents)
    return response.text
