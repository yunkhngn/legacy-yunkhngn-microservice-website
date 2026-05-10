import json
import os
import logging
from google import genai
from app.config import get_settings
from app.services.rag_service import rag_service

logger = logging.getLogger(__name__)

def _get_client(api_key: str | None = None):
    settings = get_settings()
    final_key = api_key or settings.gemini_api_key
    if not final_key:
        raise ValueError("GEMINI_API_KEY is missing")
    return genai.Client(api_key=final_key)

class ChatService:
    def __init__(self):
        self.persona = self._load_persona()
        self.model_name = "gemini-3-flash-preview"

    def _load_persona(self):
        persona_path = os.path.join(os.getcwd(), "app", "data", "persona.json")
        try:
            with open(persona_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load persona: {e}")
            return {}

    def _build_system_instruction(self, context_chunks: list[dict], language: str = "vi", persona: dict = None) -> str:
        lang_text = "Vietnamese" if language == "vi" else "English"
        
        if persona is None:
            persona = self.persona

        identity = persona.get("identity", {})
        voice = persona.get("voice_and_tone", {})
        instructions = persona.get("instructions_for_ai", {})
        facts = persona.get("knowledge_and_facts", [])
        
        # Collect unhandled keys to ensure no data is lost
        handled_keys = {"identity", "voice_and_tone", "instructions_for_ai", "knowledge_and_facts", "sample_dialogues"}
        other_info = {k: v for k, v in persona.items() if k not in handled_keys}
        other_info_json = json.dumps(other_info, indent=2, ensure_ascii=False) if other_info else "None"
        
        # Format context
        context_text = "\n".join([f"- {c['content']}" for c in context_chunks]) if context_chunks else "No specific context found."
        
        instruction = f"""You are {identity.get('name', 'Khoa Nguyen')}. {identity.get('self_image', '')}
        
Your handle is {identity.get('handle', 'yun.khngn')}. Roles: {", ".join(identity.get('roles', []))}.

VOICE AND TONE:
- Characteristics: {", ".join(voice.get('characteristics', []))}
- Forbidden: {", ".join(voice.get('forbidden', []))}
- Addressing style: {voice.get('addressing_style', {}).get('friendly' if language == 'vi' else 'professional', '')}

FACTS & KNOWLEDGE:
{chr(10).join([f"- {f}" for f in facts])}

ADDITIONAL PERSONAL DETAILS (JSON):
{other_info_json}

INSTRUCTIONS:
- Recruitment/Hiring: {instructions.get('recruitment_or_hiring', '')}
- Unknown info: {instructions.get('unknown_information', '')}
- Technical answers: {instructions.get('technical_answers', '')}

RETRIEVED CONTEXT FROM YOUR WEBSITE:
{context_text}

FINAL RULES:
1. Always respond in {lang_text}.
2. Use the retrieved context to answer accurately, but ONLY if it is relevant to the user's question.
3. If the retrieved context is not relevant to the question, ignore it and answer based on your general persona knowledge (including IDENTITY, FACTS, and ADDITIONAL DETAILS).
4. If you don't know, refer to the 'Unknown info' instruction.
5. Keep it concise, friendly, and professional as per your persona.
6. Format links as Markdown if available in context.
"""
        return instruction

    def is_image_request(self, message: str) -> bool:
        image_keywords = [
            'vẽ', 'tạo ảnh', 'tạo hình', 'sinh ảnh', 'gen ảnh', 'generate image', 
            'draw', 'create image', 'create picture', 'make image', 'make picture', 
            'draw me', 'vẽ cho', 'tạo cho', 'thiết kế'
        ]
        lower_msg = message.toLowerCase() if hasattr(message, 'toLowerCase') else message.lower()
        return any(kw in lower_msg for kw in image_keywords)

    def is_tarot_request(self, message: str) -> bool:
        tarot_keywords = [
            'tarot', 'bói bài', 'trải bài', 'xem bài', 'rút bài',
            'bói tarot', 'đọc bài', 'xem tarot', 'rút tarot',
            'fortune', 'card reading', 'xin quẻ', 'gieo quẻ',
        ]
        lower_msg = message.lower()
        return any(kw in lower_msg for kw in tarot_keywords)

    async def get_chat_response(self, message: str, history: list, language: str = "vi", api_key: str | None = None, persona_override: dict | None = None):
        # 1. Search RAG for context
        context_results = await rag_service.search(message, top_k=5, api_key=api_key)
        
        # 2. Build system instruction
        active_persona = persona_override if persona_override else self.persona
        system_instruction = self._build_system_instruction(context_results, language, active_persona)
        
        # 3. Prepare message content for Gemini
        # We use system_instruction as the first message to set the persona
        contents = [
            {"role": "user", "parts": [{"text": system_instruction}]},
            {"role": "model", "parts": [{"text": f"Understood. I am {active_persona.get('identity', {}).get('name', 'Khoa Nguyen')}. I will respond as myself using the provided context."}]}
        ]
        
        # Add history
        for msg in history:
            role = "user" if msg.get("role") == "user" else "model"
            contents.append({"role": role, "parts": [{"text": msg.get("content", "")}]})
            
        # Add current message
        contents.append({"role": "user", "parts": [{"text": message}]})
        
        # 4. Call Gemini
        client = _get_client(api_key)
        response = client.models.generate_content(
            model=self.model_name,
            contents=contents
        )
        
        return {
            "text": response.text,
            "sources": [
                {"id": r["id"], "metadata": r["metadata"]} for r in context_results
            ]
        }

chat_service = ChatService()
