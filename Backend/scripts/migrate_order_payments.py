"""
Crea tabla order_payments (historial de cobros parciales por pedido).

Uso: python scripts/migrate_order_payments.py
"""

import os
import sys

from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.db import engine


def main():
    stmts = [
        """
        CREATE TABLE IF NOT EXISTS order_payments (
            id SERIAL PRIMARY KEY,
            id_order INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            amount DOUBLE PRECISION NOT NULL,
            method VARCHAR NOT NULL,
            paid_at DATE NOT NULL,
            note VARCHAR NULL,
            created_at TIMESTAMP WITHOUT TIME ZONE
        );
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_order_payments_id_order
        ON order_payments (id_order);
        """,
    ]

    with engine.begin() as conn:
        for s in stmts:
            conn.execute(text(s))

    print("Migración OK: order_payments.")


if __name__ == "__main__":
    main()
