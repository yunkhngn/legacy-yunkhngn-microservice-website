# AI Service Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Python AI microservice (`yunkhngn-ai`) from a flat FastAPI script into a modular, layered architecture following best practices — ready to scale with additional services beyond letter processing.

**Architecture:** The service will follow a **Layered Architecture** with clear separation between API routes, business logic (services), and infrastructure (external clients). Each feature domain (letter processing, future services) gets its own service module. A shared infrastructure layer handles cross-cutting concerns like Cloudinary uploads, image downloads, and error handling. FastAPI's dependency injection is used throughout.

**Tech Stack:** Python 3.11, FastAPI, OpenCV, Pydantic v2, pytest, httpx, cloudinary, uvicorn

---

## Current State Analysis

### Problems
1. **Flat structure** — All code lives in `main.py` + `services/` with no layering
2. **No error handling strategy** — Bare `try/except Exception` everywhere
3. **No tests** — Only manual `test_locally.py` and `test_perf.py` scripts
4. **No configuration management** — `cloudinary_client.py` calls `configure()` on every upload
5. **Tight coupling** — `main.py` directly calls image processing + cloudinary + HTTP callback
6. **Not extensible** — Adding a new AI service means modifying `main.py` directly

### Target Architecture
```
yunkhngn-ai/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app factory
│   ├── config.py                  # Pydantic Settings (env vars)
│   ├── api/
│   │   ├── __init__.py
│   │   ├── router.py              # Root router aggregator
│   │   ├── health.py              # GET /health
│   │   └── v1/
│   │       ├── __init__.py
│   │       └── letter.py          # POST /api/v1/letter/process, validate
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── letter.py              # Pydantic models for letter domain
│   ├── services/
│   │   ├── __init__.py
│   │   └── letter_service.py      # Business logic orchestration
│   ├── processors/
│   │   ├── __init__.py
│   │   └── image_processor.py     # OpenCV reveal map generation (pure functions)
│   └── infrastructure/
│       ├── __init__.py
│       ├── cloudinary_client.py   # Cloudinary upload abstraction
│       └── http_client.py         # Shared httpx client for downloads & callbacks
├── tests/
│   ├── __init__.py
│   ├── conftest.py                # Shared fixtures
│   ├── test_api_letter.py         # API integration tests
│   ├── test_letter_service.py     # Service unit tests
│   └── test_image_processor.py    # Processor unit tests
├── Dockerfile
├── requirements.txt
├── pyproject.toml                 # Project metadata + pytest config
└── README.md
```

---

## Task 1: Project Configuration & Skeleton

**Files:**
- Create: `pyproject.toml`
- Create: `app/__init__.py`
- Create: `app/config.py`

- [ ] **Step 1: Create pyproject.toml with project metadata and pytest config**

```toml
[project]
name = "yunkhngn-ai"
version = "1.0.0"
description = "AI microservice for yunkhngn portfolio"
requires-python = ">=3.11"

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
```

- [ ] **Step 2: Create app config module with Pydantic Settings**

Create `app/__init__.py` (empty file).

Create `app/config.py`:
```python
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Cloudinary
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    # Service
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 3: Update requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.32.0
opencv-python-headless==4.10.0.84
numpy==2.1.0
cloudinary==1.41.0
httpx==0.28.0
python-dotenv==1.0.1
pydantic-settings==2.6.0
pytest==8.3.0
pytest-asyncio==0.24.0
pytest-httpx==0.34.0
```

- [ ] **Step 4: Commit**

```bash
git add pyproject.toml app/__init__.py app/config.py requirements.txt
git commit -m "chore: add project config and pydantic settings"
```

---

## Task 2: Pydantic Schemas

**Files:**
- Create: `app/schemas/__init__.py`
- Create: `app/schemas/letter.py`

- [ ] **Step 1: Create letter schemas**

Create `app/schemas/__init__.py` (empty file).

Create `app/schemas/letter.py`:
```python
from pydantic import BaseModel, HttpUrl


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
```

- [ ] **Step 2: Commit**

```bash
git add app/schemas/
git commit -m "feat: add pydantic schemas for letter domain"
```

---

## Task 3: Infrastructure Layer — HTTP Client

**Files:**
- Create: `app/infrastructure/__init__.py`
- Create: `app/infrastructure/http_client.py`
- Create: `tests/__init__.py`
- Create: `tests/conftest.py`

- [ ] **Step 1: Write failing test for HTTP client**

Create `tests/__init__.py` (empty file).

Create `tests/conftest.py`:
```python
import pytest
from app.config import Settings


@pytest.fixture
def test_settings() -> Settings:
    return Settings(
        cloudinary_cloud_name="test_cloud",
        cloudinary_api_key="test_key",
        cloudinary_api_secret="test_secret",
    )
```

Create `tests/test_http_client.py`:
```python
import pytest
import numpy as np
from app.infrastructure.http_client import download_image, send_callback
from app.schemas.letter import CallbackPayload


def test_download_image_decodes_jpeg(httpx_mock):
    """download_image should decode valid JPEG bytes into a numpy array."""
    # Create a minimal 2x2 red JPEG in memory
    import cv2
    img = np.zeros((2, 2, 3), dtype=np.uint8)
    img[:] = (0, 0, 255)  # BGR red
    _, buf = cv2.imencode(".jpg", img)
    jpeg_bytes = buf.tobytes()

    httpx_mock.add_response(url="https://example.com/img.jpg", content=jpeg_bytes)

    result = download_image("https://example.com/img.jpg")
    assert isinstance(result, np.ndarray)
    assert result.shape == (2, 2, 3)


def test_download_image_raises_on_invalid(httpx_mock):
    """download_image should raise ValueError for non-image content."""
    httpx_mock.add_response(url="https://example.com/bad.jpg", content=b"not an image")

    with pytest.raises(ValueError, match="Failed to decode image"):
        download_image("https://example.com/bad.jpg")


@pytest.mark.asyncio
async def test_send_callback_posts_payload(httpx_mock):
    """send_callback should POST the CallbackPayload as JSON."""
    httpx_mock.add_response(url="https://backend.com/callback", status_code=200)

    payload = CallbackPayload(
        letterId="letter-1",
        pages=[],
        success=True,
    )
    await send_callback("https://backend.com/callback", payload)

    request = httpx_mock.get_request()
    assert request is not None
    assert request.method == "POST"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/Data/Code/web/yunkhngn-ai
pip install -r requirements.txt
pytest tests/test_http_client.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'app.infrastructure.http_client'`

- [ ] **Step 3: Implement HTTP client**

Create `app/infrastructure/__init__.py` (empty file).

Create `app/infrastructure/http_client.py`:
```python
import logging
import cv2
import numpy as np
import httpx

from app.schemas.letter import CallbackPayload

logger = logging.getLogger(__name__)


def download_image(url: str) -> np.ndarray:
    """Download image from URL and decode to OpenCV BGR format."""
    resp = httpx.get(url, timeout=30)
    resp.raise_for_status()
    arr = np.frombuffer(resp.content, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Failed to decode image")
    return img


async def send_callback(url: str, payload: CallbackPayload) -> None:
    """POST processing results back to the NestJS backend."""
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(url, json=payload.model_dump())
            logger.info(f"Callback response: {resp.status_code}")
        except Exception as e:
            logger.error(f"Callback failed: {e}")
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_http_client.py -v
```
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add app/infrastructure/ tests/
git commit -m "feat: add http client infrastructure with tests"
```

---

## Task 4: Infrastructure Layer — Cloudinary Client

**Files:**
- Create: `app/infrastructure/cloudinary_client.py`
- Create: `tests/test_cloudinary_client.py`

- [ ] **Step 1: Write failing test**

Create `tests/test_cloudinary_client.py`:
```python
from unittest.mock import patch, MagicMock
from app.infrastructure.cloudinary_client import CloudinaryUploader
from app.config import Settings


def test_upload_reveal_map_returns_url():
    """CloudinaryUploader.upload_reveal_map should return the secure_url from cloudinary."""
    settings = Settings(
        cloudinary_cloud_name="test_cloud",
        cloudinary_api_key="test_key",
        cloudinary_api_secret="test_secret",
    )
    uploader = CloudinaryUploader(settings)

    with patch("app.infrastructure.cloudinary_client.cloudinary.uploader.upload") as mock_upload:
        mock_upload.return_value = {"secure_url": "https://res.cloudinary.com/test/image.png"}

        url = uploader.upload_reveal_map(b"fake-png-bytes", "letter1-page1")

        assert url == "https://res.cloudinary.com/test/image.png"
        mock_upload.assert_called_once()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_cloudinary_client.py -v
```
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement CloudinaryUploader**

Create `app/infrastructure/cloudinary_client.py`:
```python
import logging
import cloudinary
import cloudinary.uploader

from app.config import Settings

logger = logging.getLogger(__name__)


class CloudinaryUploader:
    """Handles all Cloudinary upload operations."""

    def __init__(self, settings: Settings) -> None:
        cloudinary.config(
            cloud_name=settings.cloudinary_cloud_name,
            api_key=settings.cloudinary_api_key,
            api_secret=settings.cloudinary_api_secret,
        )
        self._configured = True

    def upload_reveal_map(self, image_bytes: bytes, public_id: str) -> str:
        """Upload grayscale reveal map PNG to Cloudinary. Returns the secure URL."""
        result = cloudinary.uploader.upload(
            image_bytes,
            public_id=f"letters/reveal-maps/{public_id}",
            resource_type="image",
            format="png",
            overwrite=True,
        )
        url = result["secure_url"]
        logger.info(f"Uploaded reveal map: {url}")
        return url
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_cloudinary_client.py -v
```
Expected: 1 passed

- [ ] **Step 5: Commit**

```bash
git add app/infrastructure/cloudinary_client.py tests/test_cloudinary_client.py
git commit -m "feat: add cloudinary uploader with config injection and tests"
```

---

## Task 5: Image Processor (Pure Functions)

**Files:**
- Create: `app/processors/__init__.py`
- Create: `app/processors/image_processor.py`
- Create: `tests/test_image_processor.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_image_processor.py`:
```python
import numpy as np
import cv2
from app.processors.image_processor import generate_reveal_map, validate_scan


def _make_white_image(h: int = 400, w: int = 600) -> np.ndarray:
    """Create a plain white image."""
    return np.ones((h, w, 3), dtype=np.uint8) * 255


def _make_image_with_text(h: int = 400, w: int = 600) -> np.ndarray:
    """Create a white image with black text drawn on it."""
    img = _make_white_image(h, w)
    cv2.putText(img, "Hello World", (50, 200), cv2.FONT_HERSHEY_SIMPLEX, 2.0, (0, 0, 0), 3)
    return img


class TestValidateScan:
    def test_valid_image(self):
        img = _make_image_with_text()
        result = validate_scan(img)
        assert result["valid"] is True
        assert result["width"] == 600
        assert result["height"] == 400

    def test_too_small_image(self):
        img = _make_white_image(100, 50)
        result = validate_scan(img)
        assert result["valid"] is False
        assert any("resolution" in issue.lower() for issue in result["issues"])


class TestGenerateRevealMap:
    def test_returns_png_bytes(self):
        img = _make_image_with_text()
        result = generate_reveal_map(img)
        assert isinstance(result, bytes)
        # First bytes should be PNG magic number
        assert result[:4] == b"\x89PNG"

    def test_blank_image_produces_empty_map(self):
        img = _make_white_image()
        result_bytes = generate_reveal_map(img)
        # Decode and check — mostly zeros (no ink)
        arr = np.frombuffer(result_bytes, np.uint8)
        decoded = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
        assert decoded is not None
        # A blank image should have very few non-zero pixels
        ink_ratio = np.count_nonzero(decoded) / decoded.size
        assert ink_ratio < 0.05

    def test_text_image_has_nonzero_timing(self):
        img = _make_image_with_text()
        result_bytes = generate_reveal_map(img)
        arr = np.frombuffer(result_bytes, np.uint8)
        decoded = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
        assert decoded is not None
        # Should have some ink pixels with timing values
        assert np.count_nonzero(decoded) > 0
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_image_processor.py -v
```
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Move image processor to new location**

Create `app/processors/__init__.py` (empty file).

Create `app/processors/image_processor.py` — copy the existing logic from `services/image_processor.py` but remove the `download_image` function (it now lives in `http_client.py`). Keep only `generate_reveal_map` and `validate_scan`:

```python
import cv2
import numpy as np


def generate_reveal_map(img: np.ndarray) -> bytes:
    """
    Process scanned handwriting image to generate a reveal timing map.
    Returns PNG bytes of a grayscale image where:
    - pixel value 0 = background (revealed immediately as paper)
    - pixel value 1–255 = stroke timing (1 = first, 255 = last)

    Algorithm:
    1. Binarize to find ink pixels
    2. Detect text line bands via horizontal projection
    3. Assign each ink pixel a timing value based on (line_index, x_position)
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # ── Step 1: Robust ink detection ──
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(16, 16))
    enhanced = clahe.apply(gray)

    adaptive_binary = cv2.adaptiveThreshold(
        enhanced, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        blockSize=31,
        C=5,
    )

    _, otsu_binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    binary = cv2.bitwise_or(adaptive_binary, otsu_binary)

    close_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, close_kernel, iterations=1)

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary)
    min_area = max(5, int(h * w * 0.000005))

    keep = stats[:, cv2.CC_STAT_AREA] >= min_area
    keep[0] = False
    binary = np.where(keep[labels], 255, 0).astype(np.uint8)

    # ── Step 2: Detect text line bands via horizontal projection ──
    row_ink = np.sum(binary > 0, axis=1)

    smooth_window = max(3, h // 200)
    if smooth_window % 2 == 0:
        smooth_window += 1
    row_ink_smooth = cv2.GaussianBlur(
        row_ink.astype(np.float32).reshape(-1, 1),
        (1, smooth_window), 0
    ).flatten()

    ink_threshold = max(2, np.max(row_ink_smooth) * 0.10)
    in_band = False
    band_start = 0
    raw_line_bands = []
    gap_tolerance = max(5, int(h * 0.005))
    gap_count = 0

    for y in range(h):
        if row_ink_smooth[y] >= ink_threshold:
            if not in_band:
                band_start = y
                in_band = True
            gap_count = 0
        else:
            if in_band:
                gap_count += 1
                if gap_count > gap_tolerance:
                    raw_line_bands.append((band_start, y - gap_count))
                    in_band = False
                    gap_count = 0
    if in_band:
        raw_line_bands.append((band_start, h - 1))

    if not raw_line_bands:
        raw_line_bands = [(0, h - 1)]

    line_bands = []
    max_band_h = max(20, int(h * 0.08))
    for start_y, end_y in raw_line_bands:
        band_h = end_y - start_y
        if band_h > max_band_h:
            num_splits = int(np.ceil(band_h / max_band_h))
            split_h = band_h // num_splits
            for s in range(num_splits):
                s_start = start_y + s * split_h
                s_end = start_y + (s + 1) * split_h - 1 if s < num_splits - 1 else end_y
                line_bands.append((s_start, s_end))
        else:
            line_bands.append((start_y, end_y))

    # ── Step 3: Compute per-band ink X extents ──
    band_info = []
    for start_y, end_y in line_bands:
        band_slice = binary[start_y:end_y + 1, :]
        ink_cols = np.where(np.any(band_slice > 0, axis=0))[0]
        if len(ink_cols) > 0:
            min_x = int(ink_cols[0])
            max_x = int(ink_cols[-1])
        else:
            min_x, max_x = 0, w - 1
        band_info.append({
            "start_y": start_y,
            "end_y": end_y,
            "min_x": min_x,
            "max_x": max_x,
        })

    # ── Step 4: Paint the reveal timing map ──
    num_bands = len(band_info)
    reveal_map = np.zeros((h, w), dtype=np.uint8)
    TIME_MIN = 1
    TIME_MAX = 255
    total_range = TIME_MAX - TIME_MIN
    LINE_WEIGHT = 0.10
    X_WEIGHT = 0.90

    band_duration = total_range / num_bands

    for b_idx, band in enumerate(band_info):
        t_line_base = TIME_MIN + b_idx * band_duration
        x_range = max(band["max_x"] - band["min_x"], 1)

        y_slice = slice(band["start_y"], band["end_y"] + 1)
        band_binary = binary[y_slice, :]

        x_indices = np.arange(w)
        x_progress = np.clip((x_indices - band["min_x"]) / x_range, 0.0, 1.0)

        timing_x = t_line_base + x_progress * band_duration * X_WEIGHT
        timing_x = np.clip(timing_x, TIME_MIN, TIME_MAX).astype(np.uint8)

        timing_2d = np.tile(timing_x, (band_binary.shape[0], 1))

        mask = band_binary > 0

        band_reveal = reveal_map[y_slice, :]
        band_reveal[mask] = timing_2d[mask]

    stray_mask = (binary > 0) & (reveal_map == 0)
    y_indices = np.arange(h)
    timing_y = np.clip((y_indices / h) * TIME_MAX, TIME_MIN, TIME_MAX).astype(np.uint8)
    timing_2d_y = np.tile(timing_y[:, np.newaxis], (1, w))
    reveal_map[stray_mask] = timing_2d_y[stray_mask]

    dilate_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    reveal_map = cv2.dilate(reveal_map, dilate_kernel, iterations=1)

    _, buf = cv2.imencode(".png", reveal_map)
    return buf.tobytes()


def validate_scan(img: np.ndarray) -> dict:
    """Validate that the scanned image is suitable for processing."""
    h, w = img.shape[:2]
    issues = []

    if h < 300 or w < 200:
        issues.append("Image resolution too low (min 200x300)")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    contrast = gray.std()
    if contrast < 15:
        issues.append(f"Low contrast ({contrast:.0f}); text may be hard to detect")

    return {"valid": len(issues) == 0, "issues": issues, "width": w, "height": h}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_image_processor.py -v
```
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add app/processors/ tests/test_image_processor.py
git commit -m "feat: move image processor to processors layer with tests"
```

---

## Task 6: Letter Service (Business Logic Orchestration)

**Files:**
- Create: `app/services/__init__.py`
- Create: `app/services/letter_service.py`
- Create: `tests/test_letter_service.py`

- [ ] **Step 1: Write failing test**

Create `tests/test_letter_service.py`:
```python
from unittest.mock import AsyncMock, MagicMock, patch
import numpy as np
import pytest

from app.services.letter_service import LetterService
from app.schemas.letter import ProcessRequest, PageInput
from app.config import Settings


@pytest.fixture
def settings():
    return Settings(
        cloudinary_cloud_name="test",
        cloudinary_api_key="test",
        cloudinary_api_secret="test",
    )


@pytest.fixture
def letter_service(settings):
    return LetterService(settings)


class TestLetterService:
    @pytest.mark.asyncio
    async def test_process_letter_success(self, letter_service):
        """Process should download, validate, generate map, upload, and callback."""
        fake_img = np.ones((400, 600, 3), dtype=np.uint8) * 255

        with (
            patch("app.services.letter_service.download_image", return_value=fake_img) as mock_dl,
            patch("app.services.letter_service.validate_scan", return_value={"valid": True, "issues": [], "width": 600, "height": 400}),
            patch("app.services.letter_service.generate_reveal_map", return_value=b"fake-png") as mock_gen,
            patch.object(letter_service.uploader, "upload_reveal_map", return_value="https://cdn.com/map.png") as mock_up,
            patch("app.services.letter_service.send_callback", new_callable=AsyncMock) as mock_cb,
        ):
            req = ProcessRequest(
                letterId="letter-1",
                pages=[PageInput(id="page-1", imageUrl="https://example.com/img.jpg")],
                callbackUrl="https://backend.com/callback",
            )
            await letter_service.process_letter(req)

            mock_dl.assert_called_once_with("https://example.com/img.jpg")
            mock_gen.assert_called_once()
            mock_up.assert_called_once_with(b"fake-png", "letter-1-page-1")
            mock_cb.assert_called_once()
            payload = mock_cb.call_args[0][1]
            assert payload.success is True
            assert len(payload.pages) == 1
            assert payload.pages[0].revealMapUrl == "https://cdn.com/map.png"

    @pytest.mark.asyncio
    async def test_process_letter_validation_failure(self, letter_service):
        """If validation fails, callback should report success=False."""
        fake_img = np.ones((100, 50, 3), dtype=np.uint8) * 255

        with (
            patch("app.services.letter_service.download_image", return_value=fake_img),
            patch("app.services.letter_service.validate_scan", return_value={"valid": False, "issues": ["Too small"], "width": 50, "height": 100}),
            patch("app.services.letter_service.send_callback", new_callable=AsyncMock) as mock_cb,
        ):
            req = ProcessRequest(
                letterId="letter-2",
                pages=[PageInput(id="page-1", imageUrl="https://example.com/small.jpg")],
                callbackUrl="https://backend.com/callback",
            )
            await letter_service.process_letter(req)

            mock_cb.assert_called_once()
            payload = mock_cb.call_args[0][1]
            assert payload.success is False
            assert "Too small" in payload.error
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_letter_service.py -v
```
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement LetterService**

Create `app/services/__init__.py` (empty file).

Create `app/services/letter_service.py`:
```python
import logging

from app.config import Settings
from app.infrastructure.cloudinary_client import CloudinaryUploader
from app.infrastructure.http_client import download_image, send_callback
from app.processors.image_processor import generate_reveal_map, validate_scan
from app.schemas.letter import (
    CallbackPayload,
    PageResult,
    ProcessRequest,
    ValidationResult,
)

logger = logging.getLogger(__name__)


class LetterService:
    """Orchestrates letter page processing: download → validate → process → upload → callback."""

    def __init__(self, settings: Settings) -> None:
        self.uploader = CloudinaryUploader(settings)

    async def process_letter(self, req: ProcessRequest) -> None:
        """Process all pages of a letter and send callback with results."""
        results: list[PageResult] = []
        success = True
        error_msg: str | None = None

        try:
            for page in req.pages:
                logger.info(f"Processing page {page.id} for letter {req.letterId}")

                img = download_image(page.imageUrl)
                validation = validate_scan(img)

                if not validation["valid"]:
                    logger.warning(f"Validation failed for page {page.id}: {validation['issues']}")
                    success = False
                    error_msg = f"Validation failed: {', '.join(validation['issues'])}"
                    break

                reveal_map_bytes = generate_reveal_map(img)
                logger.info(f"Generated reveal map for page {page.id}, uploading...")

                reveal_map_url = self.uploader.upload_reveal_map(
                    reveal_map_bytes, f"{req.letterId}-{page.id}"
                )
                results.append(PageResult(id=page.id, revealMapUrl=reveal_map_url))
                logger.info(f"Uploaded reveal map for page {page.id}: {reveal_map_url}")

        except Exception as e:
            logger.error(f"Processing failed for letter {req.letterId}: {e}", exc_info=True)
            success = False
            error_msg = str(e)

        payload = CallbackPayload(
            letterId=req.letterId,
            pages=results,
            success=success,
            error=error_msg,
        )
        await send_callback(req.callbackUrl, payload)

    def validate_image(self, image_url: str) -> ValidationResult:
        """Quick validation check for a single image."""
        img = download_image(image_url)
        result = validate_scan(img)
        return ValidationResult(**result)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_letter_service.py -v
```
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add app/services/ tests/test_letter_service.py
git commit -m "feat: add letter service orchestration layer with tests"
```

---

## Task 7: API Routes

**Files:**
- Create: `app/api/__init__.py`
- Create: `app/api/router.py`
- Create: `app/api/health.py`
- Create: `app/api/v1/__init__.py`
- Create: `app/api/v1/letter.py`
- Create: `tests/test_api_letter.py`

- [ ] **Step 1: Write failing API test**

Create `tests/test_api_letter.py`:
```python
from unittest.mock import AsyncMock, patch, MagicMock
import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client():
    app = create_app()
    return TestClient(app)


class TestHealthEndpoint:
    def test_health_returns_ok(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


class TestLetterProcessEndpoint:
    def test_process_returns_202(self, client):
        """POST /api/v1/letter/process should return 202 with processing status."""
        with patch("app.api.v1.letter.get_letter_service") as mock_factory:
            mock_service = MagicMock()
            mock_service.process_letter = AsyncMock()
            mock_factory.return_value = mock_service

            resp = client.post("/api/v1/letter/process", json={
                "letterId": "test-1",
                "pages": [{"id": "p1", "imageUrl": "https://example.com/img.jpg"}],
                "callbackUrl": "https://backend.com/cb",
            })
            assert resp.status_code == 202
            assert resp.json()["status"] == "processing"


class TestLetterValidateEndpoint:
    def test_validate_returns_result(self, client):
        """POST /api/v1/letter/validate should return validation result."""
        with patch("app.api.v1.letter.get_letter_service") as mock_factory:
            mock_service = MagicMock()
            mock_service.validate_image.return_value = MagicMock(
                valid=True, issues=[], width=600, height=400,
                model_dump=lambda: {"valid": True, "issues": [], "width": 600, "height": 400},
            )
            mock_factory.return_value = mock_service

            resp = client.post("/api/v1/letter/validate", json={
                "imageUrl": "https://example.com/img.jpg",
            })
            assert resp.status_code == 200
            assert resp.json()["valid"] is True
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_api_letter.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 3: Implement API routes and app factory**

Create `app/api/__init__.py` (empty file).

Create `app/api/health.py`:
```python
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok"}
```

Create `app/api/v1/__init__.py` (empty file).

Create `app/api/v1/letter.py`:
```python
import asyncio
import logging
from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.schemas.letter import ProcessRequest, ProcessResponse, ValidateRequest
from app.services.letter_service import LetterService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/letter", tags=["Letter Processing"])


def get_letter_service() -> LetterService:
    """Factory function for LetterService — allows easy mocking in tests."""
    return LetterService(get_settings())


@router.post("/process", response_model=ProcessResponse, status_code=202)
async def process_letter(req: ProcessRequest):
    """Process letter pages in background, callback when done."""
    logger.info(f"Received processing request for letter {req.letterId} with {len(req.pages)} pages")
    service = get_letter_service()
    asyncio.create_task(service.process_letter(req))
    return ProcessResponse(letterId=req.letterId)


@router.post("/validate")
async def validate_image(req: ValidateRequest):
    """Quick validation check for a scan before creating the letter."""
    try:
        service = get_letter_service()
        return service.validate_image(req.imageUrl)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
```

Create `app/api/router.py`:
```python
from fastapi import APIRouter
from app.api.health import router as health_router
from app.api.v1.letter import router as letter_router

api_router = APIRouter()

# Health check (no prefix)
api_router.include_router(health_router)

# Versioned API
api_router.include_router(letter_router, prefix="/api/v1")
```

Create `app/main.py`:
```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_api_letter.py -v
```
Expected: 3 passed

- [ ] **Step 5: Run ALL tests**

```bash
pytest tests/ -v
```
Expected: ALL passed (11 total)

- [ ] **Step 6: Commit**

```bash
git add app/api/ app/main.py tests/test_api_letter.py
git commit -m "feat: add API routes with app factory pattern and versioned endpoints"
```

---

## Task 8: Update Dockerfile & Cleanup Legacy Files

**Files:**
- Modify: `Dockerfile`
- Delete: `main.py` (root-level legacy)
- Delete: `services/` (legacy directory)

- [ ] **Step 1: Update Dockerfile to point to new app location**

```dockerfile
FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Remove legacy files**

```bash
rm main.py
rm -rf services/
rm test_locally.py test_perf.py test_perf_naive.py
```

- [ ] **Step 3: Verify the app starts**

```bash
cd /Volumes/Data/Code/web/yunkhngn-ai
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
sleep 2
curl http://localhost:8000/health
# Expected: {"status":"ok"}
kill %1
```

- [ ] **Step 4: Run all tests one final time**

```bash
pytest tests/ -v
```
Expected: ALL passed

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: complete migration to layered architecture, remove legacy files"
```

---

## Task 9: Update Docker Compose & NestJS Backend Reference

**Files:**
- Modify: `/Volumes/Data/Code/web/yunkhngn-infra/docker-compose.yml` (no code change needed — already uses `yunkhngn-ai-service:latest`)
- Modify: `/Volumes/Data/Code/web/yunkhngn-be/src/modules/letter/letter.service.ts` (verify `LETTER_AI_URL` endpoint paths)

- [ ] **Step 1: Verify NestJS backend calls the correct new endpoints**

The NestJS backend calls `LETTER_AI_URL` (currently `http://ai-service:8000`). Check what endpoints it calls and update paths:

Old: `POST /process` → New: `POST /api/v1/letter/process`
Old: `POST /validate` → New: `POST /api/v1/letter/validate`

Grep for these in the NestJS backend and update the URL paths accordingly.

```bash
grep -r "LETTER_AI_URL\|letter-ai\|ai-service.*8000\|/process\|/validate" /Volumes/Data/Code/web/yunkhngn-be/src/modules/letter/ --include="*.ts"
```

Update the paths in `letter.service.ts` to use `/api/v1/letter/process` and `/api/v1/letter/validate`.

- [ ] **Step 2: Commit backend change**

```bash
cd /Volumes/Data/Code/web/yunkhngn-be
git add src/modules/letter/letter.service.ts
git commit -m "fix: update AI service endpoint paths for v2 API"
```

---

## Extension Guide: Adding New Services

When you need to add a new AI service (e.g., image captioning, OCR, etc.), follow this pattern:

1. **Schema** → `app/schemas/new_feature.py` — Define request/response models
2. **Processor** → `app/processors/new_processor.py` — Pure functions for data processing
3. **Service** → `app/services/new_service.py` — Business logic orchestration
4. **Route** → `app/api/v1/new_feature.py` — FastAPI endpoints
5. **Register** → Add `include_router(new_router, prefix="/api/v1")` in `app/api/router.py`
6. **Test** → `tests/test_new_feature.py`, `tests/test_new_service.py`

Each new service is fully isolated and doesn't touch existing code beyond the router registration.
