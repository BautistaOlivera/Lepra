"""Total de abastecimiento y aislamiento del precio de venta."""
from types import SimpleNamespace

from services.purchase_totals import (
    PurchaseLineIn,
    apply_purchase_lines,
    compute_purchase_total,
    line_amount,
    validate_purchase_draft,
)


def test_total_is_lines_plus_unitemized():
    assert line_amount(2, 100) == 200
    assert line_amount(1.5, 10) == 15
    assert compute_purchase_total([(2, 100), (0.5, 50)], 1000) == 1225
    assert compute_purchase_total([], 800) == 800


def test_empty_purchase_is_rejected_and_money_only_is_ok():
    assert validate_purchase_draft([], 0) is not None
    assert validate_purchase_draft([], -1) is not None
    assert validate_purchase_draft([], 1500) is None
    line = PurchaseLineIn(id_product=3, weight=1.2, price_per_kg=0)
    assert validate_purchase_draft([line], 0) is None
    assert validate_purchase_draft([PurchaseLineIn(1, 0, 10)], 100) is not None


def test_apply_lines_does_not_change_sale_price_or_stock():
    product = SimpleNamespace(id=7, price=1800.0, status="sin_stock", active=True)
    lines = [PurchaseLineIn(id_product=7, weight=2, price_per_kg=900)]
    built, err = apply_purchase_lines({7: product}, lines)
    assert err is None
    assert product.price == 1800.0
    assert product.status == "sin_stock"
    assert product.active is True
    assert built[0]["price_per_kg"] == 900
    assert built[0]["amount"] == 1800
    assert compute_purchase_total([(2, 900)], 500) == 2300


def test_missing_product_is_reported_without_touching_others():
    product = SimpleNamespace(id=1, price=10.0, status="active")
    built, err = apply_purchase_lines(
        {1: product},
        [PurchaseLineIn(id_product=99, weight=1, price_per_kg=4)],
    )
    assert built == []
    assert err is not None
    assert product.price == 10.0
    assert product.status == "active"
