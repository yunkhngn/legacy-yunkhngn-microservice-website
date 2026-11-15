import logging

from fastapi import FastAPI

from app.config import get_settings


def create_app() -> FastAPI:
    """Application factory pattern."""
    settings = get_settings()

    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    app = FastAPI(
        title="yunkhngn AI Service",
        description="AI microservice for yunkhngn portfolio — letter processing and more",
        version="2.0.0",
    )

    from app.api.router import api_router

    app.include_router(api_router)

    return app


app = create_app()
