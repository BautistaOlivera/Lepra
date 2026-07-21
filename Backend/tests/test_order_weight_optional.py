"""Tests de helpers de líneas admin con peso opcional."""
from services.pricing import line_total, validate_line_weight, unit_price_for_line


class _Product:
    def __init__(self, price: float, *, weight=None, fixed_weight=False, tiers=None):
        self.price = price
        self.weight = weight
        self.fixed_weight = fixed_weight
        self.has_tiered_pricing = bool(tiers)
        self.price_tiers = tiers or []


def test_admin_missing_weight_ok_zero_rejected():
    product = _Product(12.5)
    assert validate_line_weight(product, None, allow_missing=True) is None
    assert validate_line_weight(product, 0, allow_missing=True) is not None
    assert validate_line_weight(product, -2, allow_missing=True) is not None


def test_client_missing_weight_rejected():
    product = _Product(12.5)
    assert validate_line_weight(product, None, allow_missing=False) is not None


def test_unweighed_line_does_not_contribute_to_total():
    product = _Product(100.0)
    assert line_total(product, None, 100.0) == 0.0
    assert line_total(product, 2.5, 100.0) == 250.0


def test_unit_price_with_zero_weight_falls_back_to_base():
    product = _Product(15.0)
    assert unit_price_for_line(product, 0) == 15.0
