from datetime import date, datetime

from services.sales_stats import (
    SalesFilters,
    SalesLine,
    aggregate_summary,
    aggregate_time_series,
    aggregate_product_by_customer,
    build_sales_stats,
)


def _line(
    order_id: int,
    when: datetime,
    product_id: int,
    name: str,
    weight_kg: float,
    price_per_kg: float,
    *,
    status: str = "FULFILLED",
    customer_key: str = "user:1",
    customer_label: str = "Cliente A",
    category: str = "Quesos",
):
    return SalesLine(
        order_id=order_id,
        created_at=when,
        status=status,
        customer_key=customer_key,
        customer_label=customer_label,
        id_product=product_id,
        product_name=name,
        category=category,
        weight_kg=weight_kg,
        line_revenue=round(weight_kg * price_per_kg, 2),
    )


def test_aggregate_summary_excludes_canceled():
    filters = SalesFilters(date(2026, 5, 1), date(2026, 5, 31))
    lines = [
        _line(1, datetime(2026, 5, 10), 1, "Cremoso", 2, 10),
        _line(2, datetime(2026, 5, 11), 1, "Cremoso", 1, 10, status="CANCELED"),
    ]
    s = aggregate_summary(lines, filters)
    assert s["orders"] == 1
    assert s["revenue"] == 20.0
    assert s["total_kg"] == 2.0


def test_aggregate_summary_product_filter():
    filters = SalesFilters(date(2026, 5, 1), date(2026, 5, 31), product_id=2)
    lines = [
        _line(1, datetime(2026, 5, 10), 1, "Cremoso", 2, 10),
        _line(1, datetime(2026, 5, 10), 2, "Barra", 3, 5),
    ]
    s = aggregate_summary(lines, filters)
    assert s["orders"] == 1
    assert s["revenue"] == 15.0
    assert s["total_kg"] == 3.0


def test_aggregate_time_series_month():
    filters = SalesFilters(date(2026, 5, 1), date(2026, 5, 31), granularity="month")
    lines = [
        _line(1, datetime(2026, 5, 10), 1, "Cremoso", 2, 10),
        _line(2, datetime(2026, 5, 20), 2, "Barra", 1, 5),
    ]
    series = aggregate_time_series(lines, filters)
    assert len(series) == 1
    assert series[0]["period"] == "2026-05"
    assert series[0]["orders"] == 2
    assert series[0]["total_kg"] == 3.0


def test_product_by_customer_matrix():
    filters = SalesFilters(date(2026, 5, 1), date(2026, 5, 31))
    lines = [
        _line(1, datetime(2026, 5, 10), 1, "Cremoso", 11, 1, customer_key="user:1", customer_label="A"),
        _line(2, datetime(2026, 5, 10), 1, "Cremoso", 30, 1, customer_key="user:2", customer_label="B"),
        _line(3, datetime(2026, 5, 11), 2, "Barra", 5, 1, customer_key="user:1", customer_label="A"),
    ]
    matrix = aggregate_product_by_customer(lines, filters)
    cremoso = next(r for r in matrix if r["name"] == "Cremoso")
    assert cremoso["total_weight_kg"] == 41.0
    assert len(cremoso["customers"]) == 2


def test_build_sales_stats_structure():
    filters = SalesFilters(date(2026, 5, 1), date(2026, 5, 31))
    stats = build_sales_stats([], filters)
    assert "summary" in stats
    assert "time_series" in stats
    assert "product_by_customer" in stats
