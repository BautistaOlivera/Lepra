"""
Estado único de producto: active | sin_stock | inactive.

Uso: python scripts/migrate_product_status.py

El mismo sync corre al arrancar la API. El pasaje desde in_stock
se hace una sola vez, para no pisar un sin_stock ya guardado.
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
