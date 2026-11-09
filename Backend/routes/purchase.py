from datetime import datetime, timezone, date

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
import traceback

from models.supplier import Supplier
from models.purchase import Purchase, PurchaseLine, InputPurchase, InputPurchaseUpdate
from models.product import Product
from models.pagination import InputPaginatedRequestFilter
from config.db import AsyncSessionLocal
from auth.roles import require_roles
from services.purchase_present import purchase_dict
from services.purchase_totals import (
    PurchaseLineIn,
    apply_purchase_lines,
    compute_purchase_total,
    validate_purchase_draft,
)

purchase_router = APIRouter(prefix="/purchase", tags=["Purchase"])

_NOTE_MAX = 500


def _utcnow_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _parse_note(note: str | None) -> str | None | JSONResponse:
    cleaned = (note or "").strip()
    if not cleaned:
        return None
    if len(cleaned) > _NOTE_MAX:
        return JSONResponse(status_code=400, content={"message": "La nota es demasiado larga"})
    return cleaned


def _parse_date(value: str | None) -> date | None | JSONResponse:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return JSONResponse(status_code=400, content={"message": "Fecha inválida"})


def _lines_in(lines) -> list[PurchaseLineIn]:
    return [
        PurchaseLineIn(
            id_product=int(line.id_product),
            weight=float(line.weight),
            price_per_kg=float(line.price_per_kg),
        )
        for line in lines
    ]


async def _load_products(session, product_ids: list[int]) -> dict[int, Product]:
    if not product_ids:
        return {}
    stmt = select(Product).where(Product.id.in_(product_ids))
    result = await session.execute(stmt)
    return {row.id: row for row in result.scalars().all()}


async def _load_purchase(session, purchase_id: int) -> Purchase | None:
    stmt = (
        select(Purchase)
        .where(Purchase.id == purchase_id)
        .options(
            selectinload(Purchase.supplier),
            selectinload(Purchase.lines).selectinload(PurchaseLine.product),
        )
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


@purchase_router.post("/paginated")
async def get_purchases_paginated(req: Request, body: InputPaginatedRequestFilter):
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    limit = body.limit or 20
    last_seen_id = body.last_seen_id
    filters = body.filters or {}
    search = (filters.get("search") or "").strip()
    active_filter = filters.get("active")
    supplier_id = filters.get("id_supplier")
    date_from = _parse_date(filters.get("date_from"))
    date_to = _parse_date(filters.get("date_to"))
    if isinstance(date_from, JSONResponse):
        return date_from
    if isinstance(date_to, JSONResponse):
        return date_to

    async with AsyncSessionLocal() as session:
        stmt = select(Purchase).options(
            selectinload(Purchase.supplier),
            selectinload(Purchase.lines).selectinload(PurchaseLine.product),
        )
        if search:
            stmt = stmt.join(Purchase.supplier).where(
                or_(Supplier.name.ilike(f"%{search}%"), Purchase.note.ilike(f"%{search}%"))
            )
        if supplier_id is not None and str(supplier_id).strip() != "":
            try:
                stmt = stmt.where(Purchase.id_supplier == int(supplier_id))
            except (TypeError, ValueError):
                return JSONResponse(status_code=400, content={"message": "Proveedor inválido"})
        if date_from is not None:
            stmt = stmt.where(Purchase.date >= date_from)
        if date_to is not None:
            stmt = stmt.where(Purchase.date <= date_to)
        if active_filter is True:
            stmt = stmt.where(Purchase.active.is_(True))
        elif active_filter is False:
            stmt = stmt.where(Purchase.active.is_(False))
        stmt = stmt.order_by(Purchase.id.desc())
        if last_seen_id is not None:
            stmt = stmt.where(Purchase.id < last_seen_id)
        stmt = stmt.limit(limit)
        result = await session.execute(stmt)
        rows = result.scalars().unique().all()
        return JSONResponse(
            status_code=200,
            content={
                "items": [purchase_dict(row) for row in rows],
                "next_cursor": rows[-1].id if len(rows) == limit else None,
            },
        )


@purchase_router.get("/{purchase_id}")
async def get_purchase(req: Request, purchase_id: int):
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    async with AsyncSessionLocal() as session:
        row = await _load_purchase(session, purchase_id)
        if not row:
            return JSONResponse(status_code=404, content={"message": "Abastecimiento no encontrado"})
        return JSONResponse(status_code=200, content=purchase_dict(row))


@purchase_router.post("/create")
async def create_purchase(req: Request, body: InputPurchase):
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    note = _parse_note(body.note)
    if isinstance(note, JSONResponse):
        return note

    unitemized = round(float(body.unitemized_amount or 0), 2)
    lines_in = _lines_in(body.lines or [])
    draft_error = validate_purchase_draft(lines_in, unitemized)
    if draft_error:
        return JSONResponse(status_code=400, content={"message": draft_error})

    try:
        async with AsyncSessionLocal() as session:
            supplier = await session.get(Supplier, body.id_supplier)
            if not supplier:
                return JSONResponse(status_code=400, content={"message": "Proveedor no encontrado"})

            products = await _load_products(session, [line.id_product for line in lines_in])
            built, line_error = apply_purchase_lines(products, lines_in)
            if line_error:
                return JSONResponse(status_code=400, content={"message": line_error})

            purchase = Purchase(
                id_supplier=supplier.id,
                date=body.date or date.today(),
                unitemized_amount=unitemized,
                total=compute_purchase_total(
                    [(line.weight, line.price_per_kg) for line in lines_in],
                    unitemized,
                ),
                note=note,
                active=True,
                updated_at=_utcnow_naive(),
            )
            session.add(purchase)
            await session.flush()
            for line in built:
                session.add(
                    PurchaseLine(
                        id_purchase=purchase.id,
                        id_product=line["id_product"],
                        weight=line["weight"],
                        price_per_kg=line["price_per_kg"],
                    )
                )
            await session.commit()
            saved = await _load_purchase(session, purchase.id)
            return JSONResponse(
                status_code=201,
                content={
                    "message": "Abastecimiento creado",
                    "id": purchase.id,
                    "total": purchase.total,
                    "purchase": purchase_dict(saved),
                },
            )
    except Exception:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"message": "Error al crear abastecimiento"})


@purchase_router.put("/update")
async def update_purchase(req: Request, body: InputPurchaseUpdate):
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    note = None
    if body.note is not None:
        note = _parse_note(body.note)
        if isinstance(note, JSONResponse):
            return note

    try:
        async with AsyncSessionLocal() as session:
            purchase = await _load_purchase(session, body.id)
            if not purchase:
                return JSONResponse(status_code=404, content={"message": "Abastecimiento no encontrado"})

            if body.id_supplier is not None:
                supplier = await session.get(Supplier, body.id_supplier)
                if not supplier:
                    return JSONResponse(status_code=400, content={"message": "Proveedor no encontrado"})
                purchase.id_supplier = supplier.id

            if body.date is not None:
                purchase.date = body.date

            if body.note is not None:
                purchase.note = note

            unitemized = (
                round(float(body.unitemized_amount), 2)
                if body.unitemized_amount is not None
                else float(purchase.unitemized_amount or 0)
            )
            if body.lines is not None:
                lines_in = _lines_in(body.lines)
            else:
                lines_in = [
                    PurchaseLineIn(
                        id_product=line.id_product,
                        weight=float(line.weight),
                        price_per_kg=float(line.price_per_kg),
                    )
                    for line in purchase.lines
                ]

            draft_error = validate_purchase_draft(lines_in, unitemized)
            if draft_error:
                return JSONResponse(status_code=400, content={"message": draft_error})

            products = await _load_products(session, [line.id_product for line in lines_in])
            built, line_error = apply_purchase_lines(products, lines_in)
            if line_error:
                return JSONResponse(status_code=400, content={"message": line_error})

            purchase.unitemized_amount = unitemized
            purchase.total = compute_purchase_total(
                [(line.weight, line.price_per_kg) for line in lines_in],
                unitemized,
            )
            if body.lines is not None:
                purchase.lines.clear()
                await session.flush()
                for line in built:
                    purchase.lines.append(
                        PurchaseLine(
                            id_product=line["id_product"],
                            weight=line["weight"],
                            price_per_kg=line["price_per_kg"],
                        )
                    )

            purchase.updated_at = _utcnow_naive()
            await session.commit()
            saved = await _load_purchase(session, purchase.id)
            return JSONResponse(
                status_code=200,
                content={
                    "message": "Abastecimiento actualizado",
                    "id": purchase.id,
                    "total": purchase.total,
                    "purchase": purchase_dict(saved),
                },
            )
    except Exception:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"message": "Error al actualizar abastecimiento"})


@purchase_router.put("/{purchase_id}/deactivate")
async def deactivate_purchase(req: Request, purchase_id: int):
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    async with AsyncSessionLocal() as session:
        purchase = await _load_purchase(session, purchase_id)
        if not purchase:
            return JSONResponse(status_code=404, content={"message": "Abastecimiento no encontrado"})
        purchase.active = False
        purchase.updated_at = _utcnow_naive()
        await session.commit()
        saved = await _load_purchase(session, purchase.id)
        return JSONResponse(
            status_code=200,
            content={"message": "Abastecimiento desactivado", "purchase": purchase_dict(saved)},
        )
