from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone

from config.db import AsyncSessionLocal
from auth.roles import require_roles
from models.user import User
from models.product import Product
from models.order import Order
from utils.datetime_api import utc_naive_iso

sync_router = APIRouter(prefix="/sync", tags=["Sync"])


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _since_ms_to_dt(since_ms: int | None) -> datetime:
    if not since_ms:
        return datetime(1970, 1, 1)
    return datetime.fromtimestamp(since_ms / 1000, tz=timezone.utc).replace(tzinfo=None)


@sync_router.get("/users")
async def sync_users(req: Request, since: int | None = None):
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    since_dt = _since_ms_to_dt(since)
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.updated_at > since_dt)
        result = await session.execute(stmt)
        items = result.scalars().all()

    server_time = int(datetime.now(timezone.utc).timestamp() * 1000)
    return JSONResponse(
        status_code=200,
        content={
            "serverTime": server_time,
            "items": [
                {
                    "id": u.id,
                    "email": u.email,
                    "name": u.name,
                    "location": u.location,
                    "rol": u.rol,
                    "active": u.active,
                    "updated_at": utc_naive_iso(u.updated_at),
                }
                for u in items
            ],
        },
    )


@sync_router.get("/products")
async def sync_products(req: Request, since: int | None = None):
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    since_dt = _since_ms_to_dt(since)
    async with AsyncSessionLocal() as session:
        stmt = select(Product).where(Product.updated_at > since_dt)
        result = await session.execute(stmt)
        items = result.scalars().all()

    server_time = int(datetime.now(timezone.utc).timestamp() * 1000)
    return JSONResponse(
        status_code=200,
        content={
            "serverTime": server_time,
            "items": [
                {
                    "id": p.id,
                    "name": p.name,
                    "price": p.price,
                    "brand": p.brand,
                    "category": p.category,
                    "has_tiered_pricing": p.has_tiered_pricing,
                    "img": p.img,
                    "active": p.active,
                    "updated_at": utc_naive_iso(p.updated_at),
                }
                for p in items
            ],
        },
    )


@sync_router.get("/orders")
async def sync_orders(req: Request, since: int | None = None):
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    since_dt = _since_ms_to_dt(since)
    async with AsyncSessionLocal() as session:
        stmt = (
            select(Order)
            .where(Order.updated_at > since_dt)
            .options(selectinload(Order.order_products), selectinload(Order.user))
        )
        result = await session.execute(stmt)
        items = result.scalars().unique().all()

    server_time = int(datetime.now(timezone.utc).timestamp() * 1000)
    return JSONResponse(
        status_code=200,
        content={
            "serverTime": server_time,
            "items": [
                {
                    "id": o.id,
                    "id_user": o.id_user,
                    "user_name": (
                        ((o.user.name or o.user.email or "").strip() or o.user.email)
                        if o.user
                        else None
                    ),
                    "total": o.total,
                    "date": o.date.isoformat() if o.date else None,
                    "created_at": utc_naive_iso(o.created_at),
                    "payment": o.payment,
                    "status": o.status,
                    "active": o.active,
                    "updated_at": utc_naive_iso(o.updated_at),
                    "lines": [
                        {
                            "id": op.id,
                            "id_product": op.id_product,
                            "quantity": op.quantity,
                            "unit_price": op.unit_price,
                        }
                        for op in o.order_products
                    ],
                }
                for o in items
            ],
        },
    )

