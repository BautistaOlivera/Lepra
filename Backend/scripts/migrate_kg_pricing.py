"""Migración a precio por kg: renombra columnas y elimina quantity de order_products.

Uso: python scripts/migrate_kg_pricing.py

El mismo sync corre al arrancar la API.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.db import engine
from services.schema_migrate import ensure_schema_sync


def main() -> None:
    ensure_schema_sync(engine)


if __name__ == "__main__":
    main()
