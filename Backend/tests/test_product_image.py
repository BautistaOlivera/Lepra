from io import BytesIO

from PIL import Image

from services.product_image import apply_product_branding, process_product_upload


def _solid_png(width: int, height: int, color=(120, 80, 40)) -> bytes:
    img = Image.new("RGB", (width, height), color)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_apply_product_branding_changes_pixels(tmp_path):
    logo = Image.new("RGBA", (80, 40), (230, 184, 0, 255))
    logo_path = tmp_path / "logo.png"
    logo.save(logo_path)

    src = Image.new("RGB", (400, 300), (90, 90, 90))
    out = apply_product_branding(src, "Queso Cremoso", logo_path=str(logo_path))
    assert out.size == (400, 300)
    assert out.tobytes() != src.tobytes()


def test_apply_product_branding_with_brand_differs_from_name_only(tmp_path):
    logo = Image.new("RGBA", (80, 40), (230, 184, 0, 255))
    logo_path = tmp_path / "logo.png"
    logo.save(logo_path)

    src = Image.new("RGB", (400, 300), (90, 90, 90))
    name_only = apply_product_branding(src, "Queso Cremoso", logo_path=str(logo_path))
    with_brand = apply_product_branding(
        src,
        "Queso Cremoso",
        product_brand="La Serenísima",
        logo_path=str(logo_path),
    )
    assert with_brand.tobytes() != name_only.tobytes()


def test_apply_product_branding_logo_is_centered(tmp_path):
    """Logo en el centro geométrico; el texto queda abajo."""
    logo = Image.new("RGBA", (60, 40), (230, 184, 0, 255))
    logo_path = tmp_path / "logo.png"
    logo.save(logo_path)

    src = Image.new("RGB", (400, 300), (10, 10, 10))
    out = apply_product_branding(src, "Queso", logo_path=str(logo_path)).convert("RGB")

    cx, cy = 200, 150
    # Zona central debe tener el amarillo del logo
    center = out.getpixel((cx, cy))
    assert center[0] > 180 and center[1] > 140

    # Esquinas superiores siguen casi negras (sin logo arriba)
    corner = out.getpixel((5, 5))
    assert corner[0] < 40 and corner[1] < 40 and corner[2] < 40


def test_process_product_upload_returns_webp():
    content = _solid_png(800, 600)
    optimized, width, height = process_product_upload(content, "Manteca")
    assert width == 800
    assert height == 600
    assert optimized[:4] == b"RIFF"
    with Image.open(BytesIO(optimized)) as img:
        assert img.format == "WEBP"
