"""
Carga masiva de datos de prueba en PostgreSQL (orden FK-safe).

Orden: users (CLIENT) → products → orders → order_products

Por defecto: 500 clientes, 50 productos, 15000 pedidos.
Los registros seed usan email *@seed.lepra.local y productos con category=SEED.

Uso (desde Backend/):
  python scripts/bulk_seed.py
  python scripts/bulk_seed.py --clear
  python scripts/bulk_seed.py --clients 100 --products 20 --orders 5000

Requisitos: Postgres accesible (variables DB_* o DATABASE_URL) y tablas creadas.
"""

from __future__ import annotations

import argparse
import os
import random
import sys
import time
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import delete, select

from auth.security import hash_password
from config.db import SessionLocal
from models.order import Order, OrderProduct
from models.product import Product
from models.user import User

SEED_EMAIL_DOMAIN = "seed.lepra.local"
SEED_PRODUCT_CATEGORY = "SEED"
DEFAULT_CLIENT_PASSWORD = "cliente123"

LOCATIONS = [
    "CABA", "La Plata", "Rosario", "Córdoba", "Mendoza",
    "Mar del Plata", "Tucumán", "Salta", "Neuquén", "Santa Fe",
]
BRANDS = ["La Serenísima", "Arcor", "Quilmes", "Coca-Cola", "Bagley", "Molinos", "Danone"]
CATEGORIES = ["Lácteos", "Bebidas", "Golosinas", "Panadería", "Conservas", "Limpieza"]
PAYMENTS = ["efectivo", "transferencia", "tarjeta", "cuenta corriente"]
STATUSES = ["PENDING", "FULFILLED", "CANCELED"]
STATUS_WEIGHTS = [0.25, 0.70, 0.05]


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _progress(label: str, current: int, total: int, started: float) -> None:
    pct = (current / total * 100) if total else 100
    elapsed = time.perf_counter() - started
    print(f"  {label}: {current}/{total} ({pct:.1f}%) — {elapsed:.1f}s")


def clear_seed_data(session) -> None:
    seed_user_ids = list(
        session.scalars(
            select(User.id).where(User.email.like(f"%@{SEED_EMAIL_DOMAIN}"))
        )
    )
    seed_product_ids = list(
        session.scalars(
            select(Product.id).where(Product.category == SEED_PRODUCT_CATEGORY)
        )
    )

    if not seed_user_ids and not seed_product_ids:
        print("No hay datos seed previos para borrar.")
        return

    order_ids_subq = select(Order.id).where(Order.id_user.in_(seed_user_ids))
    n_lines = session.execute(
        delete(OrderProduct).where(OrderProduct.id_order.in_(order_ids_subq))
    ).rowcount
    n_orders = session.execute(
        delete(Order).where(Order.id_user.in_(seed_user_ids))
    ).rowcount if seed_user_ids else 0
    n_products = (
        session.execute(delete(Product).where(Product.id.in_(seed_product_ids))).rowcount
        if seed_product_ids
        else 0
    )
    n_users = (
        session.execute(delete(User).where(User.id.in_(seed_user_ids))).rowcount
        if seed_user_ids
        else 0
    )

    session.commit()
    print(
        f"Datos seed eliminados: {n_users} usuarios, {n_products} productos, "
        f"{n_orders} pedidos, {n_lines} líneas."
    )


def seed_clients(session, count: int, batch_size: int) -> list[int]:
    print(f"\n1. Clientes ({count})…")
    hashed = hash_password(DEFAULT_CLIENT_PASSWORD)
    started = time.perf_counter()
    user_ids: list[int] = []

    for start in range(0, count, batch_size):
        batch_count = min(batch_size, count - start)
        users = [
            User(
                name=f"Cliente Seed {i:04d}",
                email=f"cliente{i:04d}@{SEED_EMAIL_DOMAIN}",
                password=hashed,
                location=random.choice(LOCATIONS),
                rol="CLIENT",
                active=True,
            )
            for i in range(start + 1, start + batch_count + 1)
        ]
        session.add_all(users)
        session.flush()
        user_ids.extend(u.id for u in users)
        session.commit()
        _progress("Clientes", len(user_ids), count, started)

    return user_ids


def seed_products(session, count: int, batch_size: int) -> list[tuple[int, float]]:
    print(f"\n2. Productos ({count})…")
    started = time.perf_counter()
    product_data: list[tuple[int, float]] = []

    for start in range(0, count, batch_size):
        batch_count = min(batch_size, count - start)
        products = [
            Product(
                name=f"Producto Seed {i:03d}",
                price=round(random.uniform(80, 4500), 2),
                brand=random.choice(BRANDS),
                category=SEED_PRODUCT_CATEGORY,
                has_tiered_pricing=False,
                active=True,
            )
            for i in range(start + 1, start + batch_count + 1)
        ]
        session.add_all(products)
        session.flush()
        product_data.extend((p.id, p.price) for p in products)
        session.commit()
        _progress("Productos", len(product_data), count, started)

    return product_data


def seed_orders(
    session,
    count: int,
    user_ids: list[int],
    product_data: list[tuple[int, float]],
    batch_size: int,
    lines_min: int = 1,
    lines_max: int = 4,
) -> None:
    print(f"\n3. Pedidos ({count})…")
    started = time.perf_counter()
    today = date.today()
    created = 0

    product_ids = [p[0] for p in product_data]
    price_by_id = {p[0]: p[1] for p in product_data}

    for batch_start in range(0, count, batch_size):
        batch_count = min(batch_size, count - batch_start)
        orders: list[Order] = []
        lines_per_order: list[list[tuple[int, float, float]]] = []

        for _ in range(batch_count):
            id_user = random.choice(user_ids)
            days_ago = random.randint(0, 730)
            order_date = today - timedelta(days=days_ago)
            lines: list[tuple[int, float, float]] = []
            total = 0.0
            n_lines = random.randint(lines_min, lines_max)
            chosen = random.sample(product_ids, k=min(n_lines, len(product_ids)))

            for pid in chosen:
                weight_kg = round(random.uniform(0.5, 40.0), 3)
                price_per_kg = price_by_id[pid]
                lines.append((pid, weight_kg, price_per_kg))
                total += round(weight_kg * price_per_kg, 2)

            orders.append(
                Order(
                    id_user=id_user,
                    total=round(total, 2),
                    date=order_date,
                    payment=random.choice(PAYMENTS),
                    status=random.choices(STATUSES, weights=STATUS_WEIGHTS, k=1)[0],
                    active=True,
                )
            )
            lines_per_order.append(lines)

        session.add_all(orders)
        session.flush()

        order_products: list[OrderProduct] = []
        for order, lines in zip(orders, lines_per_order):
            for pid, weight_kg, price_per_kg in lines:
                order_products.append(
                    OrderProduct(
                        id_order=order.id,
                        id_product=pid,
                        weight=weight_kg,
                        price_per_kg=price_per_kg,
                    )
                )

        session.add_all(order_products)
        session.commit()
        created += batch_count
        _progress("Pedidos", created, count, started)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Carga masiva de datos El Lepra (FK-safe).")
    parser.add_argument("--clients", type=int, default=int(os.getenv("SEED_CLIENTS", "500")))
    parser.add_argument("--products", type=int, default=int(os.getenv("SEED_PRODUCTS", "50")))
    parser.add_argument("--orders", type=int, default=int(os.getenv("SEED_ORDERS", "15000")))
    parser.add_argument("--batch-size", type=int, default=int(os.getenv("SEED_BATCH_SIZE", "500")))
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Elimina datos seed previos (@seed.lepra.local / category SEED) antes de cargar.",
    )
    parser.add_argument(
        "--clear-only",
        action="store_true",
        help="Solo elimina datos seed, sin insertar.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.clients < 1 or args.products < 1 or args.orders < 1:
        print("clients, products y orders deben ser >= 1.")
        sys.exit(1)

    print("=== El Lepra bulk seed ===")
    print(f"Objetivo: {args.clients} clientes, {args.products} productos, {args.orders} pedidos")
    t0 = time.perf_counter()

    session = SessionLocal()
    try:
        if args.clear or args.clear_only:
            clear_seed_data(session)
        if args.clear_only:
            return

        user_ids = seed_clients(session, args.clients, args.batch_size)
        product_data = seed_products(session, args.products, args.batch_size)
        seed_orders(session, args.orders, user_ids, product_data, args.batch_size)

        print(f"\n=== Carga completada en {time.perf_counter() - t0:.1f}s ===")
        print(f"Clientes: {len(user_ids)} | Productos: {len(product_data)} | Pedidos: {args.orders}")
        print(f"Login de ejemplo: cliente0001@{SEED_EMAIL_DOMAIN} / {DEFAULT_CLIENT_PASSWORD}")
    except Exception as e:
        session.rollback()
        print(f"\nError: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
