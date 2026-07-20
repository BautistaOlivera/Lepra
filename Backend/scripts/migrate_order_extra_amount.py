"""
Agrega extra_amount y extra_note en orders (cargo puntual fuera de catálogo).

Uso: python scripts/migrate_order_extra_amount.py
"""

import os
import sys

from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.db import engine


def main():
    stmts = [
        """
        ALTER TABLE IF EXISTS orders
        ADD COLUMN IF NOT EXISTS extra_amount DOUBLE PRECISION NOT NULL DEFAULT 0;
        """,
        """
        ALTER TABLE IF EXISTS orders
        ADD COLUMN IF NOT EXISTS extra_note VARCHAR NULL;
        """,
    ]

    with engine.begin() as conn:
        for s in stmts:
            conn.execute(text(s))

    print("Migración OK: orders.extra_amount y orders.extra_note.")


if __name__ == "__main__":
    main()
