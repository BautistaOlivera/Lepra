"""
Crea la base de datos lepra en PostgreSQL local (si no existe).

Uso (desde Backend/):
  .\\venv\\Scripts\\python.exe scripts\\create_db.py

Lee DATABASE_URL o DB_* del .env (misma config que la API).
"""

import os
import sys

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from dotenv import load_dotenv
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DB_NAME = os.getenv("DB_NAME", "lepra")


def parse_url(url: str) -> dict:
    # postgresql://user:pass@host:port/dbname
    from urllib.parse import urlparse

    p = urlparse(url)
    return {
        "user": p.username or "postgres",
        "password": p.password or "",
        "host": p.hostname or "localhost",
        "port": p.port or 5432,
        "dbname": (p.path or "/postgres").lstrip("/") or "postgres",
    }


def main() -> None:
    url = os.getenv("INTERNAL_DATABASE_URL") or os.getenv("DATABASE_URL")
    if url:
        cfg = parse_url(url)
        user, password, host, port = cfg["user"], cfg["password"], cfg["host"], cfg["port"]
    else:
        user = os.getenv("DB_USER", "postgres")
        password = os.getenv("DB_PASSWORD", "123")
        host = os.getenv("DB_HOST", "localhost")
        port = int(os.getenv("DB_PORT", "5432"))

    conn = psycopg2.connect(
        dbname="postgres",
        user=user,
        password=password,
        host=host,
        port=port,
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (DB_NAME,))
    if cur.fetchone():
        print(f"La base '{DB_NAME}' ya existe.")
    else:
        cur.execute(f'CREATE DATABASE "{DB_NAME}"')
        print(f"Base '{DB_NAME}' creada.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
