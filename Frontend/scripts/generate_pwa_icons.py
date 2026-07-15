#!/usr/bin/env python3
"""Genera favicon e iconos PWA desde public/branding/lepra-logo-icon.png.

Salidas (en public/):
- favicon.png            64x64  transparente (pestaña del navegador)
- apple-touch-icon.png  180x180 fondo oscuro (iOS home screen, requiere opaco)
- pwa-icon-192.png      192x192 transparente (manifest purpose=any)
- pwa-icon-512.png      512x512 transparente (manifest purpose=any)
- pwa-maskable-512.png  512x512 fondo oscuro, logo en zona segura (purpose=maskable)
"""
from pathlib import Path

from PIL import Image

BG_COLOR = (26, 26, 26, 255)  # #1a1a1a — mismo theme_color de la PWA

root = Path(__file__).resolve().parent.parent
src_path = root / "public" / "branding" / "lepra-logo-icon.png"
out_dir = root / "public"

if not src_path.is_file():
    raise SystemExit(f"No existe: {src_path}")

logo = Image.open(src_path).convert("RGBA")
logo = logo.crop(logo.getbbox())


def fit_logo(size: int, scale: float) -> tuple[Image.Image, tuple[int, int]]:
    """Escala el logo para que entre en size*scale y devuelve (logo, offset centrado)."""
    max_side = int(size * scale)
    ratio = min(max_side / logo.width, max_side / logo.height)
    w, h = round(logo.width * ratio), round(logo.height * ratio)
    resized = logo.resize((w, h), Image.LANCZOS)
    return resized, ((size - w) // 2, (size - h) // 2)


def make_icon(size: int, scale: float, background: tuple[int, int, int, int] | None) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    resized, offset = fit_logo(size, scale)
    canvas.paste(resized, offset, resized)
    return canvas


outputs = [
    ("favicon.png", make_icon(64, 1.0, None)),
    ("apple-touch-icon.png", make_icon(180, 0.78, BG_COLOR)),
    ("pwa-icon-192.png", make_icon(192, 1.0, None)),
    ("pwa-icon-512.png", make_icon(512, 1.0, None)),
    # Maskable: Android recorta hasta ~20% por lado; logo al 60% queda en zona segura.
    ("pwa-maskable-512.png", make_icon(512, 0.6, BG_COLOR)),
]

for name, img in outputs:
    path = out_dir / name
    img.save(path, optimize=True)
    print(f"Generado {path} ({img.width}x{img.height})")
