#!/usr/bin/env python3
"""Render a teaching-style lesson video (hook → idea → example → mistake → recap).

English is the default teaching language (spoken + on-screen writing).
Pass --lang fr for the French video (audio + captions + board text together).

Usage:
  python3 scripts/render-lesson-video.py content/lessons/grade-12-ls-continuity/video.json \\
      public/videos/grade-12-ls-continuity-en.mp4 --lang en
  python3 scripts/render-lesson-video.py content/lessons/grade-12-ls-continuity/video.json --both

Requires: ffmpeg, Pillow. Optional TTS: edge-tts (preferred), gTTS, or espeak-ng.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont

try:
    import arabic_reshaper
except ImportError:  # Arabic specs are optional
    arabic_reshaper = None  # type: ignore

NAVY = (16, 33, 61)
NAVY_DEEP = (11, 24, 46)
GOLD = (217, 170, 83)
WHITE = (255, 255, 255)
INK = (21, 35, 59)
MUTED = (199, 212, 230)
BOARD = (247, 244, 234)

PHASE = {
    "en": {
        "hook": "Hook",
        "idea": "One idea",
        "example": "Worked example",
        "mistake": "Common mistake",
        "recap": "Recap",
    },
    "fr": {
        "hook": "Accroche",
        "idea": "Une idée",
        "example": "Exemple résolu",
        "mistake": "Erreur fréquente",
        "recap": "Bilan",
    },
    "ar": {
        "hook": "افتتاح",
        "idea": "فكرة واحدة",
        "example": "مثال محلول",
        "mistake": "خطأ شائع",
        "recap": "خلاصة",
    },
}

TTS_VOICES = {
    "en": "en-US-AndrewNeural",
    "fr": "fr-FR-HenriNeural",
}

AR_FONT = "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf"
AR_FONT_BOLD = "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Bold.ttf"
LATIN = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
LATIN_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


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
    return lines


def draw_ar_line(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, font, fill, anchor="ra"):
    draw.text(xy, reshape_ar(text), font=font, fill=fill, anchor=anchor)


def rounded_rect(draw: ImageDraw.ImageDraw, box, fill, radius=18):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def pick_pose_path(spec: dict, scene: dict, root: Path) -> Path | None:
    poses = spec.get("poses") or {}
    pose_key = scene.get("pose") or spec.get("default_pose") or "talk"
    rel = poses.get(pose_key) or spec.get("teacher_photo")
    if not rel:
        return None
    path = root / rel
    return path if path.is_file() else None


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
    """Write narration audio. Prefer edge-tts neural voices, then gTTS, then espeak."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    voice = TTS_VOICES.get(lang, TTS_VOICES["en"])
    edge = shutil.which("edge-tts") or str(Path.home() / ".local/bin/edge-tts")
    if Path(edge).is_file() or shutil.which("edge-tts"):
        try:
            async def _run() -> None:
                import edge_tts

                communicate = edge_tts.Communicate(text, voice, rate="-8%")
                await communicate.save(str(dest))

            asyncio.run(_run())
            if dest.is_file() and dest.stat().st_size > 500:
                return True
        except Exception as exc:  # noqa: BLE001
            print(f"edge-tts failed ({exc}); trying fallback", file=sys.stderr)

    try:
        from gtts import gTTS

        gTTS(text=text, lang="fr" if lang == "fr" else "en", slow=False).save(str(dest))
        if dest.is_file() and dest.stat().st_size > 500:
            return True
    except Exception as exc:  # noqa: BLE001
        print(f"gTTS failed ({exc}); trying espeak", file=sys.stderr)

    espeak = shutil.which("espeak-ng") or shutil.which("espeak")
    if espeak:
        voice_flag = "fr" if lang == "fr" else "en-us"
        wav = dest.with_suffix(".wav")
        subprocess.run(
            [espeak, "-v", voice_flag, "-s", "145", "-w", str(wav), text],
            check=False,
        )
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


def render_scene(spec: dict, scene: dict, lang: str, fonts: dict, root: Path) -> Image.Image:
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
        # Portrait fallback: crop the person from munzer.jpg (left side) and stand him at the board.
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
        rounded_rect(draw, [col_w + 16, 70, w - 20, h - cap_h - 12], BOARD, 18)
    else:
        draw = ImageDraw.Draw(img)
        rounded_rect(draw, [36, 70, w - 20, h - cap_h - 12], BOARD, 18)

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
    name_box = [18, h - cap_h - 46, 400, h - cap_h - 12]
    rounded_rect(draw, name_box, (16, 33, 61), 10)
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
    math_lines = scene.get("board_math") or []
    for line in math_lines:
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
    board_key = f"board_{lang}"
    spoken_lines = scene.get(board_key) or scene.get("board_en") or scene.get("board_ar") or []
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

    caption = (
        scene.get(f"caption_{lang}")
        or scene.get(f"narration_{lang}")
        or scene.get("caption")
        or ""
    )
    cap_font = fonts["ar_cap"] if rtl else fonts["latin_cap"]
    cap_lines = wrap_text(caption, cap_font, w - 80, rtl=rtl)[:3]
    cy = h - cap_h + 22
    probe = ImageDraw.Draw(img)
    for line in cap_lines:
        shown = reshape_ar(line) if rtl else line
        bbox = probe.textbbox((0, 0), shown, font=cap_font)
        tw = bbox[2] - bbox[0]
        x = (w - tw) // 2
        if rtl:
            draw_ar_line(draw, (w - 40, cy), line, cap_font, WHITE, "ra")
        else:
            draw.text((x, cy), line, font=cap_font, fill=WHITE)
        cy += 34

    return img


def encode_scene(png: Path, audio: Path, duration: float, dest: Path) -> None:
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


def render_language(spec: dict, spec_path: Path, output: Path, lang: str) -> None:
    root = Path.cwd()
    fonts = {
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
    tmp = Path(tempfile.mkdtemp(prefix="mm-video-"))
    parts: list[Path] = []
    try:
        total = 0.0
        for index, scene in enumerate(spec["scenes"]):
            image = render_scene(spec, scene, lang, fonts, root)
            png = tmp / f"scene-{index:02d}.png"
            image.save(png, "PNG")
            spoken = (
                scene.get(f"narration_{lang}")
                or scene.get(f"caption_{lang}")
                or scene.get("caption")
                or scene.get("narration")
                or ""
            )
            audio = tmp / f"scene-{index:02d}.mp3"
            requested = float(scene.get("duration", 8))
            if spoken.strip() and synthesize_speech(spoken.strip(), lang, audio):
                duration = max(requested, audio_duration(audio) + 0.45)
            else:
                write_silence(audio, requested)
                duration = requested
            clip = tmp / f"scene-{index:02d}.mp4"
            encode_scene(png, audio, duration, clip)
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
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    spec = json.loads(args.spec.read_text(encoding="utf-8"))
    outputs = spec.get("outputs") or {}
    if args.both:
        en = Path(outputs.get("en") or (args.output or Path("public/videos/lesson-en.mp4")))
        fr = Path(outputs.get("fr") or Path(str(en).replace("-en.mp4", "-fr.mp4")))
        render_language(spec, args.spec, en, "en")
        render_language(spec, args.spec, fr, "fr")
        return 0
    if args.output is None:
        hinted = outputs.get(args.lang) or spec.get("output_hint")
        if not hinted:
            print("Pass an output path or --both", file=sys.stderr)
            return 2
        args.output = Path(hinted)
    render_language(spec, args.spec, args.output, args.lang)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
