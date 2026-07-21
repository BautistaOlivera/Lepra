from services.pricing import line_total, price_per_kg_for_weight, price_per_piece_for_weight, unit_price_for_line, validate_line_weight


class _Tier:
    def __init__(self, min_kg: float, price_per_kg: float):
        self.min_kg = min_kg
        self.price_per_kg = price_per_kg


class _Product:
    def __init__(self, price: float, *, weight=None, fixed_weight=False, tiers=None):
        self.price = price
        self.weight = weight
        self.fixed_weight = fixed_weight
        self.has_tiered_pricing = bool(tiers)
        self.price_tiers = tiers or []


def test_price_per_kg_tier_by_weight():
    product = _Product(10.0, tiers=[_Tier(20.0, 8.0), _Tier(5.0, 9.0)])
    assert price_per_kg_for_weight(product, 4.0) == 10.0
    assert price_per_kg_for_weight(product, 5.0) == 9.0
    assert price_per_kg_for_weight(product, 20.0) == 8.0


def test_line_total_by_kg():
    product = _Product(10.0)
    assert line_total(product, 4.0, 10.0) == 40.0


def test_line_total_by_piece():
    product = _Product(100.0, weight=0.5, fixed_weight=True)
    assert line_total(product, 2.0, 100.0) == 400.0


def test_piece_tier_uses_piece_count():
    product = _Product(100.0, weight=0.5, fixed_weight=True, tiers=[_Tier(3.0, 90.0)])
    assert unit_price_for_line(product, 1.0) == 100.0  # 2 piezas
    assert unit_price_for_line(product, 1.5) == 90.0  # 3 piezas
    assert unit_price_for_line(product, 2.0) == 90.0  # 4 piezas


def test_validate_fixed_weight_multiple():
    product = _Product(10.0, weight=0.5, fixed_weight=True)
    assert validate_line_weight(product, 1.0) is None
    assert validate_line_weight(product, 1.25) is not None


def test_validate_missing_weight_allowed_for_admin():
    product = _Product(10.0)
    assert validate_line_weight(product, None, allow_missing=True) is None
    assert validate_line_weight(product, None) is not None
    assert validate_line_weight(product, 0) is not None
    assert validate_line_weight(product, -1) is not None


def test_line_total_missing_weight_is_zero():
    product = _Product(10.0)
    assert line_total(product, None, 10.0) == 0.0
