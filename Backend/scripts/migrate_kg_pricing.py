"""Migración a precio por kg: renombra columnas y elimina quantity de order_products."""
import os
import sys

from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.db import engine


def column_exists(conn, table: str, column: str) -> bool:
    r = conn.execute(
        text(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_name = :table AND column_name = :column
            """
        ),
        {"table": table, "column": column},
    )
    return r.scalar_one_or_none() is not None


def main() -> None:
    with engine.begin() as conn:
        if column_exists(conn, "products", "fixed_weight"):
            print("Migración kg ya aplicada.")
            return

        print("Aplicando migración precio por kg...")

        conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS fixed_weight BOOLEAN NOT NULL DEFAULT FALSE"))

        if column_exists(conn, "product_price_tiers", "min_quantity"):
            conn.execute(text("ALTER TABLE product_price_tiers RENAME COLUMN min_quantity TO min_kg"))
            conn.execute(text("ALTER TABLE product_price_tiers ALTER COLUMN min_kg TYPE DOUBLE PRECISION USING min_kg::double precision"))
        if column_exists(conn, "product_price_tiers", "unit_price"):
            conn.execute(text("ALTER TABLE product_price_tiers RENAME COLUMN unit_price TO price_per_kg"))

        if column_exists(conn, "order_products", "quantity"):
            conn.execute(text("ALTER TABLE order_products DROP COLUMN quantity"))
        if column_exists(conn, "order_products", "unit_price"):
            conn.execute(text("ALTER TABLE order_products RENAME COLUMN unit_price TO price_per_kg"))
        if column_exists(conn, "order_products", "weight"):
            conn.execute(text("ALTER TABLE order_products ALTER COLUMN weight SET NOT NULL"))

        print("Migración completada.")


if __name__ == "__main__":
    main()
