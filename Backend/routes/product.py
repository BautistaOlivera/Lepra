from fastapi import APIRouter, Request, File, UploadFile
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

product_router = APIRouter(prefix="/product", tags=["Product"])

# Carpeta donde se guardan las imágenes subidas (relativa al directorio del backend)
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
ALLOWED_EXTENSIONS = {"image/jpeg", "image/png", "image/gif", "image/webp"}


@product_router.post("/upload")
async def upload_image(req: Request, file: UploadFile = File(...)):
    """Subir imagen de producto. Solo ADMIN. Devuelve la URL relativa para guardar en img."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    if file.content_type not in ALLOWED_EXTENSIONS:
        return JSONResponse(
            status_code=400,
            content={"message": "Tipo de archivo no permitido. Use JPEG, PNG, GIF o WebP."},
        )

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = ".jpg"
    if file.content_type == "image/png":
        ext = ".png"
    elif file.content_type == "image/gif":
        ext = ".gif"
    elif file.content_type == "image/webp":
        ext = ".webp"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    try:
        content = await file.read()
        if len(content) > 5 * 1024 * 1024:  # 5 MB max
            return JSONResponse(status_code=400, content={"message": "La imagen no debe superar 5 MB"})
        with open(filepath, "wb") as f:
            f.write(content)
        url = f"/uploads/{filename}"
        return JSONResponse(status_code=200, content={"url": url})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"message": "Error al guardar la imagen"})


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
                "brand": p.brand,
                "category": p.category,
                "has_tiered_pricing": p.has_tiered_pricing,
                "img": p.img,
                "active": p.active,
                "price_tiers": [
                    {"id": t.id, "min_quantity": t.min_quantity, "unit_price": t.unit_price}
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
                "brand": p.brand,
                "category": p.category,
                "has_tiered_pricing": p.has_tiered_pricing,
                "img": p.img,
                "active": p.active,
                "price_tiers": [
                    {"id": t.id, "min_quantity": t.min_quantity, "unit_price": t.unit_price}
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
