from datetime import datetime

from services.dashboard_stats import (
    aggregate_daily_series,
    aggregate_periods,
    aggregate_status,
    aggregate_top_products,
    period_windows,
)


def _row(when: datetime, total: float, status: str = "FULFILLED"):
    return (when, total, status)


def test_period_windows_day_bounds():
    now = datetime(2026, 5, 16, 15, 30, 0)
    w = period_windows(now)["day"]
    assert w.start == datetime(2026, 5, 16, 0, 0, 0)
    assert w.previous_start == datetime(2026, 5, 15, 0, 0, 0)


def test_aggregate_periods_day():
    now = datetime(2026, 5, 16, 12, 0, 0)
    rows = [
        _row(datetime(2026, 5, 16, 10, 0), 100),
        _row(datetime(2026, 5, 15, 10, 0), 50),
        _row(datetime(2026, 5, 16, 9, 0), 20, "CANCELED"),
    ]
    p = aggregate_periods(rows, now)["day"]
    assert p.orders == 1
    assert p.revenue == 100
    assert p.previous_orders == 1
    assert p.previous_revenue == 50


def test_aggregate_daily_series():
    now = datetime(2026, 5, 16, 12, 0, 0)
    rows = [
        _row(datetime(2026, 5, 16, 10, 0), 100),
        _row(datetime(2026, 5, 14, 10, 0), 40),
    ]
    series = aggregate_daily_series(rows, now, days=30)
    by_date = {s["date"]: s for s in series}
    assert by_date["2026-05-16"]["orders"] == 1
    assert by_date["2026-05-16"]["revenue"] == 100
    assert by_date["2026-05-14"]["orders"] == 1


def test_aggregate_status_merges_cancelled():
    now = datetime(2026, 5, 16, 12, 0, 0)
    rows = [
        _row(now, 10, "CANCELED"),
        _row(now, 20, "CANCELLED"),
    ]
    counts = aggregate_status(rows)
    assert counts["CANCELED"] == 2
    assert "CANCELLED" not in counts


def test_aggregate_top_products():
    lines = [
        {"id_product": 1, "name": "Queso", "quantity": 2.0, "revenue": 20.0},
        {"id_product": 1, "name": "Queso", "quantity": 3.0, "revenue": 30.0},
        {"id_product": 2, "name": "Yogur", "quantity": 1.0, "revenue": 5.0},
    ]
    top = aggregate_top_products(lines, limit=2)
    assert top[0]["id_product"] == 1
    assert top[0]["quantity"] == 5.0
    assert len(top) == 2
