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
    sold_by_piece: bool = False,
    qty: float | None = None,
):
    q = weight_kg if qty is None else qty
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
        line_revenue=round(q * price_per_kg, 2) if sold_by_piece else round(weight_kg * price_per_kg, 2),
        sold_by_piece=sold_by_piece,
        qty=q,
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
    assert cremoso["total_kg"] == 41.0
    assert cremoso["total_qty"] == 41.0
    assert cremoso["unit"] == "kg"
    assert len(cremoso["customers"]) == 2


def test_planilla_blocks_and_by_period():
    from services.sales_stats import SalesLine, aggregate_planilla

    filters = SalesFilters(date(2026, 5, 24), date(2026, 5, 24), granularity="day")
    lines = [
        SalesLine(
            order_id=1,
            created_at=datetime(2026, 5, 24, 10, 0),
            status="FULFILLED",
            customer_key="user:1",
            customer_label="Cliente A",
            id_product=1,
            product_name="Cremoso",
            category="Quesos",
            weight_kg=11,
            line_revenue=110,
            sold_by_piece=False,
            qty=11,
        ),
        SalesLine(
            order_id=2,
            created_at=datetime(2026, 5, 24, 11, 0),
            status="FULFILLED",
            customer_key="user:2",
            customer_label="Cliente B",
            id_product=1,
            product_name="Cremoso",
            category="Quesos",
            weight_kg=30,
            line_revenue=300,
            sold_by_piece=False,
            qty=30,
        ),
        SalesLine(
            order_id=3,
            created_at=datetime(2026, 5, 24, 12, 0),
            status="FULFILLED",
            customer_key="user:1",
            customer_label="Cliente A",
            id_product=2,
            product_name="Bondiola",
            category="Fiambres",
            weight_kg=1.5,
            line_revenue=900,
            sold_by_piece=True,
            qty=3,
        ),
    ]
    planilla = aggregate_planilla(lines, filters)
    assert len(planilla["blocks"]) == 1
    block = planilla["blocks"][0]
    assert block["period"] == "2026-05-24"
    assert block["grand_total"] == 44.0  # 11+30+3
    cremoso = next(r for r in block["rows"] if r["name"] == "Cremoso")
    assert cremoso["unit"] == "kg"
    assert cremoso["total"] == 41.0
    bondiola = next(r for r in block["rows"] if r["name"] == "Bondiola")
    assert bondiola["unit"] == "u."
    assert bondiola["total"] == 3.0
    assert len(planilla["by_period"]) == 2
    assert planilla["grand_total"] == 44.0


def test_build_sales_stats_structure():
    filters = SalesFilters(date(2026, 5, 1), date(2026, 5, 31))
    stats = build_sales_stats([], filters)
    assert "summary" in stats
    assert "time_series" in stats
    assert "product_by_customer" in stats
    assert "planilla" in stats
    assert stats["planilla"]["blocks"] == []
