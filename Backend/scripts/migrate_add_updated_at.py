"""
Migración simple (sin Alembic) para agregar updated_at a tablas existentes.

Uso:
  - Local: DATABASE_URL=... python scripts/migrate_add_updated_at.py
  - Render Shell: python scripts/migrate_add_updated_at.py

NOTA: Este script está pensado para PostgreSQL.
"""

import sys
import os
from sqlalchemy import text

# Permitir imports del proyecto
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.db import engine


def main():
    stmts = [
        # users
        """
        ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC');
        """,
        "UPDATE users SET updated_at = (NOW() AT TIME ZONE 'UTC') WHERE updated_at IS NULL;",
        # products
        """
        ALTER TABLE IF EXISTS products
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC');
        """,
        "UPDATE products SET updated_at = (NOW() AT TIME ZONE 'UTC') WHERE updated_at IS NULL;",
        # orders
        """
        ALTER TABLE IF EXISTS orders
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC');
        """,
        "UPDATE orders SET updated_at = COALESCE(created_at, (NOW() AT TIME ZONE 'UTC')) WHERE updated_at IS NULL;",
    ]

    with engine.begin() as conn:
        for s in stmts:
            conn.execute(text(s))

    print("Migración OK: updated_at agregado/actualizado.")


if __name__ == "__main__":
    main()

