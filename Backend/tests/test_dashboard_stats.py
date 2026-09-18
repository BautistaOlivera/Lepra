from datetime import datetime

from services.dashboard_stats import (
    aggregate_daily_series,
    aggregate_hourly_series,
    aggregate_periods,
    aggregate_status,
    aggregate_top_products,
    build_dashboard_periods,
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
    assert top[0]["total_kg"] == 5.0
    assert len(top) == 2


def test_aggregate_top_products_keeps_fractional_kg():
    lines = [
        {"id_product": 1, "name": "Queso", "total_kg": 0.5, "revenue": 10.0},
        {"id_product": 1, "name": "Queso", "total_kg": 0.7, "revenue": 14.0},
    ]
    top = aggregate_top_products(lines, limit=1)
    assert top[0]["total_kg"] == 1.2


def test_aggregate_daily_series_from_start():
    now = datetime(2026, 5, 16, 12, 0, 0)
    rows = [
        _row(datetime(2026, 5, 16, 10, 0), 100),
        _row(datetime(2026, 5, 14, 10, 0), 40),
    ]
    series = aggregate_daily_series(rows, now, start=datetime(2026, 5, 16, 0, 0, 0))
    assert len(series) == 1
    assert series[0]["date"] == "2026-05-16"
    assert series[0]["orders"] == 1


def test_aggregate_hourly_series_full_day():
    now = datetime(2026, 5, 16, 15, 30, 0)
    rows = [
        _row(datetime(2026, 5, 16, 10, 0), 100),
        _row(datetime(2026, 5, 16, 10, 40), 50),
        _row(datetime(2026, 5, 16, 9, 0), 20, "CANCELED"),
        _row(datetime(2026, 5, 15, 10, 0), 40),
    ]
    series = aggregate_hourly_series(rows, now)
    assert len(series) == 24
    assert series[0]["date"] == "2026-05-16T00"
    assert series[23]["date"] == "2026-05-16T23"
    assert series[10]["orders"] == 2
    assert series[10]["revenue"] == 150
    assert series[9]["orders"] == 0


def test_aggregate_daily_series_full_month():
    now = datetime(2026, 9, 10, 12, 0, 0)
    rows = [_row(datetime(2026, 9, 10, 10, 0), 100)]
    series = aggregate_daily_series(
        rows,
        now,
        start=datetime(2026, 9, 1, 0, 0, 0),
        end=datetime(2026, 9, 30, 0, 0, 0),
    )
    assert len(series) == 30
    assert series[0]["date"] == "2026-09-01"
    assert series[-1]["date"] == "2026-09-30"
    assert series[9]["orders"] == 1


def test_build_dashboard_periods_scopes_charts():
    now = datetime(2026, 5, 16, 12, 0, 0)
    rows = [
        _row(datetime(2026, 5, 16, 10, 0), 100),
        _row(datetime(2026, 5, 14, 10, 0), 40),
        _row(datetime(2026, 5, 16, 9, 0), 20, "CANCELED"),
    ]
    lines = [
        {
            "id_product": 1,
            "name": "Queso",
            "total_kg": 3.0,
            "revenue": 30.0,
            "created_at": datetime(2026, 5, 16, 10, 0),
            "status": "FULFILLED",
        },
        {
            "id_product": 2,
            "name": "Yogur",
            "total_kg": 2.0,
            "revenue": 20.0,
            "created_at": datetime(2026, 5, 14, 10, 0),
            "status": "FULFILLED",
        },
    ]
    periods = build_dashboard_periods(rows, lines, now)
    assert periods["day"]["orders"] == 1
    assert periods["day"]["status_breakdown"]["FULFILLED"] == 1
    assert periods["day"]["status_breakdown"]["CANCELED"] == 1
    assert [p["name"] for p in periods["day"]["top_products"]] == ["Queso"]
    assert [p["name"] for p in periods["week"]["top_products"]] == ["Queso", "Yogur"]
    assert len(periods["day"]["daily_series"]) == 24
    assert periods["day"]["daily_series"][10]["orders"] == 1
    assert len(periods["week"]["daily_series"]) == 7
    month_series = periods["month"]["daily_series"]
    assert len(month_series) == 31
    assert month_series[0]["date"] == "2026-05-01"
    assert month_series[-1]["date"] == "2026-05-31"


def test_today_cash_methods_and_owed_only_today_orders():
    from datetime import date

    from services.dashboard_stats import aggregate_today_cash

    now = datetime(2026, 5, 16, 12, 0, 0)
    orders = [
        {"id": 1, "created_at": datetime(2026, 5, 16, 10, 0), "total": 1000, "status": "PENDING", "active": True},
        {"id": 2, "created_at": datetime(2026, 5, 16, 11, 0), "total": 500, "status": "PENDING", "active": True},
        {"id": 3, "created_at": datetime(2026, 5, 10, 10, 0), "total": 800, "status": "PENDING", "active": True},
        {"id": 4, "created_at": datetime(2026, 5, 16, 9, 0), "total": 200, "status": "CANCELED", "active": True},
        {"id": 5, "created_at": datetime(2026, 5, 16, 8, 0), "total": 300, "status": "FULFILLED", "active": True},
    ]
    payments = [
        {"id_order": 1, "amount": 400, "method": "efectivo", "paid_at": date(2026, 5, 16)},
        {"id_order": 1, "amount": 100, "method": "otro", "paid_at": date(2026, 5, 15)},
        {"id_order": 2, "amount": 500, "method": "transferencia", "paid_at": date(2026, 5, 16)},
        {"id_order": 3, "amount": 200, "method": "cheque", "paid_at": date(2026, 5, 16)},
        {"id_order": 4, "amount": 50, "method": "efectivo", "paid_at": date(2026, 5, 16)},
        {"id_order": 5, "amount": 300, "method": "efectivo", "paid_at": date(2026, 5, 16)},
    ]
    cash = aggregate_today_cash(orders, payments, now)
    assert cash["date"] == "2026-05-16"
    assert cash["efectivo"] == 700.0
    assert cash["transferencia"] == 500.0
    assert cash["cheque"] == 200.0
    assert cash["otro"] == 0.0
    assert cash["collected"] == 1400.0
    assert cash["owed"] == 500.0


def test_today_cash_uses_argentina_calendar_at_night():
    from datetime import date

    from services.dashboard_stats import aggregate_today_cash

    now = datetime(2026, 5, 17, 1, 0, 0)
    orders = [
        {"id": 1, "created_at": datetime(2026, 5, 17, 1, 0), "total": 100, "status": "PENDING", "active": True},
    ]
    payments = [
        {"id_order": 1, "amount": 30, "method": "efectivo", "paid_at": date(2026, 5, 16)},
    ]
    cash = aggregate_today_cash(orders, payments, now)
    assert cash["date"] == "2026-05-16"
    assert cash["efectivo"] == 30.0
    assert cash["owed"] == 70.0
