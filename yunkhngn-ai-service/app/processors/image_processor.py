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

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(16, 16))
    enhanced = clahe.apply(gray)

    adaptive_binary = cv2.adaptiveThreshold(
        enhanced,
        255,
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

    row_ink = np.sum(binary > 0, axis=1)

    smooth_window = max(3, h // 200)
    if smooth_window % 2 == 0:
        smooth_window += 1
    row_ink_smooth = cv2.GaussianBlur(
        row_ink.astype(np.float32).reshape(-1, 1),
        (1, smooth_window),
        0,
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

    band_info = []
    for start_y, end_y in line_bands:
        band_slice = binary[start_y : end_y + 1, :]
        ink_cols = np.where(np.any(band_slice > 0, axis=0))[0]
        if len(ink_cols) > 0:
            min_x = int(ink_cols[0])
            max_x = int(ink_cols[-1])
        else:
            min_x, max_x = 0, w - 1
        band_info.append(
            {
                "start_y": start_y,
                "end_y": end_y,
                "min_x": min_x,
                "max_x": max_x,
            }
        )

    num_bands = len(band_info)
    reveal_map = np.zeros((h, w), dtype=np.uint8)
    TIME_MIN = 1
    TIME_MAX = 255
    total_range = TIME_MAX - TIME_MIN
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
