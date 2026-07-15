"""Agregación de estadísticas de ventas para el panel admin."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Literal, Mapping, Sequence

from services.dashboard_stats import normalize_status, start_of_day

Granularity = Literal["day", "week", "month", "year"]


@dataclass(frozen=True)
class SalesLine:
    order_id: int
    created_at: datetime
    status: str
    customer_key: str
    customer_label: str
    id_product: int
    product_name: str
    category: str | None
    weight_kg: float
    line_revenue: float


@dataclass(frozen=True)
class SalesFilters:
    date_from: date
    date_to: date
    product_id: int | None = None
    category: str | None = None
    granularity: Granularity = "day"


def parse_date_param(value: str | None, default: date) -> date:
    if not value:
        return default
    return date.fromisoformat(value[:10])


def default_date_range(now: datetime) -> tuple[date, date]:
    today = start_of_day(now).date()
    start = today - timedelta(days=29)
    return start, today


def _end_exclusive(d: date) -> datetime:
    return datetime.combine(d + timedelta(days=1), datetime.min.time())


def _start_inclusive(d: date) -> datetime:
    return datetime.combine(d, datetime.min.time())


def _in_date_range(ts: datetime, start: date, end: date) -> bool:
    day = start_of_day(ts).date()
    return start <= day <= end


def _filter_lines(lines: Sequence[SalesLine], filters: SalesFilters) -> list[SalesLine]:
    out: list[SalesLine] = []
    for line in lines:
        if normalize_status(line.status) == "CANCELED":
            continue
        if not _in_date_range(line.created_at, filters.date_from, filters.date_to):
            continue
        if filters.product_id is not None and line.id_product != filters.product_id:
            continue
        if filters.category and (line.category or "") != filters.category:
            continue
        out.append(line)
    return out


def _period_length_days(start: date, end: date) -> int:
    return (end - start).days + 1


def _previous_range(start: date, end: date) -> tuple[date, date]:
    days = _period_length_days(start, end)
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=days - 1)
    return prev_start, prev_end


def _bucket_key(ts: datetime, granularity: Granularity) -> str:
    d = start_of_day(ts).date()
    if granularity == "day":
        return d.isoformat()
    if granularity == "week":
        monday = d - timedelta(days=d.weekday())
        return monday.isoformat()
    if granularity == "month":
        return f"{d.year:04d}-{d.month:02d}"
    return f"{d.year:04d}"


def aggregate_summary(
    lines: Sequence[SalesLine],
    filters: SalesFilters,
) -> dict[str, float | int]:
    current = _filter_lines(lines, filters)
    prev_start, prev_end = _previous_range(filters.date_from, filters.date_to)
    prev_filters = SalesFilters(
        date_from=prev_start,
        date_to=prev_end,
        product_id=filters.product_id,
        category=filters.category,
        granularity=filters.granularity,
    )
    previous = _filter_lines(lines, prev_filters)

    cur_orders = len({l.order_id for l in current})
    prev_orders = len({l.order_id for l in previous})
    cur_revenue = round(sum(l.line_revenue for l in current), 2)
    prev_revenue = round(sum(l.line_revenue for l in previous), 2)
    cur_kg = sum(l.weight_kg for l in current)

    avg_ticket = round(cur_revenue / cur_orders, 2) if cur_orders else 0.0

    return {
        "orders": cur_orders,
        "revenue": cur_revenue,
        "total_kg": round(cur_kg, 3),
        "avg_ticket": avg_ticket,
        "previous_orders": prev_orders,
        "previous_revenue": prev_revenue,
    }


def aggregate_time_series(
    lines: Sequence[SalesLine],
    filters: SalesFilters,
) -> list[dict[str, float | int | str]]:
    filtered = _filter_lines(lines, filters)
    buckets: dict[str, dict[str, float | int | str | set[int]]] = {}

    cur = filters.date_from
    while cur <= filters.date_to:
        key = _bucket_key(_start_inclusive(cur), filters.granularity)
        if key not in buckets:
            buckets[key] = {"period": key, "orders": 0, "revenue": 0.0, "total_kg": 0.0, "_order_ids": set()}
        if filters.granularity == "day":
            cur += timedelta(days=1)
        elif filters.granularity == "week":
            cur += timedelta(days=7)
        elif filters.granularity == "month":
            if cur.month == 12:
                cur = date(cur.year + 1, 1, 1)
            else:
                cur = date(cur.year, cur.month + 1, 1)
        else:
            cur = date(cur.year + 1, 1, 1)

    for line in filtered:
        key = _bucket_key(line.created_at, filters.granularity)
        if key not in buckets:
            buckets[key] = {"period": key, "orders": 0, "revenue": 0.0, "total_kg": 0.0, "_order_ids": set()}
        bucket = buckets[key]
        order_ids = bucket["_order_ids"]
        assert isinstance(order_ids, set)
        order_ids.add(line.order_id)
        bucket["revenue"] = float(bucket["revenue"]) + line.line_revenue
        bucket["total_kg"] = float(bucket["total_kg"]) + line.weight_kg

    out: list[dict[str, float | int | str]] = []
    for key in sorted(buckets.keys()):
        b = buckets[key]
        order_ids = b.pop("_order_ids")
        assert isinstance(order_ids, set)
        b["orders"] = len(order_ids)
        b["revenue"] = round(float(b["revenue"]), 2)
        out.append({k: v for k, v in b.items() if k != "_order_ids"})
    return out


def aggregate_by_product(
    lines: Sequence[SalesLine],
    filters: SalesFilters,
    *,
    limit: int | None = None,
) -> list[dict[str, object]]:
    filtered = _filter_lines(lines, filters)
    by_id: dict[int, dict[str, object]] = {}
    for line in filtered:
        pid = line.id_product
        if pid not in by_id:
            by_id[pid] = {
                "id_product": pid,
                "name": line.product_name,
                "category": line.category,
                "total_kg": 0.0,
                "revenue": 0.0,
                "orders": set(),
            }
        row = by_id[pid]
        row["total_kg"] = round(float(row["total_kg"]) + line.weight_kg, 3)
        row["revenue"] = round(float(row["revenue"]) + line.line_revenue, 2)
        orders = row["orders"]
        assert isinstance(orders, set)
        orders.add(line.order_id)

    ranked = sorted(
        by_id.values(),
        key=lambda x: (float(x["total_kg"]), float(x["revenue"])),
        reverse=True,
    )
    result: list[dict[str, object]] = []
    for row in ranked[: limit or len(ranked)]:
        orders = row.pop("orders")
        assert isinstance(orders, set)
        row["orders"] = len(orders)
        result.append(row)
    return result


def aggregate_by_category(lines: Sequence[SalesLine], filters: SalesFilters) -> list[dict[str, object]]:
    filtered = _filter_lines(lines, filters)
    by_cat: dict[str, dict[str, object]] = {}
    for line in filtered:
        cat = (line.category or "Sin categoría").strip() or "Sin categoría"
        if cat not in by_cat:
            by_cat[cat] = {"category": cat, "total_kg": 0.0, "revenue": 0.0, "orders": set()}
        row = by_cat[cat]
        row["total_kg"] = round(float(row["total_kg"]) + line.weight_kg, 3)
        row["revenue"] = round(float(row["revenue"]) + line.line_revenue, 2)
        orders = row["orders"]
        assert isinstance(orders, set)
        orders.add(line.order_id)

    return [
        {
            "category": row["category"],
            "total_kg": row["total_kg"],
            "revenue": row["revenue"],
            "orders": len(row["orders"]),
        }
        for row in sorted(by_cat.values(), key=lambda x: float(x["revenue"]), reverse=True)
    ]


def aggregate_by_customer(lines: Sequence[SalesLine], filters: SalesFilters) -> list[dict[str, object]]:
    filtered = _filter_lines(lines, filters)
    by_key: dict[str, dict[str, object]] = {}
    for line in filtered:
        key = line.customer_key
        if key not in by_key:
            by_key[key] = {
                "customer_key": key,
                "label": line.customer_label,
                "total_kg": 0.0,
                "revenue": 0.0,
                "orders": set(),
            }
        row = by_key[key]
        row["total_kg"] = round(float(row["total_kg"]) + line.weight_kg, 3)
        row["revenue"] = round(float(row["revenue"]) + line.line_revenue, 2)
        orders = row["orders"]
        assert isinstance(orders, set)
        orders.add(line.order_id)

    return [
        {
            "label": row["label"],
            "total_kg": row["total_kg"],
            "revenue": row["revenue"],
            "orders": len(row["orders"]),
        }
        for row in sorted(by_key.values(), key=lambda x: float(x["revenue"]), reverse=True)
    ]


def aggregate_product_by_customer(
    lines: Sequence[SalesLine],
    filters: SalesFilters,
) -> list[dict[str, object]]:
    """Matriz producto × cliente (estilo caudal de ventas)."""
    filtered = _filter_lines(lines, filters)
    by_product: dict[int, dict[str, object]] = {}

    for line in filtered:
        pid = line.id_product
        if pid not in by_product:
            by_product[pid] = {
                "id_product": pid,
                "name": line.product_name,
                "category": line.category,
                "total_kg": 0.0,
                "customers": {},
            }
        prod = by_product[pid]
        prod["total_kg"] = round(float(prod["total_kg"]) + line.weight_kg, 3)
        customers = prod["customers"]
        assert isinstance(customers, dict)
        ck = line.customer_key
        if ck not in customers:
            customers[ck] = {"label": line.customer_label, "total_kg": 0.0}
        customers[ck]["total_kg"] = round(float(customers[ck]["total_kg"]) + line.weight_kg, 3)

    result: list[dict[str, object]] = []
    for row in sorted(by_product.values(), key=lambda x: float(x["total_kg"]), reverse=True):
        customers = row.pop("customers")
        assert isinstance(customers, dict)
        row["customers"] = sorted(
            customers.values(),
            key=lambda c: float(c["total_kg"]),
            reverse=True,
        )
        result.append(row)
    return result


def build_sales_stats(
    lines: Sequence[SalesLine],
    filters: SalesFilters,
) -> dict[str, object]:
    return {
        "filters": {
            "date_from": filters.date_from.isoformat(),
            "date_to": filters.date_to.isoformat(),
            "product_id": filters.product_id,
            "category": filters.category,
            "granularity": filters.granularity,
        },
        "summary": aggregate_summary(lines, filters),
        "time_series": aggregate_time_series(lines, filters),
        "by_product": aggregate_by_product(lines, filters),
        "by_category": aggregate_by_category(lines, filters),
        "by_customer": aggregate_by_customer(lines, filters),
        "product_by_customer": aggregate_product_by_customer(lines, filters),
    }


def lines_from_rows(rows: Sequence[Mapping[str, object]]) -> list[SalesLine]:
    out: list[SalesLine] = []
    for r in rows:
        id_user = r.get("id_user")
        user_name = (r.get("user_name") or "").strip() if r.get("user_name") else ""
        customer_name = (r.get("customer_name") or "").strip() if r.get("customer_name") else ""
        label = user_name or customer_name or "Sin cliente"
        if id_user:
            customer_key = f"user:{id_user}"
        elif customer_name:
            customer_key = f"name:{customer_name.lower()}"
        else:
            customer_key = "none"

        weight_kg = float(r.get("weight") or 0)
        price_per_kg = float(r.get("price_per_kg") or 0)
        out.append(
            SalesLine(
                order_id=int(r["order_id"]),
                created_at=r["created_at"],  # type: ignore[arg-type]
                status=str(r.get("status") or "PENDING"),
                customer_key=customer_key,
                customer_label=label,
                id_product=int(r["id_product"]),
                product_name=str(r.get("product_name") or f"Producto #{r['id_product']}"),
                category=(str(r["category"]).strip() if r.get("category") else None),
                weight_kg=weight_kg,
                line_revenue=round(weight_kg * price_per_kg, 2),
            )
        )
    return out
