from datetime import date, datetime
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import traceback

from models import Order, OrderProduct, InputOrder, InputOrderUpdate, InputPaginatedRequestFilter
from config.db import AsyncSessionLocal
from auth.roles import require_roles

order_router = APIRouter(prefix="/order", tags=["Order"])


def _compute_total(lines):
    return sum(line.quantity * line.unit_price for line in lines)


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
    status_filter = filters.get("status")
    active_filter = filters.get("active")

    async with AsyncSessionLocal() as session:
        stmt = select(Order).options(selectinload(Order.order_products))
        if role == "CLIENT":
            stmt = stmt.where(Order.id_user == user_id)
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
                "total": o.total,
                "date": o.date.isoformat() if o.date else None,
                "created_at": o.created_at.isoformat() if o.created_at else None,
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
        stmt = select(Order).where(Order.id == order_id).options(selectinload(Order.order_products))
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
                "total": o.total,
                "date": o.date.isoformat() if o.date else None,
                "created_at": o.created_at.isoformat() if o.created_at else None,
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


@order_router.post("/create")
async def create_order(req: Request, body: InputOrder):
    """Crear pedido. CLIENT o ADMIN. Se calcula total desde las líneas."""
    payload = require_roles(req.headers, ["CLIENT", "ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    try:
        async with AsyncSessionLocal() as session:
            order_date = body.date or date.today()
            order = Order(
                id_user=body.id_user,
                date=order_date,
                payment=body.payment,
                status="PENDING",
                total=0,
            )
            session.add(order)
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
