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
) -> list[dict[str, float | str | int]]:
    today = start_of_day(now)
    start = today - timedelta(days=days - 1)
    buckets: dict[str, dict[str, float | int]] = {}
    for i in range(days):
        d = (start + timedelta(days=i)).date().isoformat()
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
        qty = int(row.get("quantity") or 0)
        rev = float(row.get("revenue") or 0)
        if pid not in by_product:
            by_product[pid] = {
                "id_product": pid,
                "name": name,
                "quantity": 0,
                "revenue": 0.0,
            }
        by_product[pid]["quantity"] = int(by_product[pid]["quantity"]) + qty
        by_product[pid]["revenue"] = float(by_product[pid]["revenue"]) + rev

    ranked = sorted(
        by_product.values(),
        key=lambda x: (int(x["quantity"]), float(x["revenue"])),
        reverse=True,
    )
    return ranked[:limit]
