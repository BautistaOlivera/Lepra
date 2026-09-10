"""Límites de período y agregación para el dashboard admin (UTC naive, coherente con Order.created_at)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Iterable, Mapping, Sequence


@dataclass(frozen=True)
class PeriodWindow:
    start: datetime
    end: datetime
    previous_start: datetime
    previous_end: datetime


@dataclass(frozen=True)
class PeriodMetrics:
    orders: int
    revenue: float
    previous_orders: int
    previous_revenue: float


def start_of_day(dt: datetime) -> datetime:
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


def end_of_month(dt: datetime) -> datetime:
    start = start_of_day(dt).replace(day=1)
    if start.month == 12:
        nxt = start.replace(year=start.year + 1, month=1)
    else:
        nxt = start.replace(month=start.month + 1)
    return nxt - timedelta(days=1)


def period_windows(now: datetime) -> dict[str, PeriodWindow]:
    today = start_of_day(now)
    yesterday = today - timedelta(days=1)

    week_start = today - timedelta(days=6)
    prev_week_end = week_start
    prev_week_start = week_start - timedelta(days=7)

    month_start = today.replace(day=1)
    if month_start.month == 1:
        prev_month_start = month_start.replace(year=month_start.year - 1, month=12)
    else:
        prev_month_start = month_start.replace(month=month_start.month - 1)

    return {
        "day": PeriodWindow(today, now + timedelta(seconds=1), yesterday, today),
        "week": PeriodWindow(week_start, now + timedelta(seconds=1), prev_week_start, prev_week_end),
        "month": PeriodWindow(month_start, now + timedelta(seconds=1), prev_month_start, month_start),
    }


def _in_range(ts: datetime, start: datetime, end: datetime) -> bool:
    return start <= ts < end


def normalize_status(status: str | None) -> str:
    s = (status or "PENDING").upper()
    if s == "CANCELLED":
        return "CANCELED"
    return s


def _count_revenue(
  rows: Sequence[tuple[datetime, float, str]],
  start: datetime,
  end: datetime,
) -> tuple[int, float]:
    orders = 0
    revenue = 0.0
    for created_at, total, status in rows:
        if normalize_status(status) == "CANCELED":
            continue
        if not _in_range(created_at, start, end):
            continue
        orders += 1
        revenue += float(total or 0)
    return orders, revenue


def aggregate_periods(
    rows: Sequence[tuple[datetime, float, str]],
    now: datetime,
) -> dict[str, PeriodMetrics]:
    windows = period_windows(now)
    out: dict[str, PeriodMetrics] = {}
    for key, w in windows.items():
        o, r = _count_revenue(rows, w.start, w.end)
        po, pr = _count_revenue(rows, w.previous_start, w.previous_end)
        out[key] = PeriodMetrics(o, r, po, pr)
    return out


def aggregate_status(rows: Sequence[tuple[datetime, float, str]]) -> dict[str, int]:
    counts: dict[str, int] = {"PENDING": 0, "FULFILLED": 0, "CANCELED": 0}
    for _, __, status in rows:
        s = normalize_status(status)
        if s not in counts:
            s = "PENDING"
        counts[s] += 1
    return counts


def aggregate_daily_series(
    rows: Sequence[tuple[datetime, float, str]],
    now: datetime,
    days: int = 30,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
) -> list[dict[str, float | str | int]]:
    today = start_of_day(now)
    series_start = start_of_day(start) if start is not None else today - timedelta(days=days - 1)
    series_end = start_of_day(end) if end is not None else today
    if series_start > series_end:
        series_start = series_end
    n_days = (series_end - series_start).days + 1
    buckets: dict[str, dict[str, float | int]] = {}
    for i in range(n_days):
        d = (series_start + timedelta(days=i)).date().isoformat()
        buckets[d] = {"date": d, "orders": 0, "revenue": 0.0}

    for created_at, total, status in rows:
        if normalize_status(status) == "CANCELED":
            continue
        day = start_of_day(created_at).date().isoformat()
        if day not in buckets:
            continue
        buckets[day]["orders"] = int(buckets[day]["orders"]) + 1
        buckets[day]["revenue"] = float(buckets[day]["revenue"]) + float(total or 0)

    return [buckets[k] for k in sorted(buckets.keys())]


def aggregate_top_products(
    lines: Iterable[Mapping[str, object]],
    *,
    limit: int = 5,
) -> list[dict[str, object]]:
    by_product: dict[int, dict[str, object]] = {}
    for row in lines:
        pid = int(row["id_product"])
        name = str(row.get("name") or f"Producto #{pid}")
        kg = float(row.get("total_kg") if row.get("total_kg") is not None else row.get("quantity") or 0)
        rev = float(row.get("revenue") or 0)
        if pid not in by_product:
            by_product[pid] = {
                "id_product": pid,
                "name": name,
                "total_kg": 0.0,
                "revenue": 0.0,
            }
        by_product[pid]["total_kg"] = round(float(by_product[pid]["total_kg"]) + kg, 3)
        by_product[pid]["revenue"] = round(float(by_product[pid]["revenue"]) + rev, 2)

    ranked = sorted(
        by_product.values(),
        key=lambda x: (float(x["total_kg"]), float(x["revenue"])),
        reverse=True,
    )
    return ranked[:limit]


def _serialize_top_products(products: Sequence[Mapping[str, object]]) -> list[dict[str, object]]:
    return [
        {
            "id_product": p["id_product"],
            "name": p["name"],
            "total_kg": round(float(p["total_kg"]), 3),
            "revenue": round(float(p["revenue"]), 2),
        }
        for p in products
    ]


def build_dashboard_periods(
    rows: Sequence[tuple[datetime, float, str]],
    lines: Sequence[Mapping[str, object]],
    now: datetime,
    *,
    top_limit: int = 5,
) -> dict[str, dict[str, object]]:
    metrics = aggregate_periods(rows, now)
    windows = period_windows(now)
    out: dict[str, dict[str, object]] = {}
    for key, w in windows.items():
        window_rows = [r for r in rows if _in_range(r[0], w.start, w.end)]
        window_lines: list[Mapping[str, object]] = []
        for line in lines:
            created_at = line.get("created_at")
            if not isinstance(created_at, datetime):
                continue
            if not _in_range(created_at, w.start, w.end):
                continue
            if normalize_status(str(line.get("status"))) == "CANCELED":
                continue
            window_lines.append(line)
        m = metrics[key]
        out[key] = {
            "orders": m.orders,
            "revenue": round(m.revenue, 2),
            "previous_orders": m.previous_orders,
            "previous_revenue": round(m.previous_revenue, 2),
            "status_breakdown": aggregate_status(window_rows),
            "daily_series": aggregate_daily_series(
                rows,
                now,
                start=w.start,
                end=end_of_month(now) if key == "month" else start_of_day(now),
            ),
            "top_products": _serialize_top_products(
                aggregate_top_products(window_lines, limit=top_limit)
            ),
        }
    return out
