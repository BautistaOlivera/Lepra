from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import func, select

from auth.roles import require_roles
from config.db import AsyncSessionLocal
from models.order import Order, OrderProduct
from models.product import Product
from models.user import User
from services.dashboard_stats import (
    aggregate_daily_series,
    aggregate_periods,
    aggregate_status,
    aggregate_top_products,
    period_windows,
    start_of_day,
)
from utils.datetime_api import utc_naive_iso

stats_router = APIRouter(prefix="/stats", tags=["Stats"])

SERIES_DAYS = 30


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@stats_router.get("/dashboard")
async def get_dashboard_stats(req: Request):
    """Métricas agregadas para el panel admin. Solo ADMIN."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    now = _utcnow_naive()
    series_start = start_of_day(now) - timedelta(days=SERIES_DAYS - 1)
    fetch_start = min(w.previous_start for w in period_windows(now).values())
    fetch_start = min(fetch_start, series_start)

    async with AsyncSessionLocal() as session:
        products_active = (
            await session.execute(
                select(func.count()).select_from(Product).where(Product.active.is_(True))
            )
        ).scalar_one()
        users_active = (
            await session.execute(
                select(func.count()).select_from(User).where(User.active.is_(True))
            )
        ).scalar_one()
        orders_pending = (
            await session.execute(
                select(func.count())
                .select_from(Order)
                .where(Order.active.is_(True), Order.status == "PENDING")
            )
        ).scalar_one()

        order_rows = (
            await session.execute(
                select(Order.created_at, Order.total, Order.status).where(
                    Order.active.is_(True),
                    Order.created_at >= fetch_start,
                )
            )
        ).all()
        rows = [(r[0], r[1], r[2] or "PENDING") for r in order_rows]

        status_rows = (
            await session.execute(
                select(Order.status).where(Order.active.is_(True))
            )
        ).all()
        status_breakdown = aggregate_status([(now, 0.0, r[0] or "PENDING") for r in status_rows])

        line_rows = (
            await session.execute(
                select(
                    OrderProduct.id_product,
                    Product.name,
                    OrderProduct.quantity,
                    (OrderProduct.quantity * OrderProduct.unit_price).label("line_total"),
                )
                .join(Order, Order.id == OrderProduct.id_order)
                .join(Product, Product.id == OrderProduct.id_product)
                .where(
                    Order.active.is_(True),
                    Order.created_at >= series_start,
                    Order.status != "CANCELED",
                )
            )
        ).all()

    periods = aggregate_periods(rows, now)
    daily_series = aggregate_daily_series(rows, now, SERIES_DAYS)
    top_products = aggregate_top_products(
        [
            {
                "id_product": r[0],
                "name": r[1],
                "quantity": r[2],
                "revenue": float(r[3] or 0),
            }
            for r in line_rows
        ],
        limit=5,
    )

    return JSONResponse(
        status_code=200,
        content={
            "source": "server",
            "generated_at": utc_naive_iso(now),
            "counts": {
                "products_active": int(products_active or 0),
                "users_active": int(users_active or 0),
                "orders_pending": int(orders_pending or 0),
            },
            "periods": {
                k: {
                    "orders": v.orders,
                    "revenue": round(v.revenue, 2),
                    "previous_orders": v.previous_orders,
                    "previous_revenue": round(v.previous_revenue, 2),
                }
                for k, v in periods.items()
            },
            "status_breakdown": status_breakdown,
            "daily_series": daily_series,
            "top_products": [
                {
                    "id_product": p["id_product"],
                    "name": p["name"],
                    "quantity": p["quantity"],
                    "revenue": round(float(p["revenue"]), 2),
                }
                for p in top_products
            ],
        },
    )
