"""
Borra todos los datos de la base y deja solo el usuario admin.

Por defecto: admin@lepra.local / admin123 (o ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME en .env)

Uso (desde Backend/):
  python scripts/reset_db.py --yes

Requiere PostgreSQL y DATABASE_URL (o DB_*) en .env.
"""

import argparse
import os
import sys

from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.db import Base, engine, SessionLocal
from models.user import User
from auth.security import hash_password
from sqlalchemy import select

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@lepra.local")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
ADMIN_NAME = os.getenv("ADMIN_NAME", "Admin")

TABLES = (
    "order_products",
    "orders",
    "product_price_tiers",
    "products",
    "users",
)


def truncate_all(conn) -> None:
    quoted = ", ".join(f'"{t}"' for t in TABLES)
    conn.execute(text(f"TRUNCATE TABLE {quoted} RESTART IDENTITY CASCADE"))


def create_admin(session) -> User:
    admin = User(
        email=ADMIN_EMAIL,
        name=ADMIN_NAME,
        password=hash_password(ADMIN_PASSWORD),
        rol="ADMIN",
        active=True,
    )
    session.add(admin)
    session.commit()
    session.refresh(admin)
    return admin


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset DB: solo usuario admin")
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Confirmar borrado total (obligatorio)",
    )
    args = parser.parse_args()
    if not args.yes:
        print("⚠️  Esto borra TODOS los pedidos, productos, clientes y volúmenes.")
        print("    Para continuar: python scripts/reset_db.py --yes")
        sys.exit(1)

    # Asegurar tablas existentes (nuevas columnas vía migraciones aparte)
    Base.metadata.create_all(bind=engine)

    with engine.begin() as conn:
        truncate_all(conn)

    session = SessionLocal()
    try:
        admin = create_admin(session)
        print("Base de datos reseteada.")
        print(f"  Admin: {admin.email} / {ADMIN_PASSWORD}")
        print(f"  id: {admin.id}")
        print("\nSi usás el panel admin en el navegador, borrá también los datos locales:")
        print("  DevTools → Application → IndexedDB → lepra → Delete database")
    except Exception as e:
        session.rollback()
        print(f"Error: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
