"""
Agrega updated_at a users, products y orders.

Uso: python scripts/migrate_add_updated_at.py

El mismo sync corre al arrancar la API.
Pensado para PostgreSQL.
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
