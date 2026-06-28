"""
Migración: columna opcional weight en order_products.

Uso (desde Backend/):
  python scripts/migrate_add_order_line_weight.py

Requiere DATABASE_URL (o DB_*) en .env. PostgreSQL.
"""

import os
import sys

from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.db import engine


def main() -> None:
    stmt = """
    ALTER TABLE IF EXISTS order_products
    ADD COLUMN IF NOT EXISTS weight DOUBLE PRECISION;
    """
    with engine.begin() as conn:
        conn.execute(text(stmt))
    print("Migración OK: order_products.weight agregada (nullable).")


if __name__ == "__main__":
    main()
