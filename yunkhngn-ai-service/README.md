<p align="center">
  <img src="https://fastapi.tiangolo.com/img/logo-margin/logo-teal.png" width="200" alt="FastAPI Logo" />
</p>

# yunkhngn-ai

> AI microservice for [yunkhngn.dev](https://yunkhngn.dev) — handles letter processing with OpenCV-powered handwriting reveal map generation.

Built with **Python 3.11**, **FastAPI**, and **OpenCV**.

---

## What It Does

This service processes scanned handwritten letters to generate **reveal timing maps** — grayscale images where each pixel value (1–255) represents the order in which ink strokes should be animated on the frontend, creating a "writing reveal" effect.

### Processing Pipeline

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│  NestJS BE   │────▶│  Download     │────▶│  OpenCV      │────▶│ Cloudinary│
│  POST /process│    │  Image        │     │  Processing  │     │  Upload   │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────┘
                                                                     │
┌─────────────┐                                                      │
│  NestJS BE   │◀───────────── Callback with reveal map URLs ────────┘
│  /callback   │
└─────────────┘
```

1. **Download** — Fetch scanned letter page images from Cloudinary URLs
2. **Validate** — Check resolution, contrast, and scan quality
3. **Process** — Generate reveal timing map using:
   - CLAHE contrast enhancement
   - Adaptive + Otsu dual thresholding for ink detection
   - Connected component noise filtering
   - Horizontal projection for text line band detection
   - Per-line left-to-right timing assignment
4. **Upload** — Push the generated PNG reveal map to Cloudinary
5. **Callback** — Notify the NestJS backend with the results

---

## Architecture

```
yunkhngn-ai/
├── main.py                        # FastAPI app + routes
├── services/
│   ├── image_processor.py         # OpenCV reveal map generation
│   └── cloudinary_client.py       # Cloudinary upload helper
├── Dockerfile                     # Python 3.11-slim + OpenCV deps
├── requirements.txt               # Pinned dependencies
├── .env.example                   # Environment variable template
└── .github/
    └── workflows/
        └── deploy.yml             # CI/CD pipeline
```

---

## Tech Stack

| Component | Technology |
|:----------|:-----------|
| Framework | FastAPI 0.115 |
| Language | Python 3.11 |
| Image Processing | OpenCV 4.10 (headless) |
| Numerical Computing | NumPy 2.1 |
| Cloud Storage | Cloudinary |
| HTTP Client | httpx |
| Server | Uvicorn |

---

## API Endpoints

| Method | Path | Description | Auth |
|:-------|:-----|:------------|:-----|
| `POST` | `/process` | Process letter pages (async, fires callback) | Internal |
| `POST` | `/validate` | Validate a scanned image for quality | Internal |
| `GET` | `/health` | Health check | Public |

### POST /process

Triggers async background processing. Returns immediately with `{"status": "processing"}`.

```json
// Request
{
  "letterId": "uuid",
  "pages": [
    { "id": "page-uuid", "imageUrl": "https://res.cloudinary.com/..." }
  ],
  "callbackUrl": "https://api.yunkhngn.dev/letters/processing-callback"
}

// Immediate Response (202)
{
  "status": "processing",
  "letterId": "uuid"
}

// Callback POST to callbackUrl
{
  "letterId": "uuid",
  "pages": [
    { "id": "page-uuid", "revealMapUrl": "https://res.cloudinary.com/..." }
  ],
  "success": true
}
```

### POST /validate

Quick quality check before creating a letter.

```json
// Request
{ "imageUrl": "https://res.cloudinary.com/..." }

// Response
{
  "valid": true,
  "issues": [],
  "width": 2480,
  "height": 3508
}
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Cloudinary account

### Installation

```bash
# Clone
git clone https://github.com/yunkhngn/yunkhngn-ai.git
cd yunkhngn-ai

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your Cloudinary credentials

# Start development server
uvicorn main:app --reload --port 8000
```

### Environment Variables

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## OpenCV Processing Details

### Ink Detection

Uses a **dual-threshold union** strategy for maximum ink detection:

1. **Adaptive Threshold** (Gaussian, blockSize=31, C=5) — catches faint/thin strokes
2. **Otsu Threshold** — catches bold strokes reliably
3. **Union** (bitwise OR) — if either method finds ink, it's kept

Pre-processed with CLAHE (clipLimit=2.0, 16×16 grid) for contrast enhancement.

### Line Detection

Uses **horizontal projection** to detect text line bands:
- Smooth the row-wise ink density with Gaussian blur
- Find consecutive rows above 10% of max density
- Auto-split oversized bands (>8% of image height) into sub-lines
- Gap tolerance prevents splitting within characters

### Timing Assignment

Each ink pixel gets a timing value (1–255):
- **10%** of the timeline for line transitions (top → bottom)
- **90%** for within-line sweep (left → right)
- Stray pixels outside detected bands get Y-based timing as fallback

---

## Deployment

Deployed as a Docker container via GitHub Actions:

```dockerfile
FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

In production, it runs as `yunkhngn-ai-service` in the Docker Compose stack, accessible internally by the NestJS backend via `http://ai-service:8000`.

---

## Integration with Backend

The NestJS backend (`yunkhngn-be`) communicates with this service via:

```
LETTER_AI_URL=http://ai-service:8000
```

Flow:
1. Admin uploads scanned letter pages → Backend stores in Cloudinary
2. Backend calls `POST /api/v1/letter/process` with page URLs + callback URL
3. This service processes asynchronously
4. On completion, this service POSTs results to the backend's callback endpoint
5. Backend updates letter status to "ready" and stores reveal map URLs

---

## License

Private — All rights reserved.
