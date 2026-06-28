"""
Migración: columna opcional weight (DOUBLE PRECISION) en products.

Si existe la columna legacy `peso`, la renombra a `weight`.

Uso (desde Backend/):
  python scripts/migrate_add_weight.py

Requiere DATABASE_URL (o DB_*) en .env. PostgreSQL.
"""

import os
import sys

from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.db import engine


def main() -> None:
    stmts = [
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'products'
              AND column_name = 'peso'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'products'
              AND column_name = 'weight'
          ) THEN
            ALTER TABLE products RENAME COLUMN peso TO weight;
          END IF;
        END $$;
        """,
        """
        ALTER TABLE IF EXISTS products
        ADD COLUMN IF NOT EXISTS weight DOUBLE PRECISION;
        """,
    ]
    with engine.begin() as conn:
        for stmt in stmts:
            conn.execute(text(stmt))
    print("Migración OK: products.weight lista (nullable).")


if __name__ == "__main__":
    main()
