"""Board graphs drawn with Pillow for classroom lesson videos."""

from __future__ import annotations

from PIL import ImageDraw, ImageFont

NAVY = (16, 33, 61)
GOLD = (184, 140, 48)
INK = (21, 35, 59)
RED = (154, 42, 32)
GREEN = (31, 110, 72)
WHITE = (255, 255, 255)


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _clip01(t: float) -> float:
    return max(0.0, min(1.0, t))


def draw_axes(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], ox: int, oy: int) -> None:
    x0, y0, x1, y1 = box
    draw.line([(x0 + 8, oy), (x1 - 8, oy)], fill=NAVY, width=2)
    draw.line([(ox, y0 + 8), (ox, y1 - 8)], fill=NAVY, width=2)
    draw.polygon([(x1 - 8, oy), (x1 - 18, oy - 5), (x1 - 18, oy + 5)], fill=NAVY)
    draw.polygon([(ox, y0 + 8), (ox - 5, y0 + 18), (ox + 5, y0 + 18)], fill=NAVY)


def _xy_map(box: tuple[int, int, int, int], xmin: float, xmax: float, ymin: float, ymax: float):
    x0, y0, x1, y1 = box
    pad = 28
    inner_w = max(40, x1 - x0 - 2 * pad)
    inner_h = max(40, y1 - y0 - 2 * pad)

    def X(x: float) -> int:
        return int(x0 + pad + (x - xmin) / (xmax - xmin) * inner_w)

    def Y(y: float) -> int:
        return int(y1 - pad - (y - ymin) / (ymax - ymin) * inner_h)

    return X, Y, X(0), Y(0)


def draw_continuity_jump(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    font: ImageFont.FreeTypeFont,
    lang: str,
    progress: float,
) -> None:
    """Piecewise graph: y=x+1 left of 1, jump to (1,3), y=2x right of 1."""
    X, Y, ox, oy = _xy_map(box, -0.15, 2.15, -0.25, 3.8)
    t = _clip01(progress)
    if t > 0.08:
        draw_axes(draw, box, ox, oy)
        draw.text((X(1.95), oy + 6), "x", font=font, fill=NAVY)
        draw.text((ox - 16, Y(3.55)), "y", font=font, fill=NAVY)
        draw.line([(X(1), oy - 4), (X(1), oy + 4)], fill=NAVY, width=2)
        draw.text((X(1) - 4, oy + 8), "1", font=font, fill=NAVY)

    if t > 0.28:
        draw.line([(X(0.0), Y(1.0)), (X(0.92), Y(1.92))], fill=NAVY, width=3)

    if t > 0.55:
        draw.line([(X(1.12), Y(2.24)), (X(1.85), Y(3.7))], fill=NAVY, width=3)

    if t > 0.28:
        r = 8
        draw.ellipse((X(1) - r, Y(2) - r, X(1) + r, Y(2) + r), fill=(255, 252, 244), outline=NAVY, width=3)
        draw.text((X(0.08), Y(2.45)), "lim = 2", font=font, fill=NAVY)

    if t > 0.78:
        r = 8
        draw.line([(X(1), Y(2.18)), (X(1), Y(2.82))], fill=RED, width=2)
        draw.ellipse((X(1) - r, Y(3) - r, X(1) + r, Y(3) + r), fill=RED)
        jump = "f(1)=3  jump" if lang != "fr" else "f(1)=3  saut"
        draw.text((X(1.12), Y(3.45)), jump, font=font, fill=RED)


def draw_derivative_tangent(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    font: ImageFont.FreeTypeFont,
    lang: str,
    progress: float,
) -> None:
    """y=x^2 with tangent of slope 4 at x=2."""
    X, Y, ox, oy = _xy_map(box, -0.15, 2.7, -0.4, 5.4)
    t = _clip01(progress)
    if t > 0.08:
        draw_axes(draw, box, ox, oy)
        draw.text((X(2.45), oy + 4), "x", font=font, fill=NAVY)
        draw.text((ox - 14, Y(5.1)), "y", font=font, fill=NAVY)

    if t > 0.3:
        pts = [(X(x), Y(x * x)) for x in [i / 20 for i in range(0, 47)]]
        draw.line(pts, fill=NAVY, width=3)
        draw.text((X(2.15), Y(5.0)), "y = x²", font=font, fill=NAVY)

    if t > 0.55:
        # tangent y - 4 = 4(x - 2)  => y = 4x - 4
        draw.line([(X(1.05), Y(4 * 1.05 - 4)), (X(2.55), Y(4 * 2.55 - 4))], fill=GOLD, width=3)
        r = 7
        draw.ellipse((X(2) - r, Y(4) - r, X(2) + r, Y(4) + r), fill=RED)
        draw.text((X(2.08), Y(3.35)), "(2, 4)", font=font, fill=RED)

    if t > 0.82:
        slope = "slope 4 = f'(2)" if lang != "fr" else "pente 4 = f'(2)"
        draw.text((X(0.12), Y(4.7)), slope, font=font, fill=GOLD)


def draw_thales_triangle(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    font: ImageFont.FreeTypeFont,
    lang: str,
    progress: float,
) -> None:
    """Triangle ABC with DE // BC, D on AB, E on AC, ratio 2/5."""
    x0, y0, x1, y1 = box
    pad_x = 36
    pad_y = 28
    ax, ay = x0 + (x1 - x0) // 2, y0 + pad_y
    bx, by = x0 + pad_x, y1 - pad_y - 18
    cx, cy = x1 - pad_x, y1 - pad_y - 18
    # D, E at 2/5 along AB and AC
    dx, dy = int(_lerp(ax, bx, 0.4)), int(_lerp(ay, by, 0.4))
    ex, ey = int(_lerp(ax, cx, 0.4)), int(_lerp(ay, cy, 0.4))

    t = _clip01(progress)
    if t > 0.1:
        draw.line([(ax, ay), (bx, by), (cx, cy), (ax, ay)], fill=NAVY, width=3)
        draw.text((ax - 6, ay - 18), "A", font=font, fill=NAVY)
        draw.text((bx - 16, by - 20), "B", font=font, fill=NAVY)
        draw.text((cx + 6, cy - 20), "C", font=font, fill=NAVY)

    if t > 0.45:
        draw.line([(dx, dy), (ex, ey)], fill=GOLD, width=4)
        draw.text((dx - 16, dy - 6), "D", font=font, fill=GOLD)
        draw.text((ex + 6, ey - 6), "E", font=font, fill=GOLD)
        draw.text((x0 + pad_x, y0 + 2), "(DE) // (BC)", font=font, fill=GOLD)

    if t > 0.75:
        ratio = "AD/AB = AE/AC = 2/5"
        draw.text((x0 + (x1 - x0) // 2 - 80, (dy + by) // 2), ratio, font=font, fill=INK)


def draw_graph(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    kind: str,
    font: ImageFont.FreeTypeFont,
    lang: str,
    progress: float = 1.0,
) -> None:
    kind = (kind or "").strip()
    if kind in {"continuity_jump", "continuity"}:
        draw_continuity_jump(draw, box, font, lang, progress)
    elif kind in {"derivative_tangent", "tangent", "derivative"}:
        draw_derivative_tangent(draw, box, font, lang, progress)
    elif kind in {"thales", "thales_triangle"}:
        draw_thales_triangle(draw, box, font, lang, progress)
