from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from models.user import User
import traceback

from models import Order, OrderProduct, InputOrderUpdate, InputPaginatedRequestFilter
from models.order import OrderCreateClient, OrderCreateAdmin
from models.product import Product
from config.db import AsyncSessionLocal
from auth.roles import require_roles
from utils.datetime_api import utc_naive_iso

order_router = APIRouter(prefix="/order", tags=["Order"])


def _compute_total(lines):
    return sum(line.quantity * line.unit_price for line in lines)


def _order_display_name(order: Order) -> Optional[str]:
    if order.customer_name and str(order.customer_name).strip():
        return str(order.customer_name).strip()
    if order.user:
        return (order.user.name or order.user.email or "").strip() or order.user.email
    return None


def _unit_price_from_product(product: Product, quantity: int) -> float:
    """Precio unitario según producto: base o mejor volumen si has_tiered_pricing."""
    if not product.has_tiered_pricing or not product.price_tiers:
        return float(product.price)
    best = None
    for t in product.price_tiers:
        if quantity >= t.min_quantity and (best is None or t.min_quantity > best.min_quantity):
            best = t
    return float(best.unit_price) if best else float(product.price)


@order_router.post("/paginated")
async def get_orders_paginated(req: Request, body: InputPaginatedRequestFilter):
    """Lista paginada de pedidos. CLIENT: solo los propios. ADMIN: todos."""
    payload = require_roles(req.headers, ["CLIENT", "ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    user_id = int(payload["sub"])
    role = payload.get("role", "").upper()
    limit = body.limit or 20
    last_seen_id = body.last_seen_id
    filters = body.filters or {}
    search = (filters.get("search") or "").strip()
    date_from = filters.get("date_from")
    date_to = filters.get("date_to")
    status_filter = filters.get("status")
    active_filter = filters.get("active")

    async with AsyncSessionLocal() as session:
        stmt = select(Order).options(
            selectinload(Order.order_products),
            selectinload(Order.user),
        )
        if role == "CLIENT":
            stmt = stmt.where(Order.id_user == user_id)
        if search:
            stmt = stmt.outerjoin(Order.user)
            stmt = stmt.where(
                or_(
                    User.email.ilike(f"%{search}%"),
                    User.name.ilike(f"%{search}%"),
                    Order.customer_name.ilike(f"%{search}%"),
                )
            )
        if date_from:
            try:
                d = datetime.strptime(str(date_from)[:10], "%Y-%m-%d")
                stmt = stmt.where(Order.created_at >= d)
            except ValueError:
                pass
        if date_to:
            try:
                d = datetime.strptime(str(date_to)[:10], "%Y-%m-%d")
                d_end = d + timedelta(days=1)
                stmt = stmt.where(Order.created_at < d_end)
            except ValueError:
                pass
        if status_filter:
            stmt = stmt.where(Order.status == str(status_filter).upper())
        if active_filter is not None:
            stmt = stmt.where(Order.active.is_(bool(active_filter)))
        else:
            stmt = stmt.where(Order.active.is_(True))

        stmt = stmt.order_by(Order.id.desc())
        if last_seen_id is not None:
            stmt = stmt.where(Order.id < last_seen_id)
        stmt = stmt.limit(limit)

        result = await session.execute(stmt)
        orders = result.scalars().unique().all()

        items = []
        for o in orders:
            items.append({
                "id": o.id,
                "id_user": o.id_user,
                "customer_name": o.customer_name,
                "user_name": _order_display_name(o),
                "total": o.total,
                "date": o.date.isoformat() if o.date else None,
                "created_at": utc_naive_iso(o.created_at),
                "payment": o.payment,
                "status": o.status,
                "active": o.active,
                "lines": [
                    {
                        "id": op.id,
                        "id_product": op.id_product,
                        "quantity": op.quantity,
                        "unit_price": op.unit_price,
                    }
                    for op in o.order_products
                ],
            })

        return JSONResponse(
            status_code=200,
            content={
                "items": items,
                "next_cursor": orders[-1].id if len(orders) == limit else None,
            },
        )


@order_router.get("/{order_id}")
async def get_order(req: Request, order_id: int):
    """Obtener pedido por id. CLIENT: solo el propio. ADMIN: cualquiera."""
    payload = require_roles(req.headers, ["CLIENT", "ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    user_id = int(payload["sub"])
    role = payload.get("role", "").upper()

    async with AsyncSessionLocal() as session:
        stmt = select(Order).where(Order.id == order_id).options(
            selectinload(Order.order_products),
            selectinload(Order.user),
        )
        result = await session.execute(stmt)
        o = result.scalar_one_or_none()
        if not o:
            return JSONResponse(status_code=404, content={"message": "Pedido no encontrado"})
        if role == "CLIENT" and o.id_user != user_id:
            return JSONResponse(status_code=403, content={"message": "Acceso denegado"})

        return JSONResponse(
            status_code=200,
            content={
                "id": o.id,
                "id_user": o.id_user,
                "customer_name": o.customer_name,
                "user_name": _order_display_name(o),
                "total": o.total,
                "date": o.date.isoformat() if o.date else None,
                "created_at": utc_naive_iso(o.created_at),
                "payment": o.payment,
                "status": o.status,
                "active": o.active,
                "lines": [
                    {
                        "id": op.id,
                        "id_product": op.id_product,
                        "quantity": op.quantity,
                        "unit_price": op.unit_price,
                    }
                    for op in o.order_products
                ],
            },
        )


@order_router.post("/create-client")
async def create_order_client(req: Request, body: OrderCreateClient):
    """Crear pedido como CLIENTE. Solo CLIENT. unit_price se calcula por producto/volúmenes."""
    payload = require_roles(req.headers, ["CLIENT"])
    if isinstance(payload, JSONResponse):
        return payload

    user_id = int(payload["sub"])

    try:
        async with AsyncSessionLocal() as session:
            product_ids = [line.id_product for line in body.lines]
            stmt = select(Product).where(Product.id.in_(product_ids)).options(
                selectinload(Product.price_tiers)
            )
            result = await session.execute(stmt)
            products = { p.id: p for p in result.scalars().unique().all() }

            order_date = body.date or date.today()
            order = Order(
                id_user=user_id,
                date=order_date,
                payment=body.payment,
                status="PENDING",
                total=0,
            )
            session.add(order)
            await session.flush()

            total = 0.0
            for line in body.lines:
                product = products.get(line.id_product)
                if not product:
                    return JSONResponse(
                        status_code=400,
                        content={"message": f"Producto id {line.id_product} no encontrado"},
                    )
                unit_price = _unit_price_from_product(product, line.quantity)
                op = OrderProduct(
                    id_order=order.id,
                    id_product=line.id_product,
                    quantity=line.quantity,
                    unit_price=unit_price,
                )
                session.add(op)
                total += line.quantity * unit_price

            order.total = total
            await session.commit()
            await session.refresh(order)

            return JSONResponse(
                status_code=201,
                content={
                    "message": "Pedido creado",
                    "id": order.id,
                    "total": order.total,
                },
            )
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"message": "Error al crear pedido"})


@order_router.post("/create-admin")
async def create_order_admin(req: Request, body: OrderCreateAdmin):
    """Crear pedido como ADMIN. Solo ADMIN. unit_price opcional por línea (si no viene, se calcula)."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    id_user = body.id_user
    guest_name = (body.customer_name or "").strip() or None
    if id_user is None and not guest_name:
        return JSONResponse(
            status_code=400,
            content={"message": "Indicá un cliente registrado o un nombre para el pedido"},
        )
    if id_user is not None and guest_name:
        return JSONResponse(
            status_code=400,
            content={"message": "Usá cliente registrado o nombre libre, no ambos"},
        )

    try:
        async with AsyncSessionLocal() as session:
            if id_user is not None:
                user_row = await session.get(User, id_user)
                if not user_row:
                    return JSONResponse(status_code=400, content={"message": "Cliente no encontrado"})

            product_ids = [line.id_product for line in body.lines]
            stmt = select(Product).where(Product.id.in_(product_ids)).options(
                selectinload(Product.price_tiers)
            )
            result = await session.execute(stmt)
            products = { p.id: p for p in result.scalars().unique().all() }

            order_date = body.date or date.today()
            order = Order(
                id_user=id_user,
                customer_name=guest_name,
                date=order_date,
                payment=body.payment,
                status="PENDING",
                total=0,
            )
            session.add(order)
            await session.flush()

            total = 0.0
            for line in body.lines:
                if line.unit_price is not None:
                    unit_price = line.unit_price
                else:
                    product = products.get(line.id_product)
                    if not product:
                        return JSONResponse(
                            status_code=400,
                            content={"message": f"Producto id {line.id_product} no encontrado"},
                        )
                    unit_price = _unit_price_from_product(product, line.quantity)

                op = OrderProduct(
                    id_order=order.id,
                    id_product=line.id_product,
                    quantity=line.quantity,
                    unit_price=unit_price,
                )
                session.add(op)
                total += line.quantity * unit_price

            order.total = total
            await session.commit()
            await session.refresh(order)

            return JSONResponse(
                status_code=201,
                content={
                    "message": "Pedido creado",
                    "id": order.id,
                    "total": order.total,
                },
            )
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"message": "Error al crear pedido"})


@order_router.put("/update")
async def update_order(req: Request, body: InputOrderUpdate):
    """Actualizar pedido (datos y/o líneas). Si hay lines, se reemplazan y se recalcula total. Solo ADMIN o propio."""
    payload = require_roles(req.headers, ["CLIENT", "ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    user_id = int(payload["sub"])
    role = payload.get("role", "").upper()

    try:
        async with AsyncSessionLocal() as session:
            stmt = select(Order).where(Order.id == body.id).options(selectinload(Order.order_products))
            result = await session.execute(stmt)
            order = result.scalar_one_or_none()
            if not order:
                return JSONResponse(status_code=404, content={"message": "Pedido no encontrado"})
            if role == "CLIENT" and order.id_user != user_id:
                return JSONResponse(status_code=403, content={"message": "Acceso denegado"})

            if body.date is not None:
                order.date = body.date
            if body.payment is not None:
                order.payment = body.payment
            if body.status is not None:
                order.status = body.status.upper()
            if body.active is not None:
                order.active = body.active

            if body.lines is not None:
                for op in order.order_products:
                    await session.delete(op)
                await session.flush()
                total = 0.0
                for line in body.lines:
                    op = OrderProduct(
                        id_order=order.id,
                        id_product=line.id_product,
                        quantity=line.quantity,
                        unit_price=line.unit_price,
                    )
                    session.add(op)
                    total += line.quantity * line.unit_price
                order.total = total

            await session.commit()
            return JSONResponse(status_code=200, content={"message": "Pedido actualizado"})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"message": "Error al actualizar pedido"})


@order_router.put("/{order_id}/deactivate")
async def deactivate_order(req: Request, order_id: int):
    """Baja lógica de pedido (active=False). Solo ADMIN."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    async with AsyncSessionLocal() as session:
        stmt = select(Order).where(Order.id == order_id)
        result = await session.execute(stmt)
        order = result.scalar_one_or_none()
        if not order:
            return JSONResponse(status_code=404, content={"message": "Pedido no encontrado"})
        order.active = False
        await session.commit()
        return JSONResponse(status_code=200, content={"message": "Pedido desactivado"})


@order_router.put("/{order_id}/status")
async def set_order_status(req: Request, order_id: int, status: str = ""):
    """Cambiar estado del pedido (PENDING, FULFILLED, CANCELED). Query: ?status=FULFILLED. Solo ADMIN."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    status = (status or "").strip().upper()
    if status not in ("PENDING", "FULFILLED", "CANCELED"):
        return JSONResponse(status_code=400, content={"message": "Estado no válido"})

    async with AsyncSessionLocal() as session:
        stmt = select(Order).where(Order.id == order_id)
        result = await session.execute(stmt)
        order = result.scalar_one_or_none()
        if not order:
            return JSONResponse(status_code=404, content={"message": "Pedido no encontrado"})
        order.status = status
        await session.commit()
        return JSONResponse(status_code=200, content={"message": f"Estado actualizado a {status}"})
