import cv2
import numpy as np

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
        assert result[:4] == b"\x89PNG"

    def test_blank_image_produces_empty_map(self):
        img = _make_white_image()
        result_bytes = generate_reveal_map(img)
        arr = np.frombuffer(result_bytes, np.uint8)
        decoded = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
        assert decoded is not None
        ink_ratio = np.count_nonzero(decoded) / decoded.size
        assert ink_ratio < 0.05

    def test_text_image_has_nonzero_timing(self):
        img = _make_image_with_text()
        result_bytes = generate_reveal_map(img)
        arr = np.frombuffer(result_bytes, np.uint8)
        decoded = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
        assert decoded is not None
        assert np.count_nonzero(decoded) > 0
