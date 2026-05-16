"""
Crear usuario cliente de prueba.

Por defecto: cliente.prueba@lepra.local / Cliente123
Variables opcionales: TEST_CLIENT_EMAIL, TEST_CLIENT_PASSWORD, TEST_CLIENT_NAME

Ejecutar desde Backend: python scripts/create_test_client.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select

from auth.security import hash_password
from config.db import SessionLocal
from models.user import User

TEST_CLIENT_EMAIL = os.getenv("TEST_CLIENT_EMAIL", "cliente.prueba@lepra.local")
TEST_CLIENT_PASSWORD = os.getenv("TEST_CLIENT_PASSWORD", "Cliente123")
TEST_CLIENT_NAME = os.getenv("TEST_CLIENT_NAME", "Cliente Prueba")
TEST_CLIENT_LOCATION = os.getenv("TEST_CLIENT_LOCATION", "Buenos Aires")


def main():
    session = SessionLocal()
    try:
        result = session.execute(select(User).where(User.email == TEST_CLIENT_EMAIL))
        existing = result.scalar_one_or_none()
        if existing:
            print(f"El usuario {TEST_CLIENT_EMAIL} ya existe (rol={existing.rol}, active={existing.active}).")
            print(f"Login: {TEST_CLIENT_EMAIL} / {TEST_CLIENT_PASSWORD}")
            return

        client = User(
            email=TEST_CLIENT_EMAIL,
            name=TEST_CLIENT_NAME,
            password=hash_password(TEST_CLIENT_PASSWORD),
            location=TEST_CLIENT_LOCATION,
            rol="CLIENT",
            active=True,
        )
        session.add(client)
        session.commit()
        print("Usuario cliente de prueba creado.")
        print(f"Email: {TEST_CLIENT_EMAIL}")
        print(f"Contraseña: {TEST_CLIENT_PASSWORD}")
    except Exception as e:
        session.rollback()
        print(f"Error: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
