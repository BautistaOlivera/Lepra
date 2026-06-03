"""
Agrega customer_name y permite id_user NULL en orders (pedidos sin cliente registrado).

Uso: python scripts/migrate_order_customer_name.py
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
        ADD COLUMN IF NOT EXISTS customer_name VARCHAR NULL;
        """,
        """
        ALTER TABLE IF EXISTS orders
        ALTER COLUMN id_user DROP NOT NULL;
        """,
    ]

    with engine.begin() as conn:
        for s in stmts:
            conn.execute(text(s))

    print("Migración OK: orders.customer_name e id_user nullable.")


if __name__ == "__main__":
    main()
