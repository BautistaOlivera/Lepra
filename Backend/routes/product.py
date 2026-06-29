from fastapi import APIRouter, Request, File, UploadFile, Form
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import traceback
import os
import uuid

from models import Product, InputProduct, InputProductUpdate, InputPaginatedRequestFilter
from models.product_price_tier import ProductPriceTier
from config.db import AsyncSessionLocal
from auth.roles import require_roles
from services.product_image import UPLOAD_DIR, process_product_upload

product_router = APIRouter(prefix="/product", tags=["Product"])

ALLOWED_EXTENSIONS = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB


@product_router.post("/upload")
async def upload_image(req: Request, file: UploadFile = File(...), name: str = Form(...)):
    """Subir imagen de producto con logo y nombre. Solo ADMIN."""
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

        optimized_content, width, height = process_product_upload(content, product_name)
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
    """Lista paginada de productos. Público (catálogo)."""
    limit = body.limit or 20
    last_seen_id = body.last_seen_id
    filters = body.filters or {}
    search = (filters.get("search") or "").strip()
    category = filters.get("category")
    active_filter = filters.get("active")

    async with AsyncSessionLocal() as session:
        stmt = select(Product).options(selectinload(Product.price_tiers))
        if search:
            stmt = stmt.where(
                Product.name.ilike(f"%{search}%") | Product.brand.ilike(f"%{search}%")
            )
        if category:
            stmt = stmt.where(Product.category.ilike(f"%{category}%"))
        if active_filter is not None:
            stmt = stmt.where(Product.active.is_(bool(active_filter)))
        else:
            stmt = stmt.where(Product.active.is_(True))

        stmt = stmt.order_by(Product.id.desc())
        if last_seen_id is not None:
            stmt = stmt.where(Product.id < last_seen_id)
        stmt = stmt.limit(limit)

        result = await session.execute(stmt)
        products = result.scalars().unique().all()

        items = []
        for p in products:
            items.append({
                "id": p.id,
                "name": p.name,
                "price": p.price,
                "weight": p.weight,
                "fixed_weight": p.fixed_weight,
                "brand": p.brand,
                "category": p.category,
                "has_tiered_pricing": p.has_tiered_pricing,
                "img": p.img,
                "active": p.active,
                "price_tiers": [
                    {"id": t.id, "min_kg": t.min_kg, "price_per_kg": t.price_per_kg}
                    for t in p.price_tiers
                ],
            })

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

        return JSONResponse(
            status_code=200,
            content={
                "id": p.id,
                "name": p.name,
                "price": p.price,
                "weight": p.weight,
                "fixed_weight": p.fixed_weight,
                "brand": p.brand,
                "category": p.category,
                "has_tiered_pricing": p.has_tiered_pricing,
                "img": p.img,
                "active": p.active,
                "price_tiers": [
                    {"id": t.id, "min_kg": t.min_kg, "price_per_kg": t.price_per_kg}
                    for t in p.price_tiers
                ],
            },
        )


@product_router.post("/create")
async def create_product(req: Request, body: InputProduct):
    """Crear producto. Solo ADMIN."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    try:
        async with AsyncSessionLocal() as session:
            p = Product(
                name=body.name,
                price=body.price,
                weight=body.weight,
                fixed_weight=body.fixed_weight,
                brand=body.brand,
                category=body.category,
                has_tiered_pricing=body.has_tiered_pricing,
                img=body.img,
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
                p.brand = body.brand
            if body.category is not None:
                p.category = body.category
            if body.has_tiered_pricing is not None:
                p.has_tiered_pricing = body.has_tiered_pricing
            if body.img is not None:
                p.img = body.img
            if body.active is not None:
                p.active = body.active

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
        p.active = False
        await session.commit()
        return JSONResponse(status_code=200, content={"message": "Producto desactivado"})
