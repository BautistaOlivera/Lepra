"""
Hace nullable order_products.weight para permitir líneas sin pesar.

Uso: python scripts/migrate_order_weight_nullable.py
"""

import os
import sys

from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.db import engine


def main():
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                ALTER TABLE IF EXISTS order_products
                ALTER COLUMN weight DROP NOT NULL;
                """
            )
        )

    print("Migración OK: order_products.weight es nullable.")


if __name__ == "__main__":
    main()
