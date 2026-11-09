"""Carga inicial de proveedores. Si ya hay filas, no inserta nada."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import text

SEED_SUPPLIER_NAMES = (
    "Frigoríficos",
    "Doroni",
    "Natali",
    "Quesos",
    "La Crespense",
    "Delicia",
    "Pantera",
    "Quesos de campo",
    "Silvio Stelle",
    "Fabián Paul",
    "Cristian Heit",
    "Dario",
    "Javier Vergara",
)


def seed_suppliers_if_empty(conn) -> int:
    count = conn.execute(text("SELECT COUNT(*) FROM suppliers")).scalar() or 0
    if int(count) > 0:
        return 0
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for name in SEED_SUPPLIER_NAMES:
        conn.execute(
            text(
                """
                INSERT INTO suppliers (name, active, updated_at)
                VALUES (:name, :active, :updated_at)
                """
            ),
            {"name": name, "active": True, "updated_at": now},
        )
    return len(SEED_SUPPLIER_NAMES)
