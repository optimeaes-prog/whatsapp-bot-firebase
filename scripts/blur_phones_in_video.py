#!/usr/bin/env python3
"""
Blur regions that look like phone numbers in a video (OCR + Gaussian blur).
Uses Tesseract on a downscaled frame for speed; maps boxes back to full resolution.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
import pytesseract

# Homebrew default on Apple Silicon
_DEFAULT_TESS = "/opt/homebrew/bin/tesseract"
if Path(_DEFAULT_TESS).exists():
    pytesseract.pytesseract.tesseract_cmd = _DEFAULT_TESS


@dataclass
class WordBox:
    text: str
    left: int
    top: int
    width: int
    height: int
    line_num: int
    conf: int


def _digits_only(s: str) -> str:
    return re.sub(r"\D", "", s)


def looks_like_phone(text: str) -> bool:
    """True if stripped digits form a plausible phone (9–15 digits)."""
    d = _digits_only(text)
    if len(d) == 9 and re.match(r"^[6789]\d{8}$", d):
        return True
    if len(d) < 10 or len(d) > 15:
        return False
    # Skip common false positives: years and compact timestamps
    if re.search(r"\b20\d{2}\b", text) and len(d) <= 12:
        pass  # still could be phone; rely on length
    if re.match(r"^\d{1,2}:\d{2}(:\d{2})?$", text.strip()):
        return False
    if re.search(r"\d{4}-\d{2}-\d{2}", text):
        return False
    return True


def parse_tesseract_words(
    data: dict,
    min_conf: int = 35,
) -> list[WordBox]:
    n = len(data["text"])
    out: list[WordBox] = []
    for i in range(n):
        t = (data["text"][i] or "").strip()
        if not t:
            continue
        try:
            conf = int(data["conf"][i])
        except (ValueError, TypeError):
            continue
        if conf < min_conf:
            continue
        w = int(data["width"][i])
        h = int(data["height"][i])
        if w < 2 or h < 2:
            continue
        out.append(
            WordBox(
                text=t,
                left=int(data["left"][i]),
                top=int(data["top"][i]),
                width=w,
                height=h,
                line_num=int(data["line_num"][i]),
                conf=conf,
            )
        )
    return out


def phone_blur_boxes_for_line(words: list[WordBox]) -> list[tuple[int, int, int, int]]:
    """Return list of (x1,y1,x2,y2) in OCR pixel coords for this line."""
    if not words:
        return []
    words = sorted(words, key=lambda w: w.left)
    boxes: list[tuple[int, int, int, int]] = []
    n = len(words)
    for i in range(n):
        for j in range(i + 1, n + 1):
            segment = " ".join(w.text for w in words[i:j])
            if looks_like_phone(segment):
                x1 = min(w.left for w in words[i:j])
                y1 = min(w.top for w in words[i:j])
                x2 = max(w.left + w.width for w in words[i:j])
                y2 = max(w.top + w.height for w in words[i:j])
                boxes.append((x1, y1, x2, y2))
    # Merge overlapping / very close boxes
    if not boxes:
        return []
    boxes.sort()
    merged: list[tuple[int, int, int, int]] = []
    cur = list(boxes[0])
    pad = 4
    for b in boxes[1:]:
        if b[0] <= cur[2] + pad and b[1] <= cur[3] + pad:
            cur[0] = min(cur[0], b[0])
            cur[1] = min(cur[1], b[1])
            cur[2] = max(cur[2], b[2])
            cur[3] = max(cur[3], b[3])
        else:
            merged.append(tuple(cur))
            cur = list(b)
    merged.append(tuple(cur))
    return merged


def collect_blur_boxes_ocr(gray_small: np.ndarray) -> list[tuple[int, int, int, int]]:
    data = pytesseract.image_to_data(
        gray_small,
        output_type=pytesseract.Output.DICT,
        config="--psm 6 --oem 3",
    )
    words = parse_tesseract_words(data)
    by_line: dict[int, list[WordBox]] = {}
    for w in words:
        by_line.setdefault(w.line_num, []).append(w)
    all_boxes: list[tuple[int, int, int, int]] = []
    for line_words in by_line.values():
        all_boxes.extend(phone_blur_boxes_for_line(line_words))
    return all_boxes


def scale_box(
    box: tuple[int, int, int, int],
    sx: float,
    sy: float,
    fw: int,
    fh: int,
    pad: int,
) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = box
    x1 = int(x1 * sx) - pad
    y1 = int(y1 * sy) - pad
    x2 = int(x2 * sx) + pad
    y2 = int(y2 * sy) + pad
    x1 = max(0, x1)
    y1 = max(0, y1)
    x2 = min(fw, x2)
    y2 = min(fh, y2)
    if x2 <= x1 or y2 <= y1:
        return (0, 0, 0, 0)
    return (x1, y1, x2, y2)


def blur_regions(frame: np.ndarray, boxes: list[tuple[int, int, int, int]]) -> None:
    for (x1, y1, x2, y2) in boxes:
        if x2 <= x1 or y2 <= y1:
            continue
        roi = frame[y1:y2, x1:x2]
        if roi.size == 0:
            continue
        h, w = roi.shape[:2]
        k = max(h | 1, w | 1)
        if k % 2 == 0:
            k += 1
        k = min(k, 151)
        blurred = cv2.GaussianBlur(roi, (k, k), 0)
        frame[y1:y2, x1:x2] = blurred


def main() -> int:
    ap = argparse.ArgumentParser(description="Blur phone-like numbers in a video.")
    ap.add_argument("input", type=Path, help="Input video path")
    ap.add_argument("output", type=Path, help="Output video path")
    ap.add_argument(
        "--ocr-max-width",
        type=int,
        default=720,
        help="Width to resize for OCR (smaller = faster, may miss small text)",
    )
    ap.add_argument(
        "--pad",
        type=int,
        default=12,
        help="Extra padding in full-resolution pixels around each blur box",
    )
    args = ap.parse_args()

    inp = args.input.resolve()
    out = args.output.resolve()
    if not inp.is_file():
        print(f"Input not found: {inp}", file=sys.stderr)
        return 1

    cap = cv2.VideoCapture(str(inp))
    if not cap.isOpened():
        print(f"Could not open video: {inp}", file=sys.stderr)
        return 1

    fw = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    fh = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    nframes = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0

    ocr_w = min(args.ocr_max_width, fw)
    sx = fw / ocr_w
    ocr_h = int(round(fh / sx))
    sy = fh / ocr_h

    ffmpeg = "/opt/homebrew/bin/ffmpeg"
    cmd = [
        ffmpeg,
        "-y",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "bgr24",
        "-s",
        f"{fw}x{fh}",
        "-r",
        str(fps),
        "-i",
        "-",
        "-i",
        str(inp),
        "-map",
        "0:v:0",
        "-map",
        "1:a:0?",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        str(out),
    ]
    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    assert proc.stdin is not None

    idx = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            small = cv2.resize(frame, (ocr_w, ocr_h), interpolation=cv2.INTER_AREA)
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            ocr_boxes = collect_blur_boxes_ocr(gray)
            full_boxes = [
                scale_box(b, sx, sy, fw, fh, args.pad)
                for b in ocr_boxes
            ]
            full_boxes = [b for b in full_boxes if b[2] > b[0] and b[3] > b[1]]
            blur_regions(frame, full_boxes)
            proc.stdin.write(frame.tobytes())
            idx += 1
            if idx % 100 == 0 and nframes:
                print(f"Frames {idx}/{nframes} ({100 * idx / nframes:.1f}%)", flush=True)
            elif idx % 100 == 0:
                print(f"Frames {idx}", flush=True)
    finally:
        cap.release()
        proc.stdin.close()
        proc.wait()
    if proc.returncode != 0:
        print(f"ffmpeg exited with {proc.returncode}", file=sys.stderr)
        return proc.returncode
    print(f"Wrote {out} ({idx} frames)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
