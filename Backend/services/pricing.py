"""Precio por kg o por pieza según product.fixed_weight."""
from __future__ import annotations

from typing import Optional

from models.product import Product


def _piece_count(product: Product, weight_kg: float) -> float:
    piece = float(product.weight or 0)
    if piece <= 0:
        return 0.0
    return float(weight_kg) / piece


def price_per_kg_for_weight(product: Product, weight_kg: float) -> float:
    """Precio por kg (solo productos vendidos por peso)."""
    if weight_kg <= 0:
        return float(product.price)
    if not product.has_tiered_pricing or not product.price_tiers:
        return float(product.price)
    best = None
    for tier in product.price_tiers:
        if weight_kg >= float(tier.min_kg) and (best is None or tier.min_kg > best.min_kg):
            best = tier
    return float(best.price_per_kg) if best else float(product.price)


def price_per_piece_for_weight(product: Product, weight_kg: float) -> float:
    """Precio por pieza (productos fixed_weight). Tier min_kg = cantidad mínima de piezas."""
    if not product.has_tiered_pricing or not product.price_tiers:
        return float(product.price)
    pieces = _piece_count(product, weight_kg)
    best = None
    for tier in product.price_tiers:
        if pieces >= float(tier.min_kg) and (best is None or tier.min_kg > best.min_kg):
            best = tier
    return float(best.price_per_kg) if best else float(product.price)


def unit_price_for_line(product: Product, weight_kg: float) -> float:
    """Precio unitario de la línea: $/kg o $/pieza según el producto."""
    if product.fixed_weight:
        return price_per_piece_for_weight(product, weight_kg)
    return price_per_kg_for_weight(product, weight_kg)


def line_total(product: Product, weight_kg: float, unit_price: float) -> float:
    if product.fixed_weight:
        return round(_piece_count(product, weight_kg) * float(unit_price), 2)
    return round(float(weight_kg) * float(unit_price), 2)


def validate_line_weight(product: Product, weight_kg: float) -> Optional[str]:
    if weight_kg <= 0:
        return "El peso debe ser mayor a 0"
    if product.fixed_weight:
        piece = product.weight
        if piece is None or piece <= 0:
            return "Producto con peso fijo mal configurado (falta peso por pieza)"
        pieces = weight_kg / float(piece)
        if abs(pieces - round(pieces)) > 0.001:
            return f"El peso debe ser múltiplo de {piece} kg"
    return None
