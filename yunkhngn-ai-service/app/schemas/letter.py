from pydantic import BaseModel


class PageInput(BaseModel):
    """A single page of a handwritten letter to process."""

    id: str
    imageUrl: str


class ProcessRequest(BaseModel):
    """Request to process a multi-page letter."""

    letterId: str
    pages: list[PageInput]
    callbackUrl: str


class ProcessResponse(BaseModel):
    """Immediate response acknowledging the process request."""

    status: str = "processing"
    letterId: str


class PageResult(BaseModel):
    """Result of processing a single page."""

    id: str
    revealMapUrl: str


class CallbackPayload(BaseModel):
    """Payload sent to the NestJS backend after processing."""

    letterId: str
    pages: list[PageResult]
    success: bool
    error: str | None = None


class ValidateRequest(BaseModel):
    """Request to validate a scanned image."""

    imageUrl: str


class ValidationResult(BaseModel):
    """Result of image validation."""

    valid: bool
    issues: list[str]
    width: int
    height: int
