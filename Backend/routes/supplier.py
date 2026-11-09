from datetime import datetime, timezone

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
import traceback

from models.supplier import Supplier, InputSupplier, InputSupplierUpdate
from models.pagination import InputPaginatedRequestFilter
from config.db import AsyncSessionLocal
from auth.roles import require_roles
from services.purchase_present import supplier_dict

supplier_router = APIRouter(prefix="/supplier", tags=["Supplier"])


def _utcnow_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _clean_name(name: str | None) -> str:
    return (name or "").strip()


@supplier_router.post("/paginated")
async def get_suppliers_paginated(req: Request, body: InputPaginatedRequestFilter):
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    limit = body.limit or 20
    last_seen_id = body.last_seen_id
    filters = body.filters or {}
    search = (filters.get("search") or "").strip()
    active_filter = filters.get("active")

    async with AsyncSessionLocal() as session:
        stmt = select(Supplier)
        if search:
            stmt = stmt.where(Supplier.name.ilike(f"%{search}%"))
        if active_filter is True:
            stmt = stmt.where(Supplier.active.is_(True))
        elif active_filter is False:
            stmt = stmt.where(Supplier.active.is_(False))
        stmt = stmt.order_by(Supplier.id.desc())
        if last_seen_id is not None:
            stmt = stmt.where(Supplier.id < last_seen_id)
        stmt = stmt.limit(limit)
        result = await session.execute(stmt)
        rows = result.scalars().all()
        return JSONResponse(
            status_code=200,
            content={
                "items": [supplier_dict(row) for row in rows],
                "next_cursor": rows[-1].id if len(rows) == limit else None,
            },
        )


@supplier_router.post("/create")
async def create_supplier(req: Request, body: InputSupplier):
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    name = _clean_name(body.name)
    if not name:
        return JSONResponse(status_code=400, content={"message": "El nombre es obligatorio"})

    try:
        async with AsyncSessionLocal() as session:
            row = Supplier(name=name, active=True, updated_at=_utcnow_naive())
            session.add(row)
            await session.commit()
            await session.refresh(row)
            return JSONResponse(
                status_code=201,
                content={"message": "Proveedor creado", "supplier": supplier_dict(row)},
            )
    except Exception:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"message": "Error al crear proveedor"})


@supplier_router.put("/update")
async def update_supplier(req: Request, body: InputSupplierUpdate):
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    try:
        async with AsyncSessionLocal() as session:
            row = await session.get(Supplier, body.id)
            if not row:
                return JSONResponse(status_code=404, content={"message": "Proveedor no encontrado"})
            if body.name is not None:
                name = _clean_name(body.name)
                if not name:
                    return JSONResponse(status_code=400, content={"message": "El nombre es obligatorio"})
                row.name = name
            if body.active is not None:
                row.active = body.active
            row.updated_at = _utcnow_naive()
            await session.commit()
            await session.refresh(row)
            return JSONResponse(
                status_code=200,
                content={"message": "Proveedor actualizado", "supplier": supplier_dict(row)},
            )
    except Exception:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"message": "Error al actualizar proveedor"})


@supplier_router.put("/{supplier_id}/deactivate")
async def deactivate_supplier(req: Request, supplier_id: int):
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    async with AsyncSessionLocal() as session:
        row = await session.get(Supplier, supplier_id)
        if not row:
            return JSONResponse(status_code=404, content={"message": "Proveedor no encontrado"})
        row.active = False
        row.updated_at = _utcnow_naive()
        await session.commit()
        await session.refresh(row)
        return JSONResponse(
            status_code=200,
            content={"message": "Proveedor desactivado", "supplier": supplier_dict(row)},
        )
