import logging
import cloudinary
import cloudinary.uploader
from google import genai
from app.config import get_settings

logger = logging.getLogger(__name__)

def _get_client(api_key: str | None = None):
    settings = get_settings()
    final_key = api_key or settings.gemini_api_key
    if not final_key:
        raise ValueError("GEMINI_API_KEY is missing")
    return genai.Client(api_key=final_key)

class ImageService:
    def __init__(self):
        self.settings = get_settings()
        self._setup_cloudinary()

    def _setup_cloudinary(self):
        cloudinary.config(
            cloud_name=self.settings.cloudinary_cloud_name,
            api_key=self.settings.cloudinary_api_key,
            api_secret=self.settings.cloudinary_api_secret,
            secure=True
        )

    async def generate_and_upload_image(self, prompt: str, api_key: str | None = None) -> dict:
        """
        Generate an image using Gemini and upload it to Cloudinary.
        """
        try:
            client = _get_client(api_key)
            
            # 1. Generate image using Gemini
            # Note: The model name might change, using the latest one from spec
            response = client.models.generate_content(
                model='gemini-3-flash-image-preview',
                contents=prompt,
                config={
                    'response_modalities': ['TEXT', 'IMAGE'],
                }
            )

            text_response = ""
            image_url = None

            for part in response.candidates[0].content.parts:
                if part.text:
                    text_response += part.text
                elif part.inline_data:
                    # 2. Upload to Cloudinary
                    # inline_data.data is base64 string
                    mime_type = part.inline_data.mime_type or 'image/png'
                    data_uri = f"data:{mime_type};base64,{part.inline_data.data}"
                    
                    upload_result = cloudinary.uploader.upload(
                        data_uri,
                        folder="blog-portfolio/chat-generated",
                        resource_type="image"
                    )
                    image_url = upload_result.get("secure_url")

            if not text_response and image_url:
                text_response = "Đây nha! Tớ vừa vẽ xong cho cậu rồi đó 🎨"
            elif not text_response and not image_url:
                text_response = "Hmm, tớ không vẽ được ảnh này. Cậu thử mô tả lại chi tiết hơn nhé!"

            return {
                "text": text_response,
                "imageUrl": image_url
            }

        except Exception as e:
            logger.error(f"Error in image generation/upload: {e}")
            return {
                "text": "Có lỗi xảy ra khi tớ đang vẽ ảnh. Cậu thử lại sau nhé!",
                "imageUrl": None
            }

image_service = ImageService()
