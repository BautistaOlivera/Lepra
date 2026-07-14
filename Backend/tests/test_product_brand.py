"""Tests de normalización de marca (sin DB)."""

from services.product_brand import normalize_brand_key


def test_normalize_brand_key_trims_and_lowers():
    assert normalize_brand_key("  Queso ") == "queso"
    assert normalize_brand_key("QUESO") == "queso"
    assert normalize_brand_key("") == ""
    assert normalize_brand_key(None) == ""
    assert normalize_brand_key("  ") == ""
