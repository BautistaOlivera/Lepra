"""Optimización y marca (logo + nombre) para imágenes de producto."""
from __future__ import annotations

import os
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont, ImageOps

BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))
UPLOAD_DIR = os.path.join(BACKEND_DIR, "uploads")
MAX_IMAGE_WIDTH = 1200
WEBP_QUALITY = 80
LOGO_WATERMARK_ALPHA = 1.0
LOGO_MAX_WIDTH_RATIO = 0.68
LOGO_MAX_HEIGHT_RATIO = 0.30
TEXT_MAX_WIDTH_RATIO = 0.88
BLOCK_BOTTOM_PADDING_RATIO = 0.035
LOGO_TEXT_GAP_PX = 4

FONT_CANDIDATES = [
    os.path.join(BACKEND_DIR, "branding", "DejaVuSans-Bold.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/ARIALBD.TTF",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
]


def _resolve_logo_path() -> str | None:
    candidates = [
        os.path.join(BACKEND_DIR, "branding", "lepra-logo-watermark.png"),
        os.path.join(UPLOAD_DIR, "lepra-logo-watermark.png"),
        os.path.join(BACKEND_DIR, "..", "Frontend", "public", "branding", "lepra-logo-watermark.png"),
    ]
    for path in candidates:
        resolved = os.path.abspath(path)
        if os.path.isfile(resolved):
            return resolved
    return None


def _load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if os.path.isfile(path):
            try:
                return ImageFont.truetype(path, size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def _crop_to_content(logo: Image.Image) -> Image.Image:
    rgba = logo.convert("RGBA")
    bbox = rgba.getbbox()
    if bbox:
        return rgba.crop(bbox)
    return rgba


def _fit_logo(logo: Image.Image, max_width: int, max_height: int) -> Image.Image:
    """Escala el logo (sin márgenes transparentes) para que entre en el rectángulo."""
    cropped = _crop_to_content(logo)
    if cropped.width <= 0 or cropped.height <= 0:
        return cropped
    scale = min(max_width / float(cropped.width), max_height / float(cropped.height))
    target_w = max(1, int(round(cropped.width * scale)))
    target_h = max(1, int(round(cropped.height * scale)))
    if target_w == cropped.width and target_h == cropped.height:
        return cropped
    return cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)


def _faded_logo(logo: Image.Image, alpha_ratio: float) -> Image.Image:
    faded = logo.convert("RGBA")
    alpha = faded.getchannel("A").point(lambda value: int(value * alpha_ratio))
    faded.putalpha(alpha)
    return faded


def _text_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> float:
    if hasattr(draw, "textlength"):
        return float(draw.textlength(text, font=font))
    bbox = draw.textbbox((0, 0), text, font=font)
    return float(bbox[2] - bbox[0])


def _wrap_product_name(
    draw: ImageDraw.ImageDraw,
    name: str,
    font: ImageFont.ImageFont,
    max_width: int,
) -> list[str]:
    words = name.split()
    if not words:
        return [name.strip() or "Producto"]

    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if _text_width(draw, candidate, font) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _fit_font_for_name(
    draw: ImageDraw.ImageDraw,
    name: str,
    max_width: int,
    image_width: int,
) -> tuple[ImageFont.ImageFont, list[str]]:
    base_size = max(18, image_width // 22)
    for size in range(base_size, 11, -2):
        font = _load_font(size)
        lines = _wrap_product_name(draw, name, font, max_width)
        widest = max(_text_width(draw, line, font) for line in lines)
        if widest <= max_width:
            return font, lines
    font = _load_font(12)
    return font, _wrap_product_name(draw, name, font, max_width)


def apply_product_branding(img: Image.Image, product_name: str, *, logo_path: str | None = None) -> Image.Image:
    """Superpone logo y nombre en la parte inferior de la imagen."""
    name = (product_name or "").strip()
    if not name:
        return img

    base = img.convert("RGBA")
    width, height = base.size
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    max_text_width = int(width * TEXT_MAX_WIDTH_RATIO)
    font, lines = _fit_font_for_name(draw, name, max_text_width, width)
    stroke = max(2, width // 280)

    if hasattr(font, "getbbox"):
        line_height = font.getbbox("Ag")[3] - font.getbbox("Ag")[1]
    else:
        line_height = 16

    line_gap = max(4, line_height // 6)
    text_block_height = len(lines) * line_height + max(0, len(lines) - 1) * line_gap
    bottom_pad = max(8, int(height * BLOCK_BOTTOM_PADDING_RATIO))

    logo: Image.Image | None = None
    logo_path = logo_path or _resolve_logo_path()
    if logo_path and os.path.isfile(logo_path):
        max_logo_w = max(1, int(width * LOGO_MAX_WIDTH_RATIO))
        max_logo_h = max(1, int(height * LOGO_MAX_HEIGHT_RATIO))
        with Image.open(logo_path) as logo_src:
            logo = _fit_logo(logo_src, max_logo_w, max_logo_h)
            if LOGO_WATERMARK_ALPHA < 1.0:
                logo = _faded_logo(logo, LOGO_WATERMARK_ALPHA)

    logo_height = logo.height if logo else 0
    gap = LOGO_TEXT_GAP_PX if logo else 0
    block_bottom = height - bottom_pad
    text_y = block_bottom - text_block_height
    logo_top = text_y - gap - logo_height

    if logo_top < 0 and logo is not None:
        overflow = -logo_top
        shrink = max(0.55, 1.0 - overflow / max(logo_height, 1))
        max_logo_h = max(1, int(logo.height * shrink))
        max_logo_w = max(1, int(logo.width * shrink))
        with Image.open(logo_path) as logo_src:
            logo = _fit_logo(logo_src, max_logo_w, max_logo_h)
            if LOGO_WATERMARK_ALPHA < 1.0:
                logo = _faded_logo(logo, LOGO_WATERMARK_ALPHA)
        logo_height = logo.height
        text_y = block_bottom - text_block_height
        logo_top = text_y - gap - logo_height

    if logo:
        logo_x = (width - logo.width) // 2
        overlay.alpha_composite(logo, (logo_x, max(0, logo_top)))

    text_draw = ImageDraw.Draw(overlay)
    for line in lines:
        text_w = _text_width(text_draw, line, font)
        text_x = (width - text_w) / 2
        text_draw.text(
            (text_x, text_y),
            line,
            font=font,
            fill=(255, 255, 255, 255),
            stroke_width=stroke,
            stroke_fill=(0, 0, 0, 210),
        )
        text_y += line_height + line_gap

    composed = Image.alpha_composite(base, overlay)
    if img.mode == "RGB":
        return composed.convert("RGB")
    return composed


def process_product_upload(content: bytes, product_name: str) -> tuple[bytes, int, int]:
    """EXIF, resize, marca y export WebP."""
    with Image.open(BytesIO(content)) as img:
        img = ImageOps.exif_transpose(img)

        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if "A" in img.getbands() else "RGB")

        if img.width > MAX_IMAGE_WIDTH:
            ratio = MAX_IMAGE_WIDTH / float(img.width)
            target_height = max(1, int(img.height * ratio))
            img = img.resize((MAX_IMAGE_WIDTH, target_height), Image.Resampling.LANCZOS)

        img = apply_product_branding(img, product_name)

        if img.mode != "RGB":
            img = img.convert("RGB")

        output = BytesIO()
        img.save(output, format="WEBP", quality=WEBP_QUALITY, method=6, optimize=True)
        optimized = output.getvalue()
        return optimized, img.width, img.height
