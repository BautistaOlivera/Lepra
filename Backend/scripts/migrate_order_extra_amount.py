"""
Agrega extra_amount y extra_note en orders.

Uso: python scripts/migrate_order_extra_amount.py

El mismo sync corre al arrancar la API.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.db import engine
from services.schema_migrate import ensure_schema_sync


def main():
    ensure_schema_sync(engine)


if __name__ == "__main__":
    main()
