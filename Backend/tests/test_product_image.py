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


def test_process_product_upload_returns_webp():
    content = _solid_png(800, 600)
    optimized, width, height = process_product_upload(content, "Manteca")
    assert width == 800
    assert height == 600
    assert optimized[:4] == b"RIFF"
    with Image.open(BytesIO(optimized)) as img:
        assert img.format == "WEBP"
