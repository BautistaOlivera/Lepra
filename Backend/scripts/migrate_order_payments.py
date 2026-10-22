"""
Crea tabla order_payments si falta.

Uso: python scripts/migrate_order_payments.py

El mismo sync corre al arrancar la API. Este script queda por si hace
falta aplicarlo a mano.
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
