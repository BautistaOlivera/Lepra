"""Dicts JSON de proveedores y abastecimientos (API y sync)."""
from __future__ import annotations

from utils.datetime_api import utc_naive_iso
from services.purchase_totals import line_amount


def supplier_dict(supplier) -> dict:
    return {
        "id": supplier.id,
        "name": supplier.name,
        "active": bool(supplier.active),
        "updated_at": utc_naive_iso(supplier.updated_at),
    }


def purchase_line_dict(line) -> dict:
    product = getattr(line, "product", None)
    weight = float(line.weight or 0)
    price = float(line.price_per_kg or 0)
    return {
        "id": line.id,
        "id_product": line.id_product,
        "product_name": product.name if product is not None else None,
        "product_brand": product.brand if product is not None else None,
        "weight": weight,
        "price_per_kg": price,
        "amount": line_amount(weight, price),
    }


def purchase_dict(purchase) -> dict:
    supplier = getattr(purchase, "supplier", None)
    return {
        "id": purchase.id,
        "id_supplier": purchase.id_supplier,
        "supplier_name": supplier.name if supplier is not None else None,
        "date": purchase.date.isoformat() if purchase.date else None,
        "unitemized_amount": float(purchase.unitemized_amount or 0),
        "total": float(purchase.total or 0),
        "note": (purchase.note or "").strip() or None,
        "active": bool(purchase.active),
        "created_at": utc_naive_iso(purchase.created_at),
        "updated_at": utc_naive_iso(purchase.updated_at),
        "lines": [purchase_line_dict(line) for line in (purchase.lines or [])],
    }
