#!/usr/bin/env python3
"""Render teaching-style lesson videos.

Classroom layout (Grade 12 LS Continuity / Derivatives / Brevet Thales)
matches the in-app ClassroomStudio on /classroom/[id]:
  1. Top banner: public/classroom/students.jpg (object-position center 70%)
  2. Stage row: left teacher column (munzer.jpg / munzer-write.jpg) + right cream board
  3. Board writing: typewriter reveal + graphs
  4. Bottom caption in the spoken language

Legacy layout (Grade 12 LS Limits Arabic spec) keeps the older still-image board.

Usage:
  python3 scripts/render-lesson-video.py content/lessons/grade-12-ls-continuity/video.json --both
  python3 scripts/render-lesson-video.py content/grade-12-ls-limits/intro-video.json \\
      public/videos/grade-12-ls-limits-intro.mp4 --lang ar
  python3 scripts/render-lesson-video.py content/lessons/grade-12-ls-continuity/video.json --preview

Requires: ffmpeg, Pillow. Optional TTS: edge-tts (preferred), gTTS, or espeak-ng.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from lesson_graphs import draw_graph  # noqa: E402

try:
    import arabic_reshaper
except ImportError:
    arabic_reshaper = None  # type: ignore

NAVY = (16, 33, 61)
NAVY_DEEP = (11, 24, 46)
GOLD = (217, 170, 83)
WHITE = (255, 255, 255)
INK = (21, 35, 59)
MUTED = (199, 212, 230)
CREAM = (247, 244, 234)
BOARD_LINE = (214, 201, 168)

PHASE = {
    "en": {
        "hook": "Hook",
        "idea": "One idea",
        "example": "Worked example",
        "graph": "On the board",
        "mistake": "Common mistake",
        "recap": "Recap",
    },
    "fr": {
        "hook": "Accroche",
        "idea": "Une idée",
        "example": "Exemple résolu",
        "graph": "Au tableau",
        "mistake": "Erreur fréquente",
        "recap": "Bilan",
    },
    "ar": {
        "hook": "افتتاح",
        "idea": "فكرة واحدة",
        "example": "مثال محلول",
        "graph": "على اللوح",
        "mistake": "خطأ شائع",
        "recap": "خلاصة",
    },
}

TTS_VOICES = {
    "en": "en-US-AndrewNeural",
    "fr": "fr-FR-HenriNeural",
}
TTS_RATE = "-15%"
SENTENCE_PAUSE = " ... "
FPS = 16
CHAR_MS = 28

AR_FONT = "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf"
AR_FONT_BOLD = "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Bold.ttf"
LATIN = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
LATIN_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    if Path(path).exists():
        return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def has_arabic(text: str) -> bool:
    return any("\u0600" <= ch <= "\u06FF" for ch in text)


def reshape_ar(text: str) -> str:
    if arabic_reshaper is None:
        return text
    return arabic_reshaper.reshape(text)


def wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int, rtl: bool = False) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    probe = ImageDraw.Draw(Image.new("RGB", (4, 4)))
    for word in words:
        trial = f"{current} {word}".strip()
        shown = reshape_ar(trial) if rtl else trial
        bbox = probe.textbbox((0, 0), shown, font=font)
        if bbox[2] - bbox[0] <= max_width or not current:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [""]


def draw_ar_line(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, font, fill, anchor="ra"):
    draw.text(xy, reshape_ar(text), font=font, fill=fill, anchor=anchor)


def rounded_rect(draw: ImageDraw.ImageDraw, box, fill, radius=18):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def css_cover(src: Image.Image, tw: int, th: int, pos_x: float = 0.5, pos_y: float = 0.22, zoom: float = 1.0) -> Image.Image:
    """Match CSS object-fit: cover + object-position."""
    sw, sh = src.size
    scale = max(tw / sw, th / sh) * max(zoom, 1.0)
    nw, nh = max(tw, int(sw * scale + 0.5)), max(th, int(sh * scale + 0.5))
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    left = int(pos_x * (nw - tw))
    top = int(pos_y * (nh - th))
    left = max(0, min(max(0, nw - tw), left))
    top = max(0, min(max(0, nh - th), top))
    return resized.crop((left, top, left + tw, top + th))


def sentences_for_tts(text: str) -> str:
    parts = re.split(r"(?<=[.!?؟])\s+", text.strip())
    return SENTENCE_PAUSE.join(p.strip() for p in parts if p.strip())


def audio_duration(path: Path) -> float:
    probe = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    try:
        return float(probe.stdout.strip())
    except ValueError:
        return 0.0


def synthesize_speech(text: str, lang: str, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    spoken = sentences_for_tts(text)
    voice = TTS_VOICES.get(lang, TTS_VOICES["en"])
    edge = shutil.which("edge-tts") or str(Path.home() / ".local/bin/edge-tts")
    if Path(edge).is_file() or shutil.which("edge-tts"):
        try:

            async def _run() -> None:
                import edge_tts

                communicate = edge_tts.Communicate(spoken, voice, rate=TTS_RATE)
                await communicate.save(str(dest))

            asyncio.run(_run())
            if dest.is_file() and dest.stat().st_size > 500:
                return True
        except Exception as exc:  # noqa: BLE001
            print(f"edge-tts failed ({exc}); trying fallback", file=sys.stderr)

    try:
        from gtts import gTTS

        gTTS(text=spoken, lang="fr" if lang == "fr" else "en", slow=True).save(str(dest))
        if dest.is_file() and dest.stat().st_size > 500:
            return True
    except Exception as exc:  # noqa: BLE001
        print(f"gTTS failed ({exc}); trying espeak", file=sys.stderr)

    espeak = shutil.which("espeak-ng") or shutil.which("espeak")
    if espeak:
        voice_flag = "fr" if lang == "fr" else "en-us"
        wav = dest.with_suffix(".wav")
        subprocess.run([espeak, "-v", voice_flag, "-s", "120", "-w", str(wav), spoken], check=False)
        if wav.is_file():
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(wav), "-ar", "24000", "-ac", "1", str(dest)],
                check=False,
                capture_output=True,
            )
            wav.unlink(missing_ok=True)
            return dest.is_file()
    return False


def write_silence(dest: Path, seconds: float) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=24000:cl=mono",
            "-t",
            f"{max(seconds, 0.4):.2f}",
            str(dest),
        ],
        check=True,
        capture_output=True,
    )


def pick_pose_path(spec: dict, scene: dict, root: Path) -> Path | None:
    poses = spec.get("poses") or {}
    pose_key = scene.get("pose") or spec.get("default_pose") or "talk"
    rel = poses.get(pose_key) or spec.get("teacher_photo")
    if pose_key == "write" and spec.get("teacher_write"):
        rel = spec["teacher_write"]
    if not rel:
        return None
    path = root / rel
    return path if path.is_file() else None


# ---------------------------------------------------------------------------
# Legacy still-image renderer (Limits Arabic unit)
# ---------------------------------------------------------------------------


def render_legacy_scene(spec: dict, scene: dict, lang: str, fonts: dict, root: Path) -> Image.Image:
    w, h = int(spec.get("width", 1280)), int(spec.get("height", 720))
    cap_h = int(spec.get("caption_height", 128))
    img = Image.new("RGB", (w, h), NAVY_DEEP)
    pose_path = pick_pose_path(spec, scene, root)
    teacher_path = root / spec.get("teacher_photo", "public/teachers/munzer.jpg")

    if pose_path is not None:
        photo = ImageEnhance.Contrast(Image.open(pose_path).convert("RGB")).enhance(1.04)
        photo = photo.resize((w, h), Image.Resampling.LANCZOS)
        img.paste(photo, (0, 0))
    elif teacher_path.is_file():
        raw = Image.open(teacher_path).convert("RGB")
        crop_w = int(raw.width * 0.46)
        person = raw.crop((0, int(raw.height * 0.02), crop_w, raw.height))
        col_w = 420
        scale = (h - cap_h) / person.height
        person = person.resize((int(person.width * scale), h - cap_h), Image.Resampling.LANCZOS)
        if person.width > col_w:
            left = max(0, (person.width - col_w) // 6)
            person = person.crop((left, 0, left + col_w, person.height))
        img.paste(person, (0, 0))
        draw = ImageDraw.Draw(img)
        rounded_rect(draw, [col_w + 16, 70, w - 20, h - cap_h - 12], CREAM, 18)
    else:
        draw = ImageDraw.Draw(img)
        rounded_rect(draw, [36, 70, w - 20, h - cap_h - 12], CREAM, 18)

    region = spec.get("board_region") or [0.44, 0.09, 0.965, 0.74]
    bx0, by0 = int(region[0] * w), int(region[1] * h)
    bx1, by1 = int(region[2] * w), int(region[3] * h)
    by1 = min(by1, h - cap_h - 16)
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.rounded_rectangle([bx0, by0, bx1, by1], radius=14, fill=(247, 244, 234, 228))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, h - cap_h, w, h], fill=(8, 18, 34))
    draw.rectangle([bx0 + 10, by0 + 8, bx1 - 10, by0 + 14], fill=GOLD)

    course = spec.get(f"course_label_{lang}") or spec.get("course_label_en") or spec.get("title_en") or "MathMentor"
    phase = scene.get("phase", "")
    phase_label = PHASE.get(lang, PHASE["en"]).get(phase, phase)
    rtl = lang == "ar"
    teacher_name = "Professeur Munzer Haddara" if lang == "fr" else "Professor Munzer Haddara"
    rounded_rect(draw, [18, h - cap_h - 46, 400, h - cap_h - 12], (16, 33, 61), 10)
    draw.text((30, h - cap_h - 40), teacher_name, font=fonts["latin_sm"], fill=GOLD)

    if rtl:
        draw_ar_line(draw, (bx1 - 24, by0 + 28), str(course), fonts["ar_sm"], INK, "ra")
        draw_ar_line(draw, (bx1 - 24, by0 + 56), phase_label, fonts["ar"], GOLD, "ra")
        y = by0 + 86
    else:
        draw.text((bx0 + 22, by0 + 22), f"MathMentor · {course}", font=fonts["latin_sm"], fill=INK)
        draw.text((bx0 + 22, by0 + 44), phase_label, font=fonts["latin"], fill=GOLD)
        y = by0 + 78
    math_font = fonts["math"]
    board_font = fonts["ar_board"] if rtl else fonts["latin_board"]
    for line in scene.get("board_math") or []:
        if not line:
            y += 10
            continue
        if has_arabic(line) and rtl:
            draw_ar_line(draw, (bx1 - 28, y + 16), line, fonts["ar_board"], INK, "ra")
        else:
            draw.text((bx0 + 24, y), line, font=math_font, fill=INK)
        y += 40
        if y > by1 - 40:
            break

    y += 6
    spoken_lines = scene.get(f"board_{lang}") or scene.get("board_en") or scene.get("board_ar") or []
    max_w = bx1 - bx0 - 52
    for line in spoken_lines:
        wrapped = wrap_text(line, board_font, max_w, rtl=rtl)
        for wrapped_line in wrapped:
            if y > by1 - 36:
                break
            if rtl:
                draw_ar_line(draw, (bx1 - 28, y + 16), wrapped_line, board_font, INK, "ra")
            else:
                draw.text((bx0 + 24, y), wrapped_line, font=board_font, fill=INK)
            y += 36

    caption = scene.get(f"caption_{lang}") or scene.get(f"narration_{lang}") or scene.get("caption") or ""
    cap_font = fonts["ar_cap"] if rtl else fonts["latin_cap"]
    cap_lines = wrap_text(caption, cap_font, w - 80, rtl=rtl)[:3]
    cy = h - cap_h + 22
    for line in cap_lines:
        shown = reshape_ar(line) if rtl else line
        bbox = draw.textbbox((0, 0), shown, font=cap_font)
        tw = bbox[2] - bbox[0]
        x = (w - tw) // 2
        if rtl:
            draw_ar_line(draw, (w - 40, cy), line, cap_font, WHITE, "ra")
        else:
            draw.text((x, cy), line, font=cap_font, fill=WHITE)
        cy += 34
    return img


def encode_still_scene(png: Path, audio: Path, duration: float, dest: Path) -> None:
    cmd = [
        "ffmpeg",
        "-y",
        "-loop",
        "1",
        "-i",
        str(png),
        "-i",
        str(audio),
        "-vf",
        "fps=30,format=yuv420p",
        "-c:v",
        "libx264",
        "-tune",
        "stillimage",
        "-crf",
        "26",
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        "-pix_fmt",
        "yuv420p",
        "-t",
        f"{duration:.3f}",
        "-movflags",
        "+faststart",
        str(dest),
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def concat_mp4(parts: list[Path], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    list_path = parts[0].parent / "concat.txt"
    list_path.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_path),
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            str(output),
        ],
        check=True,
        capture_output=True,
    )


# ---------------------------------------------------------------------------
# In-app ClassroomStudio layout
# ---------------------------------------------------------------------------


def classroom_fonts() -> dict:
    return {
        "eyebrow": load_font(LATIN_BOLD, 13),
        "title": load_font(LATIN_BOLD, 26),
        "phase": load_font(LATIN_BOLD, 18),
        "board": load_font(LATIN_BOLD, 24),
        "note": load_font(LATIN, 20),
        "graph": load_font(LATIN_BOLD, 16),
        "caption": load_font(LATIN_BOLD, 22),
        "plate": load_font(LATIN_BOLD, 15),
        "tag": load_font(LATIN_BOLD, 13),
    }


def board_lines(scene: dict, lang: str) -> list[str]:
    math_lines = [line for line in (scene.get("board_math") or []) if line is not None]
    spoken = scene.get(f"board_{lang}") or scene.get("board_en") or []
    lines: list[str] = []
    for line in math_lines:
        lines.append(line)
    if math_lines and spoken:
        lines.append("")
    lines.extend(spoken)
    return lines


def typewriter_text(lines: list[str], elapsed: float) -> tuple[list[str], bool]:
    joined = "\n".join(lines)
    n = len(joined)
    shown_n = min(n, max(1, int(elapsed / (CHAR_MS / 1000.0)) + 1)) if n else 0
    shown = joined[:shown_n]
    return shown.split("\n") if shown else [""], shown_n < n


def compose_classroom_frame(
    spec: dict,
    scene: dict,
    lang: str,
    fonts: dict,
    students: Image.Image,
    teacher_talk: Image.Image,
    teacher_write: Image.Image,
    elapsed: float,
    duration: float,
) -> Image.Image:
    w, h = int(spec.get("width", 1280)), int(spec.get("height", 720))
    cap_h = int(spec.get("caption_height", 96))
    students_h = 176
    teacher_w = 252
    stage_top = students_h
    stage_h = h - students_h - cap_h
    t = 0.0 if duration <= 0 else min(1.0, elapsed / duration)
    writing = scene.get("pose") == "write"

    frame = Image.new("RGB", (w, h), NAVY)
    # Students banner — CSS .students-photo object-position: center 70%
    banner = css_cover(students, w, students_h, pos_x=0.50, pos_y=0.70, zoom=1.0 + 0.02 * t)
    banner = ImageEnhance.Brightness(banner).enhance(0.94)
    dim = Image.new("RGBA", (w, students_h), (16, 33, 61, 50))
    banner = Image.alpha_composite(banner.convert("RGBA"), dim).convert("RGB")
    frame.paste(banner, (0, 0))

    draw = ImageDraw.Draw(frame)
    tag = "Protected classroom · no download"
    tw = int(draw.textlength(tag, font=fonts["tag"]))
    rounded_rect(draw, [16, students_h - 40, 28 + tw, students_h - 12], (16, 33, 61), 999)
    draw.text((22, students_h - 36), tag, font=fonts["tag"], fill=GOLD)

    # Teacher column — crop onto Munzer (the known likeness), not the photo's other board.
    src = teacher_write if writing else teacher_talk
    zoom = 1.22 + 0.05 * t if writing else 1.55 + 0.04 * t
    pos_y = (0.30 if writing else 0.38) + 0.02 * math.sin(t * math.pi)
    pos_x = 0.54 if writing else 0.20
    col = css_cover(src, teacher_w, stage_h, pos_x=pos_x, pos_y=pos_y, zoom=zoom)
    frame.paste(col, (0, stage_top))

    plate_h = 48
    overlay = Image.new("RGBA", (teacher_w, plate_h), (16, 33, 61, 220))
    frame.paste(overlay, (0, stage_top + stage_h - plate_h), overlay)
    draw = ImageDraw.Draw(frame)
    if lang == "fr":
        plate_1 = "Professeur Munzer"
        plate_2 = "il écrit maintenant" if writing else ""
    else:
        plate_1 = "Professor Munzer"
        plate_2 = "writing now" if writing else ""
    draw.text((10, stage_top + stage_h - plate_h + 6), plate_1, font=fonts["plate"], fill=GOLD)
    if plate_2:
        draw.text((10, stage_top + stage_h - plate_h + 26), plate_2, font=fonts["tag"], fill=GOLD)

    # Cream live board
    bx0, by0 = teacher_w + 16, stage_top + 14
    bx1, by1 = w - 16, stage_top + stage_h - 14
    rounded_rect(draw, [bx0, by0, bx1, by1], CREAM, 16)
    draw.rounded_rectangle([bx0 + 3, by0 + 3, bx1 - 3, by1 - 3], radius=14, outline=BOARD_LINE, width=2)

    course = spec.get(f"course_label_{lang}") or spec.get("title_en") or "MathMentor"
    phase = scene.get("phase", "")
    phase_label = PHASE.get(lang, PHASE["en"]).get(phase, phase)
    eyebrow = "Tableau" if lang == "fr" else "Whiteboard"
    draw.text((bx0 + 22, by0 + 14), eyebrow.upper(), font=fonts["eyebrow"], fill=(168, 140, 72))
    draw.text((bx0 + 22, by0 + 34), course, font=fonts["title"], fill=NAVY)
    gold_w = min(int(draw.textlength(course, font=fonts["title"]) + 8), bx1 - bx0 - 48)
    draw.rectangle((bx0 + 22, by0 + 66, bx0 + 22 + gold_w, by0 + 70), fill=GOLD)
    draw.text((bx0 + 22, by0 + 78), phase_label, font=fonts["phase"], fill=GOLD)

    graph = scene.get("graph")
    text_top = by0 + 110
    split = bool(graph)
    graph_box = (bx0 + 308, text_top - 8, bx1 - 18, by1 - 16) if split else None
    text_bottom = by1 - 18
    lines = board_lines(scene, lang)
    wrap_w = 250 if split else (bx1 - bx0 - 48)
    wrapped: list[str] = []
    math_count = len(scene.get("board_math") or [])
    wrapped_is_math: list[bool] = []
    for i, line in enumerate(lines):
        is_math = i < math_count
        bits = wrap_text(line, fonts["board"] if is_math else fonts["note"], wrap_w) if line else [""]
        wrapped.extend(bits)
        wrapped_is_math.extend([is_math] * len(bits))
    shown, still_writing = typewriter_text(wrapped, elapsed)

    y = text_top
    line_h = 32
    last_w = 0
    for i, line in enumerate(shown):
        if y + line_h > text_bottom:
            break
        font = fonts["board"] if (i < len(wrapped_is_math) and wrapped_is_math[i]) else fonts["note"]
        draw.text((bx0 + 24, y), line, font=font, fill=INK)
        last_w = int(draw.textlength(line, font=font))
        y += line_h

    if still_writing and int(elapsed * 8) % 2 == 0:
        cursor_y = min(y - line_h + 4, text_bottom - 24)
        cursor_x = bx0 + 24 + last_w + 4
        draw.rectangle((cursor_x, cursor_y, cursor_x + 9, cursor_y + 24), fill=GOLD)

    if graph and graph_box is not None:
        gx0, gy0, gx1, gy1 = graph_box
        draw.line([(gx0 - 8, gy0 + 8), (gx0 - 8, gy1 - 8)], fill=BOARD_LINE, width=2)
        draw.rounded_rectangle([gx0, gy0, gx1, gy1], radius=10, fill=(255, 252, 244), outline=(214, 201, 168))
        progress = min(1.0, 0.15 + 0.85 * t)
        draw_graph(draw, (gx0 + 6, gy0 + 6, gx1 - 6, gy1 - 6), graph, fonts["graph"], lang, progress)

    # Caption bar
    draw.rectangle((0, h - cap_h, w, h), fill=(8, 18, 34))
    draw.line((0, h - cap_h, w, h - cap_h), fill=GOLD, width=3)
    caption = scene.get(f"caption_{lang}") or scene.get(f"narration_{lang}") or ""
    cap_lines = wrap_text(caption, fonts["caption"], w - 72)[:3]
    cy = h - cap_h + 16
    for line in cap_lines:
        draw.text((36, cy), line, font=fonts["caption"], fill=WHITE)
        cy += 26
    return frame


def load_classroom_assets(spec: dict, root: Path) -> tuple[Image.Image, Image.Image, Image.Image]:
    students_path = root / spec.get("students_photo", "public/classroom/students.jpg")
    talk_path = root / spec.get("teacher_photo", "public/teachers/munzer.jpg")
    write_rel = spec.get("teacher_write") or spec.get("teacher_photo")
    write_path = root / write_rel
    students = Image.open(students_path).convert("RGB")
    talk = Image.open(talk_path).convert("RGB")
    write = Image.open(write_path).convert("RGB") if write_path.is_file() else talk
    return students, talk, write


def encode_classroom_scene(
    spec: dict,
    scene: dict,
    lang: str,
    fonts: dict,
    students: Image.Image,
    teacher_talk: Image.Image,
    teacher_write: Image.Image,
    audio: Path,
    duration: float,
    dest: Path,
) -> None:
    n_frames = max(int(duration * FPS), 24)
    proc = subprocess.Popen(
        [
            "ffmpeg",
            "-y",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-s",
            f"{int(spec.get('width', 1280))}x{int(spec.get('height', 720))}",
            "-r",
            str(FPS),
            "-i",
            "pipe:0",
            "-i",
            str(audio),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-t",
            f"{duration:.3f}",
            "-movflags",
            "+faststart",
            str(dest),
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    assert proc.stdin is not None
    try:
        for i in range(n_frames):
            elapsed = i / FPS
            frame = compose_classroom_frame(
                spec, scene, lang, fonts, students, teacher_talk, teacher_write, elapsed, duration
            )
            proc.stdin.write(frame.tobytes())
        proc.stdin.close()
        stderr = proc.stderr.read() if proc.stderr else b""
        code = proc.wait()
        if code != 0:
            raise RuntimeError(stderr.decode("utf-8", errors="replace")[-2000:])
    except BrokenPipeError as exc:
        stderr = proc.stderr.read() if proc.stderr else b""
        raise RuntimeError(stderr.decode("utf-8", errors="replace")[-2000:]) from exc


def scene_spoken(scene: dict, lang: str) -> str:
    return (
        scene.get(f"narration_{lang}")
        or scene.get(f"caption_{lang}")
        or scene.get("caption")
        or scene.get("narration")
        or ""
    )


def is_classroom_spec(spec: dict) -> bool:
    return spec.get("layout") == "classroom" or bool(spec.get("students_photo"))


def render_language(spec: dict, spec_path: Path, output: Path, lang: str, preview_dir: Path | None = None) -> None:
    root = Path.cwd()
    fonts_legacy = {
        "ar": load_font(AR_FONT_BOLD, 26),
        "ar_sm": load_font(AR_FONT, 18),
        "ar_board": load_font(AR_FONT, 28),
        "ar_cap": load_font(AR_FONT, 28),
        "latin": load_font(LATIN_BOLD, 22),
        "latin_sm": load_font(LATIN_BOLD, 16),
        "latin_board": load_font(LATIN, 26),
        "latin_cap": load_font(LATIN, 26),
        "math": load_font(LATIN_BOLD, 30),
    }
    fonts_class = classroom_fonts()
    classroom = is_classroom_spec(spec)
    students = teacher_talk = teacher_write = None
    if classroom:
        students, teacher_talk, teacher_write = load_classroom_assets(spec, root)

    if preview_dir is not None and classroom:
        preview_dir.mkdir(parents=True, exist_ok=True)
        for index, scene in enumerate(spec["scenes"]):
            duration = float(scene.get("duration", 12))
            frame = compose_classroom_frame(
                spec,
                scene,
                lang,
                fonts_class,
                students,  # type: ignore[arg-type]
                teacher_talk,  # type: ignore[arg-type]
                teacher_write,  # type: ignore[arg-type]
                elapsed=duration * 0.88,
                duration=duration,
            )
            dest = preview_dir / f"{spec.get('id', 'lesson')}-{lang}-s{index:02d}-{scene.get('id', index)}.jpg"
            frame.save(dest, quality=92)
            print(f"Preview {dest}")
        return

    tmp = Path(tempfile.mkdtemp(prefix="mm-video-"))
    parts: list[Path] = []
    try:
        total = 0.0
        for index, scene in enumerate(spec["scenes"]):
            spoken = scene_spoken(scene, lang)
            audio = tmp / f"scene-{index:02d}.mp3"
            requested = float(scene.get("duration", 8))
            if spoken.strip() and synthesize_speech(spoken.strip(), lang, audio):
                duration = max(requested, audio_duration(audio) + 0.55)
            else:
                write_silence(audio, requested)
                duration = requested
            clip = tmp / f"scene-{index:02d}.mp4"
            if classroom:
                encode_classroom_scene(
                    spec,
                    scene,
                    lang,
                    fonts_class,
                    students,  # type: ignore[arg-type]
                    teacher_talk,  # type: ignore[arg-type]
                    teacher_write,  # type: ignore[arg-type]
                    audio,
                    duration,
                    clip,
                )
            else:
                image = render_legacy_scene(spec, scene, lang, fonts_legacy, root)
                png = tmp / f"scene-{index:02d}.png"
                image.save(png, "PNG")
                encode_still_scene(png, audio, duration, clip)
            parts.append(clip)
            total += duration
        concat_mp4(parts, output)
        print(f"Wrote {output} ({total:.0f}s, {len(parts)} scenes, lang={lang})")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("spec", type=Path, help="Lesson JSON spec")
    parser.add_argument("output", nargs="?", type=Path, help="Output mp4 (not needed with --both)")
    parser.add_argument("--lang", choices=("en", "fr", "ar"), default="en")
    parser.add_argument("--both", action="store_true", help="Render EN and FR from spec.outputs")
    parser.add_argument("--preview", action="store_true", help="Write preview JPEGs, skip encoding")
    parser.add_argument("--preview-dir", type=Path, default=None)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    spec = json.loads(args.spec.read_text(encoding="utf-8"))
    outputs = spec.get("outputs") or {}
    preview_dir = args.preview_dir
    if args.preview:
        preview_dir = preview_dir or Path("/tmp/mm-classroom-preview")
    if args.both:
        if preview_dir is not None:
            render_language(spec, args.spec, Path("/tmp/unused.mp4"), "en", preview_dir=preview_dir)
            return 0
        en = Path(outputs.get("en") or (args.output or Path("public/videos/lesson-en.mp4")))
        fr = Path(outputs.get("fr") or Path(str(en).replace("-en.mp4", "-fr.mp4")))
        render_language(spec, args.spec, en, "en")
        render_language(spec, args.spec, fr, "fr")
        return 0
    if args.output is None:
        hinted = outputs.get(args.lang) or spec.get("output_hint")
        if not hinted and preview_dir is None:
            print("Pass an output path or --both", file=sys.stderr)
            return 2
        args.output = Path(hinted) if hinted else Path("/tmp/unused.mp4")
    render_language(spec, args.spec, args.output, args.lang, preview_dir=preview_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
