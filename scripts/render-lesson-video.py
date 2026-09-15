#!/usr/bin/env python3
"""Render a teaching-style lesson video (hook → idea → example → mistake → recap).

Not a bullet-list of objectives. Arabic is reshaped and drawn RTL on a navy board.

Usage:
  python3 scripts/render-lesson-video.py content/grade-12-ls-limits/intro-video.json \\
      public/videos/grade-12-ls-limits-intro.mp4

Requires: ffmpeg, Pillow, arabic-reshaper.
python-bidi is optional and must NOT be applied after reshaping (it double-reverses).
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageEnhance
import arabic_reshaper

NAVY = (16, 33, 61)
NAVY_DEEP = (11, 24, 46)
GOLD = (217, 170, 83)
GOLD_SOFT = (248, 237, 218)
WHITE = (255, 255, 255)
INK = (21, 35, 59)
MUTED = (199, 212, 230)
PHASE_AR = {
    "hook": "افتتاح",
    "idea": "فكرة واحدة",
    "example": "مثال محلول",
    "mistake": "خطأ شائع",
    "recap": "خلاصة",
}

AR_FONT = "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf"
AR_FONT_BOLD = "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Bold.ttf"
MATH_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
MATH_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def reshape_ar(text: str) -> str:
    return arabic_reshaper.reshape(text)


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def has_arabic(text: str) -> bool:
    return any("\u0600" <= ch <= "\u06FF" for ch in text)


def wrap_ar(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    probe = ImageDraw.Draw(Image.new("RGB", (4, 4)))
    for word in words:
        trial = f"{current} {word}".strip()
        shaped = reshape_ar(trial)
        bbox = probe.textbbox((0, 0), shaped, font=font)
        if bbox[2] - bbox[0] <= max_width or not current:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_ar_line(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, font, fill, anchor="ra"):
    draw.text(xy, reshape_ar(text), font=font, fill=fill, anchor=anchor)


def rounded_rect(draw: ImageDraw.ImageDraw, box, fill, radius=24):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def render_scene(spec: dict, scene: dict, fonts: dict, photos: dict) -> Image.Image:
    w, h = spec["width"], spec["height"]
    img = Image.new("RGB", (w, h), NAVY_DEEP)
    draw = ImageDraw.Draw(img)

    # Left teacher column
    col_w = 280
    draw.rectangle([0, 0, col_w, h - 150], fill=NAVY)
    teacher = photos.get("teacher")
    if teacher is not None:
        tw = col_w
        th = h - 150
        cropped = ImageEnhance.Contrast(teacher.convert("RGB")).enhance(1.05)
        cropped = cropped.resize((tw, int(cropped.height * tw / cropped.width)))
        # crop to column
        if cropped.height > th:
            top = int(cropped.height * 0.12)
            cropped = cropped.crop((0, top, tw, top + th))
        img.paste(cropped, (0, 0))
    draw.rounded_rectangle([16, h - 150 - 56, col_w - 16, h - 150 - 12], radius=12, fill=(16, 33, 61, 210))
    draw_ar_line(draw, (col_w - 28, h - 150 - 34), "الأستاذ منذر حدارة", fonts["ar_sm"], GOLD, "ra")

    # Board panel
    margin = 28
    board_box = [col_w + margin, 86, w - margin, h - 168]
    rounded_rect(draw, board_box, (247, 244, 234), radius=22)
    draw.rectangle([board_box[0], board_box[1], board_box[2], board_box[1] + 8], fill=GOLD)

    phase = scene.get("phase", "")
    phase_label = PHASE_AR.get(phase, phase)
    draw_ar_line(draw, (w - margin - 8, 36), "صف 12 علوم الحياة، النهايات", fonts["ar_sm"], GOLD, "ra")
    draw_ar_line(draw, (w - margin - 8, 68), phase_label, fonts["ar"], WHITE, "ra")
    draw.text((col_w + margin, 40), "MathMentor", font=fonts["math_sm"], fill=GOLD)

    bx0, by0, bx1, by1 = board_box
    y = by0 + 28
    if scene.get("show_board_photo") and photos.get("board") is not None:
        photo = photos["board"].convert("RGB")
        max_pw = bx1 - bx0 - 40
        max_ph = 210
        scale = min(max_pw / photo.width, max_ph / photo.height)
        photo = photo.resize((int(photo.width * scale), int(photo.height * scale)))
        img.paste(photo, (bx0 + 20, y))
        y += photo.height + 16

    math_lines = scene.get("board_math") or []
    for line in math_lines:
        if not line:
            y += 12
            continue
        if has_arabic(line):
            draw_ar_line(draw, (bx1 - 36, y + 18), line, fonts["ar_board"], INK, "ra")
        else:
            draw.text((bx0 + 36, y), line, font=fonts["math"], fill=INK)
        y += 44

    y += 8
    for line in scene.get("board_ar") or []:
        for wrapped in wrap_ar(line, fonts["ar_board"], bx1 - bx0 - 72):
            draw_ar_line(draw, (bx1 - 36, y + 18), wrapped, fonts["ar_board"], INK, "ra")
            y += 42

    # Caption bar (spoken-style Arabic)
    cap_top = h - 150
    draw.rectangle([0, cap_top, w, h], fill=(8, 18, 34))
    caption = scene.get("caption") or ""
    cap_lines = wrap_ar(caption, fonts["ar_cap"], w - 64)
    cy = cap_top + 28
    for line in cap_lines[:4]:
        draw_ar_line(draw, (w - 32, cy), line, fonts["ar_cap"], WHITE, "ra")
        cy += 36

    return img


def write_concat(frames: list[tuple[Path, float]], list_path: Path) -> None:
    lines = []
    for path, duration in frames:
        lines.append(f"file '{path.as_posix()}'")
        lines.append(f"duration {duration:.3f}")
    # concat demuxer needs the last file repeated
    lines.append(f"file '{frames[-1][0].as_posix()}'")
    list_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def encode(list_path: Path, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(list_path),
        "-vf",
        "fps=30,format=yuv420p",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "26",
        "-movflags",
        "+faststart",
        str(output),
    ]
    subprocess.run(cmd, check=True)


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    spec_path = Path(sys.argv[1])
    output = Path(sys.argv[2])
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    root = Path.cwd()

    fonts = {
        "ar": load_font(AR_FONT_BOLD, 28),
        "ar_sm": load_font(AR_FONT, 20),
        "ar_board": load_font(AR_FONT, 30),
        "ar_cap": load_font(AR_FONT, 30),
        "math": load_font(MATH_BOLD, 32),
        "math_sm": load_font(MATH_FONT, 18),
    }
    photos: dict[str, Image.Image | None] = {"teacher": None, "board": None}
    teacher_path = root / spec.get("teacher_photo", "")
    board_path = root / spec.get("board_photo", "")
    if teacher_path.is_file():
        photos["teacher"] = Image.open(teacher_path)
    if board_path.is_file():
        photos["board"] = Image.open(board_path)

    tmp = Path(tempfile.mkdtemp(prefix="mm-video-"))
    try:
        frames: list[tuple[Path, float]] = []
        for index, scene in enumerate(spec["scenes"]):
            image = render_scene(spec, scene, fonts, photos)
            path = tmp / f"scene-{index:02d}.png"
            image.save(path, "PNG")
            frames.append((path, float(scene.get("duration", 8))))
        concat = tmp / "concat.txt"
        write_concat(frames, concat)
        encode(concat, output)
        print(f"Wrote {output} ({sum(d for _, d in frames):.0f}s, {len(frames)} scenes)")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
