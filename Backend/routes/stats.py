from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy import func, select

from auth.roles import require_roles
from config.db import AsyncSessionLocal
from models.order import Order, OrderProduct
from models.product import Product
from models.user import User
from services.dashboard_stats import (
    build_dashboard_periods,
    period_windows,
)
from services.sales_stats import (
    SalesFilters,
    build_sales_stats,
    default_date_range,
    lines_from_rows,
    parse_date_param,
)
from utils.datetime_api import utc_naive_iso

stats_router = APIRouter(prefix="/stats", tags=["Stats"])


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@stats_router.get("/dashboard")
async def get_dashboard_stats(req: Request):
    """Métricas agregadas para el panel admin. Solo ADMIN."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    now = _utcnow_naive()
    fetch_start = min(w.previous_start for w in period_windows(now).values())

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

        line_rows = (
            await session.execute(
                select(
                    OrderProduct.id_product,
                    Product.name,
                    OrderProduct.weight,
                    (OrderProduct.weight * OrderProduct.price_per_kg).label("line_total"),
                    Order.created_at,
                    Order.status,
                )
                .join(Order, Order.id == OrderProduct.id_order)
                .join(Product, Product.id == OrderProduct.id_product)
                .where(
                    Order.active.is_(True),
                    Order.created_at >= fetch_start,
                )
            )
        ).all()

    lines = [
        {
            "id_product": r[0],
            "name": r[1],
            "total_kg": float(r[2] or 0),
            "revenue": float(r[3] or 0),
            "created_at": r[4],
            "status": r[5] or "PENDING",
        }
        for r in line_rows
    ]
    periods = build_dashboard_periods(rows, lines, now)
    today = periods["day"]

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
            "periods": periods,
            "status_breakdown": today["status_breakdown"],
            "daily_series": today["daily_series"],
            "top_products": today["top_products"],
        },
    )


@stats_router.get("/sales")
async def get_sales_stats(
    req: Request,
    date_from: str | None = Query(None, alias="date_from"),
    date_to: str | None = Query(None, alias="date_to"),
    product_id: int | None = Query(None, alias="product_id"),
    category: str | None = Query(None, alias="category"),
    granularity: str = Query("day", alias="granularity"),
):
    """Estadísticas de ventas detalladas. Solo ADMIN."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    if granularity not in ("day", "week", "month", "year"):
        return JSONResponse(status_code=400, content={"message": "granularity inválida"})

    now = _utcnow_naive()
    default_from, default_to = default_date_range(now)
    d_from = parse_date_param(date_from, default_from)
    d_to = parse_date_param(date_to, default_to)
    if d_from > d_to:
        return JSONResponse(status_code=400, content={"message": "date_from no puede ser posterior a date_to"})

    filters = SalesFilters(
        date_from=d_from,
        date_to=d_to,
        product_id=product_id,
        category=category or None,
        granularity=granularity,  # type: ignore[arg-type]
    )

    prev_start = filters.date_from - timedelta(days=(d_to - d_from).days + 1)
    query_start = datetime.combine(prev_start, datetime.min.time())

    async with AsyncSessionLocal() as session:
        line_rows = (
            await session.execute(
                select(
                    Order.id.label("order_id"),
                    Order.created_at,
                    Order.status,
                    Order.id_user,
                    Order.customer_name,
                    User.name.label("user_name"),
                    OrderProduct.id_product,
                    Product.name.label("product_name"),
                    Product.category,
                    OrderProduct.weight,
                    OrderProduct.price_per_kg,
                    Product.fixed_weight,
                    Product.weight.label("piece_weight"),
                )
                .join(OrderProduct, OrderProduct.id_order == Order.id)
                .join(Product, Product.id == OrderProduct.id_product)
                .outerjoin(User, User.id == Order.id_user)
                .where(
                    Order.active.is_(True),
                    Order.created_at >= query_start,
                )
            )
        ).all()

    lines = lines_from_rows(
        [
            {
                "order_id": r[0],
                "created_at": r[1],
                "status": r[2],
                "id_user": r[3],
                "customer_name": r[4],
                "user_name": r[5],
                "id_product": r[6],
                "product_name": r[7],
                "category": r[8],
                "weight": r[9],
                "price_per_kg": r[10],
                "fixed_weight": r[11],
                "piece_weight": r[12],
            }
            for r in line_rows
        ]
    )

    stats = build_sales_stats(lines, filters)
    stats["source"] = "server"
    stats["generated_at"] = utc_naive_iso(now)

    return JSONResponse(status_code=200, content=stats)
