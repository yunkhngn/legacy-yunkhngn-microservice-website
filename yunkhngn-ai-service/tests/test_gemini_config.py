from app.config import Settings

def test_default_ai_model():
    settings = Settings()
    assert settings.ai_model == "gemini-3.6-flash"
