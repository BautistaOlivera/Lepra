"""Alinea tablas ya existentes con los modelos.

create_all crea tablas que faltan y no agrega columnas ni renombra.
Estas sentencias son las de scripts/migrate_*.py, idempotentes, y corren
en cada arranque de la API (el restart del deploy alcanza).
"""
from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger("lepra.schema")


def _column_exists(conn, table: str, column: str) -> bool:
    row = conn.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = :table
              AND column_name = :column
            """
        ),
        {"table": table, "column": column},
    ).scalar()
    return row is not None


def _apply_kg_pricing(conn) -> None:
    """Renombra el esquema viejo (cantidad / precio unitario) a precio por kg.

    No vuelve a poner weight en NOT NULL: el modelo lo deja nullable.
    """
    if not _column_exists(conn, "products", "fixed_weight"):
        conn.execute(
            text(
                """
                ALTER TABLE products
                ADD COLUMN fixed_weight BOOLEAN NOT NULL DEFAULT FALSE
                """
            )
        )

    if _column_exists(conn, "product_price_tiers", "min_quantity"):
        conn.execute(text("ALTER TABLE product_price_tiers RENAME COLUMN min_quantity TO min_kg"))
        conn.execute(
            text(
                """
                ALTER TABLE product_price_tiers
                ALTER COLUMN min_kg TYPE DOUBLE PRECISION
                USING min_kg::double precision
                """
            )
        )
    if _column_exists(conn, "product_price_tiers", "unit_price"):
        conn.execute(text("ALTER TABLE product_price_tiers RENAME COLUMN unit_price TO price_per_kg"))

    if _column_exists(conn, "order_products", "quantity"):
        conn.execute(text("ALTER TABLE order_products DROP COLUMN quantity"))
    if _column_exists(conn, "order_products", "unit_price"):
        conn.execute(text("ALTER TABLE order_products RENAME COLUMN unit_price TO price_per_kg"))


def _apply_product_status(conn) -> None:
    """Pasa active + in_stock a status. El backfill corre una sola vez.

    Si se repitiera con in_stock ya borrado, un producto sin_stock
    (active = true) volvería a active.
    """
    had_status = _column_exists(conn, "products", "status")
    had_in_stock = _column_exists(conn, "products", "in_stock")
    had_active = _column_exists(conn, "products", "active")

    if not had_status:
        conn.execute(
            text(
                """
                ALTER TABLE products
                ADD COLUMN status VARCHAR NOT NULL DEFAULT 'active'
                """
            )
        )

    if had_active and (not had_status or had_in_stock):
        if had_in_stock:
            conn.execute(
                text(
                    """
                    UPDATE products SET status = CASE
                      WHEN active = FALSE THEN 'inactive'
                      WHEN in_stock = FALSE THEN 'sin_stock'
                      ELSE 'active'
                    END
                    """
                )
            )
        else:
            conn.execute(
                text(
                    """
                    UPDATE products SET status = CASE
                      WHEN active = FALSE THEN 'inactive'
                      ELSE 'active'
                    END
                    """
                )
            )
        conn.execute(text("UPDATE products SET active = (status <> 'inactive')"))

    if had_in_stock:
        conn.execute(text("ALTER TABLE products DROP COLUMN in_stock"))


def _apply_additive(conn) -> None:
    stmts = [
        """
        ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL
        DEFAULT (NOW() AT TIME ZONE 'UTC')
        """,
        """
        UPDATE users
        SET updated_at = (NOW() AT TIME ZONE 'UTC')
        WHERE updated_at IS NULL
        """,
        """
        ALTER TABLE IF EXISTS products
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL
        DEFAULT (NOW() AT TIME ZONE 'UTC')
        """,
        """
        UPDATE products
        SET updated_at = (NOW() AT TIME ZONE 'UTC')
        WHERE updated_at IS NULL
        """,
        """
        ALTER TABLE IF EXISTS orders
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL
        DEFAULT (NOW() AT TIME ZONE 'UTC')
        """,
        """
        UPDATE orders
        SET updated_at = COALESCE(created_at, (NOW() AT TIME ZONE 'UTC'))
        WHERE updated_at IS NULL
        """,
        """
        ALTER TABLE IF EXISTS orders
        ADD COLUMN IF NOT EXISTS customer_name VARCHAR NULL
        """,
        """
        ALTER TABLE IF EXISTS orders
        ADD COLUMN IF NOT EXISTS extra_amount DOUBLE PRECISION NOT NULL DEFAULT 0
        """,
        """
        ALTER TABLE IF EXISTS orders
        ADD COLUMN IF NOT EXISTS extra_note VARCHAR NULL
        """,
        """
        CREATE TABLE IF NOT EXISTS order_payments (
            id SERIAL PRIMARY KEY,
            id_order INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            amount DOUBLE PRECISION NOT NULL,
            method VARCHAR NOT NULL,
            paid_at DATE NOT NULL,
            note VARCHAR NULL,
            created_at TIMESTAMP WITHOUT TIME ZONE
        )
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_order_payments_id_order
        ON order_payments (id_order)
        """,
    ]
    for stmt in stmts:
        conn.execute(text(stmt))

    if _column_exists(conn, "orders", "id_user"):
        conn.execute(text("ALTER TABLE orders ALTER COLUMN id_user DROP NOT NULL"))
    if _column_exists(conn, "order_products", "weight"):
        conn.execute(text("ALTER TABLE order_products ALTER COLUMN weight DROP NOT NULL"))


def ensure_schema_sync(engine) -> None:
    """Crea tablas faltantes y aplica los ALTER pendientes. Idempotente."""
    from config.db import Base
    import models  # noqa: F401  (registra las tablas en Base.metadata)

    Base.metadata.create_all(bind=engine)
    try:
        with engine.begin() as conn:
            _apply_additive(conn)
            _apply_kg_pricing(conn)
            _apply_product_status(conn)
    except Exception:
        logger.exception("Schema sync falló")
        raise
    print("Schema sync OK.")
