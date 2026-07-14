"""Normalización de marca de producto (evitar duplicados por mayúsculas/espacios)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Product


def normalize_brand_key(brand: str | None) -> str:
    """Clave comparable (trim + lower)."""
    return (brand or "").strip().lower()


async def resolve_canonical_brand(session: AsyncSession, brand: str | None) -> str | None:
    """
    Devuelve la marca a guardar:
    - None si viene vacía
    - Si ya existe otra igual ignorando mayúsculas, reutiliza esa capitalización
    - Si no, trim del valor nuevo
    """
    trimmed = (brand or "").strip()
    if not trimmed:
        return None

    key = normalize_brand_key(trimmed)
    stmt = (
        select(Product.brand)
        .where(Product.brand.is_not(None))
        .where(func.length(func.trim(Product.brand)) > 0)
        .where(func.lower(func.trim(Product.brand)) == key)
        .order_by(Product.id.asc())
        .limit(1)
    )
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing is not None:
        canon = str(existing).strip()
        if canon:
            return canon
    return trimmed
