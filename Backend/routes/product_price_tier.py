from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
import traceback

from models.product_price_tier import (
    ProductPriceTier,
    InputProductPriceTier,
    InputProductPriceTierUpdate,
)
from config.db import AsyncSessionLocal
from auth.roles import require_roles

tier_router = APIRouter(prefix="/product-price-tier", tags=["ProductPriceTier"])


@tier_router.post("/create")
async def create_tier(req: Request, body: InputProductPriceTier):
    """Crear precio por volumen. Solo ADMIN."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    try:
        async with AsyncSessionLocal() as session:
            t = ProductPriceTier(
                id_product=body.id_product,
                min_quantity=body.min_quantity,
                unit_price=body.unit_price,
            )
            session.add(t)
            await session.commit()
            await session.refresh(t)
            return JSONResponse(status_code=201, content={"message": "Precio por volumen creado", "id": t.id})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"message": "Error al crear precio por volumen"})


@tier_router.put("/update")
async def update_tier(req: Request, body: InputProductPriceTierUpdate):
    """Actualizar precio por volumen. Solo ADMIN."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    try:
        async with AsyncSessionLocal() as session:
            stmt = select(ProductPriceTier).where(ProductPriceTier.id == body.id)
            result = await session.execute(stmt)
            t = result.scalar_one_or_none()
            if not t:
                return JSONResponse(status_code=404, content={"message": "Precio por volumen no encontrado"})
            if body.min_quantity is not None:
                t.min_quantity = body.min_quantity
            if body.unit_price is not None:
                t.unit_price = body.unit_price
            await session.commit()
            return JSONResponse(status_code=200, content={"message": "Precio por volumen actualizado"})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"message": "Error al actualizar precio por volumen"})


@tier_router.delete("/{tier_id}")
async def delete_tier(req: Request, tier_id: int):
    """Eliminar precio por volumen (borrado físico). Solo ADMIN."""
    payload = require_roles(req.headers, ["ADMIN"])
    if isinstance(payload, JSONResponse):
        return payload

    async with AsyncSessionLocal() as session:
        stmt = select(ProductPriceTier).where(ProductPriceTier.id == tier_id)
        result = await session.execute(stmt)
        t = result.scalar_one_or_none()
        if not t:
            return JSONResponse(status_code=404, content={"message": "Precio por volumen no encontrado"})
        await session.delete(t)
        await session.commit()
        return JSONResponse(status_code=200, content={"message": "Precio por volumen eliminado"})
