"""
Crear usuario admin inicial.
admin@lepra.local / admin123

Ejecutar desde Backend: python scripts/create_admin.py
"""

import sys
import os

# Permitir imports del proyecto
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from models.user import User
from config.db import SessionLocal
from auth.security import hash_password

ADMIN_EMAIL = "admin@lepra.local"
ADMIN_PASSWORD = "admin123"
ADMIN_NAME = "Admin"


def main():
    session = SessionLocal()
    try:
        result = session.execute(select(User).where(User.email == ADMIN_EMAIL))
        existing = result.scalar_one_or_none()
        if existing:
            print(f"El usuario {ADMIN_EMAIL} ya existe.")
            return

        admin = User(
            email=ADMIN_EMAIL,
            name=ADMIN_NAME,
            password=hash_password(ADMIN_PASSWORD),
            rol="ADMIN",
            active=True,
        )
        session.add(admin)
        session.commit()
        print(f"Usuario admin creado: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    except Exception as e:
        session.rollback()
        print(f"Error: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
