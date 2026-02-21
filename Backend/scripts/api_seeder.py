"""
Seeder/Test script para la API Lepra.
Replica las llamadas de Lepra_API.postman_collection.json.

Requisitos:
  - Servidor corriendo en http://localhost:8000
  - Usuario admin existente: admin@lepra.local / admin123

Uso: python scripts/api_seeder.py
"""

import json
import sys
from typing import Optional

try:
    import requests
except ImportError:
    print("Instalar: pip install requests")
    sys.exit(1)

BASE_URL = "http://localhost:8000"
TOKEN: Optional[str] = None

# IDs que vamos creando (para usar en requests dependientes)
created_user_id: Optional[int] = None
created_product_id: Optional[int] = None
created_product2_id: Optional[int] = None
created_order_id: Optional[int] = None
created_tier_id: Optional[int] = None


def headers(auth: bool = False) -> dict:
    h = {"Content-Type": "application/json"}
    if auth and TOKEN:
        h["Authorization"] = f"Bearer {TOKEN}"
    return h


def log(name: str, resp, extra: str = ""):
    status = resp.status_code
    ok = "✓" if 200 <= status < 300 else "✗"
    print(f"  {ok} {name} [{status}] {extra}".strip())
    if status >= 400:
        try:
            print(f"      -> {resp.json()}")
        except Exception:
            print(f"      -> {resp.text[:200]}")


# --- Auth ---

def auth_signup():
    r = requests.post(
        f"{BASE_URL}/auth/signup",
        headers=headers(),
        json={
            "email": "nuevo@lepra.local",
            "password": "clave123",
            "name": "Nuevo Usuario",
            "rol": "CLIENT",
        },
    )
    log("Auth Signup", r)
    return r


def auth_login():
    global TOKEN
    r = requests.post(
        f"{BASE_URL}/auth/login",
        headers=headers(),
        json={"email": "admin@lepra.local", "password": "admin123"},
    )
    log("Auth Login (guarda token)", r)
    if r.status_code == 200:
        TOKEN = r.json().get("access_token")
    return r


def auth_me():
    r = requests.get(f"{BASE_URL}/auth/me", headers=headers(auth=True))
    log("Auth Me (usuario actual)", r)
    return r


# --- User ---

def user_paginated():
    r = requests.post(
        f"{BASE_URL}/user/paginated",
        headers=headers(auth=True),
        json={"limit": 20, "filters": {"rol": "CLIENT"}},
    )
    log("User Users paginated", r)
    return r


def user_get_by_id(user_id: int = 1):
    r = requests.get(f"{BASE_URL}/user/{user_id}", headers=headers(auth=True))
    log(f"User Get by id {user_id}", r)
    return r


def user_create():
    global created_user_id
    r = requests.post(
        f"{BASE_URL}/user/create",
        headers=headers(auth=True),
        json={
            "email": "otro@lepra.local",
            "password": "clave123",
            "name": "Otro Cliente",
            "rol": "CLIENT",
        },
    )
    log("User Create", r)
    if r.status_code == 201:
        created_user_id = r.json().get("user", {}).get("id")
    return r


def user_update(user_id: int = 2):
    r = requests.put(
        f"{BASE_URL}/user/update",
        headers=headers(auth=True),
        json={"id": user_id, "name": "Nombre actualizado"},
    )
    log(f"User Update id={user_id}", r)
    return r


def user_deactivate(user_id: int = 2):
    r = requests.put(
        f"{BASE_URL}/user/{user_id}/deactivate",
        headers=headers(auth=True),
    )
    log(f"User Deactivate id={user_id}", r)
    return r


# --- Product ---

def product_paginated():
    r = requests.post(
        f"{BASE_URL}/product/paginated",
        headers=headers(),
        json={"limit": 20, "filters": {}},
    )
    log("Product Products paginated (público)", r)
    return r


def product_get_by_id(product_id: int = 1):
    r = requests.get(f"{BASE_URL}/product/{product_id}", headers=headers())
    log(f"Product Get by id {product_id}", r)
    return r


def product_create():
    global created_product_id
    r = requests.post(
        f"{BASE_URL}/product/create",
        headers=headers(auth=True),
        json={
            "name": "Nuevo producto",
            "price": 5.5,
            "brand": "Marca",
            "category": "Lácteos",
            "has_tiered_pricing": False,
        },
    )
    log("Product Create", r)
    if r.status_code == 201:
        created_product_id = r.json().get("id")
    return r


def product_update(product_id: int = 1):
    r = requests.put(
        f"{BASE_URL}/product/update",
        headers=headers(auth=True),
        json={"id": product_id, "price": 3.0},
    )
    log(f"Product Update id={product_id}", r)
    return r


def product_deactivate(product_id: int = 1):
    r = requests.put(
        f"{BASE_URL}/product/{product_id}/deactivate",
        headers=headers(auth=True),
    )
    log(f"Product Deactivate id={product_id}", r)
    return r


# --- Precio por volumen ---

def tier_create(product_id: int = 2):
    global created_tier_id
    r = requests.post(
        f"{BASE_URL}/product-price-tier/create",
        headers=headers(auth=True),
        json={"id_product": product_id, "min_quantity": 10, "unit_price": 7.0},
    )
    log("Precio por volumen Crear", r)
    if r.status_code == 201:
        created_tier_id = r.json().get("id")
    return r


def tier_update(tier_id: int = 1):
    r = requests.put(
        f"{BASE_URL}/product-price-tier/update",
        headers=headers(auth=True),
        json={"id": tier_id, "min_quantity": 5, "unit_price": 8.5},
    )
    log("Precio por volumen Actualizar", r)
    return r


def tier_delete(tier_id: int = 1):
    r = requests.delete(
        f"{BASE_URL}/product-price-tier/{tier_id}",
        headers=headers(auth=True),
    )
    log("Precio por volumen Eliminar", r)
    return r


# --- Order ---

def order_paginated():
    r = requests.post(
        f"{BASE_URL}/order/paginated",
        headers=headers(auth=True),
        json={"limit": 20, "filters": {}},
    )
    log("Order Orders paginated", r)
    return r


def order_get_by_id(order_id: int = 1):
    r = requests.get(f"{BASE_URL}/order/{order_id}", headers=headers(auth=True))
    log(f"Order Get by id {order_id}", r)
    return r


def order_create_client():
    global created_order_id
    r = requests.post(
        f"{BASE_URL}/order/create-client",
        headers=headers(auth=True),
        json={
            "payment": "efectivo",
            "lines": [
                {"id_product": 1, "quantity": 2},
                {"id_product": 2, "quantity": 5},
            ],
        },
    )
    log("Order Create (client)", r)
    if r.status_code == 201:
        created_order_id = r.json().get("id")
    return r


def order_create_admin(user_id: int = 2):
    global created_order_id
    r = requests.post(
        f"{BASE_URL}/order/create-admin",
        headers=headers(auth=True),
        json={
            "id_user": user_id,
            "payment": "efectivo",
            "lines": [
                {"id_product": 1, "quantity": 2},
                {"id_product": 2, "quantity": 5, "unit_price": 7.5},
            ],
        },
    )
    log("Order Create (admin)", r)
    if r.status_code == 201:
        created_order_id = r.json().get("id")
    return r


def order_update(order_id: int = 1):
    r = requests.put(
        f"{BASE_URL}/order/update",
        headers=headers(auth=True),
        json={"id": order_id, "payment": "tarjeta", "status": "PENDING"},
    )
    log(f"Order Update id={order_id}", r)
    return r


def order_set_status(order_id: int = 1, status: str = "FULFILLED"):
    r = requests.put(
        f"{BASE_URL}/order/{order_id}/status",
        headers=headers(auth=True),
        params={"status": status},
    )
    log(f"Order Set status id={order_id} -> {status}", r)
    return r


def order_deactivate(order_id: int = 1):
    r = requests.put(
        f"{BASE_URL}/order/{order_id}/deactivate",
        headers=headers(auth=True),
    )
    log(f"Order Deactivate id={order_id}", r)
    return r


def run_all():
    print("=== Lepra API Seeder (mismo flujo que Postman) ===\n")
    print("1. Auth")
    auth_signup()  # puede fallar si ya existe
    auth_login()
    if not TOKEN:
        print("\n  ERROR: No se pudo obtener token. ¿Existe admin@lepra.local / admin123?")
        return
    auth_me()

    print("\n2. User")
    user_paginated()
    user_get_by_id(1)
    user_create()
    uid = created_user_id or 2
    user_update(uid)
    # user_deactivate(uid)  # opcional: desactivaría el usuario creado

    print("\n3. Product")
    product_paginated()
    product_get_by_id(1)
    product_create()
    pid = created_product_id or 1
    product_update(pid)
    # product_deactivate(pid)  # opcional

    print("\n4. Precio por volumen")
    tier_create(2)  # producto 2 debe existir
    tid = created_tier_id or 1
    tier_update(tid)
    # tier_delete(tid)  # opcional: elimina el tier

    print("\n5. Order")
    order_paginated()
    order_get_by_id(1)
    order_create_client()
    order_create_admin(uid)
    oid = created_order_id or 1
    order_update(oid)
    order_set_status(oid, "FULFILLED")
    # order_deactivate(oid)  # opcional

    print("\n=== Fin ===")


if __name__ == "__main__":
    run_all()
