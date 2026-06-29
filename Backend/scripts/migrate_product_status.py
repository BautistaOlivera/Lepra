"""
Estado único de producto: active | sin_stock | inactive (reemplaza active + in_stock).

Uso: python scripts/migrate_product_status.py
"""

import os
import sys

from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.db import engine


def main():
    stmts = [
        """
        ALTER TABLE IF EXISTS products
        ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'active';
        """,
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'products' AND column_name = 'in_stock'
          ) THEN
            UPDATE products SET status = CASE
              WHEN active = FALSE THEN 'inactive'
              WHEN in_stock = FALSE THEN 'sin_stock'
              ELSE 'active'
            END;
          ELSE
            UPDATE products SET status = CASE
              WHEN active = FALSE THEN 'inactive'
              ELSE 'active'
            END;
          END IF;
        END $$;
        """,
        "UPDATE products SET active = (status <> 'inactive');",
        "ALTER TABLE IF EXISTS products DROP COLUMN IF EXISTS in_stock;",
    ]
    with engine.begin() as conn:
        for s in stmts:
            conn.execute(text(s))
    print("Migración OK: products.status (active | sin_stock | inactive).")


if __name__ == "__main__":
    main()
