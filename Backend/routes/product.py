from fastapi import APIRouter, Request, File, UploadFile, Form
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import traceback
import os
import uuid

from models import Product, InputProduct, InputProductUpdate, InputPaginatedRequestFilter
from models.product import InputProductVisibility
from services.product_status import (
    STATUS_ACTIVE,
    STATUS_INACTIVE,
    STATUS_SIN_STOCK,
    ADMIN_VISIBLE_STATUSES,
    sync_active_flag,
)
from models.product_price_tier import ProductPriceTier
from config.db import AsyncSessionLocal
from auth.roles import require_roles
from services.product_image import UPLOAD_DIR, process_product_upload
from services.product_brand import resolve_canonical_brand

product_router = APIRouter(prefix="/product", tags=["Product"])

ALLOWED_EXTENSIONS = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB


def _product_payload(p: Product) -> dict:
    status = p.status or STATUS_ACTIVE
    return {
        "id": p.id,
        "name": p.name,
        "price": p.price,
        "weight": p.weight,
        "fixed_weight": p.fixed_weight,
        "brand": p.brand,
        "category": p.category,
        "has_tiered_pricing": p.has_tiered_pricing,
        "img": p.img,
        "status": status,
        "active": sync_active_flag(status),
        "price_tiers": [
            {"id": t.id, "min_kg": t.min_kg, "price_per_kg": t.price_per_kg}
            for t in p.price_tiers
        ],
    }


def _apply_product_list_filters(stmt, filters: dict):
    search = (filters.get("search") or "").strip()
    category = filters.get("category")
    admin_list = filters.get("admin_list") is True
    status_filter = filters.get("status")
    active_filter = filters.get("active")

    if search:
        stmt = stmt.where(
            Product.name.ilike(f"%{search}%") | Product.brand.ilike(f"%{search}%")
        )
    if category:
        stmt = stmt.where(Product.category.ilike(f"%{category}%"))

    if admin_list:
        if status_filter == STATUS_INACTIVE or active_filter is False:
            stmt = stmt.where(Product.status == STATUS_INACTIVE)
        elif status_filter == STATUS_SIN_STOCK:
            stmt = stmt.where(Product.status == STATUS_SIN_STOCK)
        elif status_filter == STATUS_ACTIVE or active_filter is True:
            stmt = stmt.where(Product.status == STATUS_ACTIVE)
        else:
            stmt = stmt.where(Product.status.in_(ADMIN_VISIBLE_STATUSES))
    else:
        stmt = stmt.where(Product.status == STATUS_ACTIVE)

    return stmt


@product_router.post("/upload")
async def upload_image(
    req: Request,
    file: UploadFile = File(...),
    name: str = Form(...),
    brand: str = Form(""),
):
    """Subir imagen de producto con logo, nombre y marca. Solo ADMIN."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    product_name = (name or "").strip()
    if not product_name:
        return JSONResponse(status_code=400, content={"message": "Indicá el nombre del producto antes de subir la imagen"})

    if file.content_type not in ALLOWED_EXTENSIONS:
        return JSONResponse(
            status_code=400,
            content={"message": "Tipo de archivo no permitido. Use JPEG, PNG, GIF o WebP."},
        )

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.webp"
    filepath = os.path.join(UPLOAD_DIR, filename)

    try:
        content = await file.read()
        if len(content) > MAX_UPLOAD_BYTES:
            return JSONResponse(status_code=400, content={"message": "La imagen no debe superar 5 MB"})

        optimized_content, width, height = process_product_upload(
            content,
            product_name,
            (brand or "").strip() or None,
        )
        with open(filepath, "wb") as f:
            f.write(optimized_content)
        url = f"/uploads/{filename}"
        return JSONResponse(
            status_code=200,
            content={
                "url": url,
                "width": width,
                "height": height,
                "size_kb": round(len(optimized_content) / 1024, 1),
            },
        )
    except Exception:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"message": "Error al procesar o guardar la imagen"})


@product_router.post("/paginated")
async def get_products_paginated(req: Request, body: InputPaginatedRequestFilter):
    """Lista paginada de productos. Público (catálogo) o admin (admin_list en filters)."""
    limit = body.limit or 20
    last_seen_id = body.last_seen_id
    filters = body.filters or {}

    async with AsyncSessionLocal() as session:
        stmt = select(Product).options(selectinload(Product.price_tiers))
        stmt = _apply_product_list_filters(stmt, filters)

        stmt = stmt.order_by(Product.id.desc())
        if last_seen_id is not None:
            stmt = stmt.where(Product.id < last_seen_id)
        stmt = stmt.limit(limit)

        result = await session.execute(stmt)
        products = result.scalars().unique().all()

        items = [_product_payload(p) for p in products]

        return JSONResponse(
            status_code=200,
            content={
                "items": items,
                "next_cursor": products[-1].id if len(products) == limit else None,
            },
        )


@product_router.get("/{product_id}")
async def get_product(req: Request, product_id: int):
    """Obtener producto por id. Público."""
    async with AsyncSessionLocal() as session:
        stmt = select(Product).where(Product.id == product_id).options(selectinload(Product.price_tiers))
        result = await session.execute(stmt)
        p = result.scalar_one_or_none()
        if not p:
            return JSONResponse(status_code=404, content={"message": "Producto no encontrado"})

        if p.status != STATUS_ACTIVE:
            return JSONResponse(status_code=404, content={"message": "Producto no disponible"})

        return JSONResponse(status_code=200, content=_product_payload(p))


@product_router.post("/create")
async def create_product(req: Request, body: InputProduct):
    """Crear producto. Solo ADMIN."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    try:
        async with AsyncSessionLocal() as session:
            brand = await resolve_canonical_brand(session, body.brand)
            p = Product(
                name=body.name,
                price=body.price,
                weight=body.weight,
                fixed_weight=body.fixed_weight,
                brand=brand,
                category=body.category,
                has_tiered_pricing=body.has_tiered_pricing,
                img=body.img,
                status=STATUS_ACTIVE,
                active=True,
            )
            session.add(p)
            await session.commit()
            await session.refresh(p)
            return JSONResponse(
                status_code=201,
                content={"message": "Producto creado", "id": p.id},
            )
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"message": "Error al crear producto"})


@product_router.put("/update")
async def update_product(req: Request, body: InputProductUpdate):
    """Actualizar producto. Solo ADMIN."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    try:
        async with AsyncSessionLocal() as session:
            stmt = select(Product).where(Product.id == body.id)
            result = await session.execute(stmt)
            p = result.scalar_one_or_none()
            if not p:
                return JSONResponse(status_code=404, content={"message": "Producto no encontrado"})

            if body.name is not None:
                p.name = body.name
            if body.price is not None:
                p.price = body.price
            if body.weight is not None:
                p.weight = body.weight
            if body.fixed_weight is not None:
                p.fixed_weight = body.fixed_weight
            if body.brand is not None:
                p.brand = await resolve_canonical_brand(session, body.brand)
            if body.category is not None:
                p.category = body.category
            if body.has_tiered_pricing is not None:
                p.has_tiered_pricing = body.has_tiered_pricing
            if body.img is not None:
                p.img = body.img
            if body.status is not None:
                p.status = body.status
                p.active = sync_active_flag(body.status)
            elif body.active is not None:
                p.active = body.active
                p.status = STATUS_INACTIVE if not body.active else STATUS_ACTIVE

            await session.commit()
            return JSONResponse(status_code=200, content={"message": "Producto actualizado"})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"message": "Error al actualizar producto"})


@product_router.put("/{product_id}/deactivate")
async def deactivate_product(req: Request, product_id: int):
    """Baja lógica de producto. Solo ADMIN."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    async with AsyncSessionLocal() as session:
        stmt = select(Product).where(Product.id == product_id)
        result = await session.execute(stmt)
        p = result.scalar_one_or_none()
        if not p:
            return JSONResponse(status_code=404, content={"message": "Producto no encontrado"})
        p.status = STATUS_INACTIVE
        p.active = False
        await session.commit()
        return JSONResponse(status_code=200, content={"message": "Producto desactivado"})


@product_router.put("/{product_id}/visibility")
async def set_product_visibility(req: Request, product_id: int, body: InputProductVisibility):
    """Alterna visibilidad en catálogo: active ↔ sin_stock. Solo ADMIN."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    if body.status not in (STATUS_ACTIVE, STATUS_SIN_STOCK):
        return JSONResponse(
            status_code=400,
            content={"message": "Estado inválido. Use active o sin_stock."},
        )

    async with AsyncSessionLocal() as session:
        stmt = select(Product).where(Product.id == product_id)
        result = await session.execute(stmt)
        p = result.scalar_one_or_none()
        if not p:
            return JSONResponse(status_code=404, content={"message": "Producto no encontrado"})
        if p.status == STATUS_INACTIVE:
            return JSONResponse(
                status_code=400,
                content={"message": "No se puede cambiar la visibilidad de un producto inactivo"},
            )
        p.status = body.status
        p.active = True
        await session.commit()
        return JSONResponse(
            status_code=200,
            content={"message": "Estado actualizado", "status": p.status},
        )
