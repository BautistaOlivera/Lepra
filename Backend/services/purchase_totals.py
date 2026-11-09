"""Total de un abastecimiento: líneas opcionales + importe sin detallar.

No consulta ni modifica el precio de venta ni el estado de stock del producto.
El precio de cada línea es el de compra, tipeado en el abastecimiento.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class PurchaseLineIn:
    id_product: int
    weight: float
    price_per_kg: float


def line_amount(weight: float, price_per_kg: float) -> float:
    return round(float(weight) * float(price_per_kg), 2)


def compute_purchase_total(lines: list[tuple[float, float]], unitemized_amount: float) -> float:
    summed = sum(line_amount(weight, price) for weight, price in lines)
    return round(summed + float(unitemized_amount), 2)


def validate_purchase_draft(lines: list[PurchaseLineIn], unitemized_amount: float) -> Optional[str]:
    if unitemized_amount < 0:
        return "El importe sin detallar no puede ser negativo"
    if not lines and unitemized_amount <= 0:
        return "Indicá un importe o al menos un producto"
    for index, line in enumerate(lines, start=1):
        if line.id_product <= 0:
            return f"Elegí un producto en la línea {index}"
        if line.weight <= 0:
            return f"Los kilos de la línea {index} deben ser mayores a 0"
        if line.price_per_kg < 0:
            return f"El precio de compra de la línea {index} no puede ser negativo"
    return None


def apply_purchase_lines(
    products_by_id: dict[int, Any],
    lines: list[PurchaseLineIn],
) -> tuple[list[dict], Optional[str]]:
    """Arma las líneas si el producto existe. No lee ni escribe price ni status."""
    built: list[dict] = []
    for line in lines:
        if products_by_id.get(line.id_product) is None:
            return [], f"Producto id {line.id_product} no encontrado"
        built.append(
            {
                "id_product": line.id_product,
                "weight": float(line.weight),
                "price_per_kg": float(line.price_per_kg),
                "amount": line_amount(line.weight, line.price_per_kg),
            }
        )
    return built, None
