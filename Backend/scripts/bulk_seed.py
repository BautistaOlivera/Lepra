"""
Carga masiva de datos de prueba en PostgreSQL (orden FK-safe).

Orden: users (CLIENT) → products → orders → order_products

Los registros seed usan email *@seed.lepra.local y productos con img=__seed__.
`created_at` del pedido coincide con su fecha (las estadísticas filtran por eso).

Uso (desde Backend/):
  python scripts/bulk_seed.py
  python scripts/bulk_seed.py --clear
  python scripts/bulk_seed.py --clients 30 --products 30 --days 365 --max-per-day 20
  python scripts/bulk_seed.py --clients 100 --products 20 --orders 5000

Requisitos: Postgres accesible (variables DB_* o DATABASE_URL) y tablas creadas.
"""

from __future__ import annotations

import argparse
import os
import random
import sys
import time
from datetime import date, datetime, time as dt_time, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import delete, or_, select

from auth.security import hash_password
from config.db import SessionLocal
from models.order import Order, OrderProduct
from models.product import Product
from models.user import User

SEED_EMAIL_DOMAIN = "seed.lepra.local"
SEED_PRODUCT_CATEGORY = "SEED"
SEED_IMG_MARKER = "__seed__"
DEFAULT_CLIENT_PASSWORD = "cliente123"

LOCATIONS = [
    "CABA",
    "La Plata",
    "Rosario",
    "Córdoba",
    "Mendoza",
    "Mar del Plata",
    "Paraná",
    "Santa Fe",
    "Gualeguaychú",
    "Concordia",
]
PAYMENTS = ["efectivo", "transferencia", "tarjeta", "cuenta corriente"]
STATUSES = ["PENDING", "FULFILLED", "CANCELED"]
STATUS_WEIGHTS = [0.15, 0.80, 0.05]

CLIENT_NAMES = [
    "Juan Pérez",
    "María González",
    "Carlos Rodríguez",
    "Ana Fernández",
    "Luis Martínez",
    "Laura López",
    "Diego Sánchez",
    "Valentina Romero",
    "Martín Gómez",
    "Sofía Díaz",
    "Pablo Álvarez",
    "Camila Torres",
    "Hernán Ruiz",
    "Lucía Ramírez",
    "Federico Castro",
    "Julieta Morales",
    "Nicolás Herrera",
    "Florencia Vega",
    "Santiago Molina",
    "Agustina Ortiz",
    "Matías Silva",
    "Carolina Méndez",
    "Ignacio Ríos",
    "Paula Navarro",
    "Gastón Peña",
    "Micaela Suárez",
    "Rodrigo Blanco",
    "Belén Acosta",
    "Ezequiel Ponce",
    "Daniela Ibáñez",
]

# Categorías oficiales de la app (ProductoModal / Catálogo / Productos):
# "Lacteos" y "Embutidos" (sin tilde en el valor guardado).
# Peso por pieza: hormas de queso / piezas de embutido (2–5 kg) para el "~u." de la planilla.
PRODUCT_CATALOG: list[tuple[str, str, str, float, bool, float | None]] = [
    ("Cremoso", "Lacteos", "La Serenísima", 8900, False, 3.8),
    ("Tybo", "Lacteos", "Sancor", 9200, False, 4.2),
    ("Pategrás", "Lacteos", "La Paulina", 9800, False, 4.0),
    ("Sardo", "Lacteos", "La Serenísima", 10500, False, 3.2),
    ("Provolone", "Lacteos", "Sancor", 11200, False, 2.8),
    ("Mozzarella", "Lacteos", "La Paulina", 8700, False, 3.0),
    ("Port Salut", "Lacteos", "La Serenísima", 9100, False, 3.5),
    ("Gouda", "Lacteos", "Hollandia", 11800, False, 4.5),
    ("Reggianito", "Lacteos", "La Paulina", 12500, False, 5.0),
    ("Cuartirolo", "Lacteos", "Sancor", 8400, False, 3.0),
    ("Roquefort", "Lacteos", "La Serenísima", 14200, False, 2.5),
    ("Provoleta", "Lacteos", "La Paulina", 10800, True, 0.35),
    ("Queso untable", "Lacteos", "La Serenísima", 4200, True, 0.29),
    ("Ricota", "Lacteos", "Sancor", 3800, True, 0.5),
    ("Manteca", "Lacteos", "La Serenísima", 3100, True, 0.2),
    ("Crema de leche", "Lacteos", "Sancor", 2900, True, 0.35),
    ("Dulce de leche", "Lacteos", "La Serenísima", 3600, True, 0.4),
    ("Yogur natural", "Lacteos", "Danone", 1800, True, 0.12),
    ("Yogur firme", "Lacteos", "La Serenísima", 1600, True, 0.12),
    ("Leche entera 1L", "Lacteos", "La Serenísima", 1400, True, 1.0),
    ("Bondiola", "Embutidos", "Paladini", 14500, False, 3.2),
    ("Salame", "Embutidos", "Paladini", 12800, False, 2.4),
    ("Jamón cocido", "Embutidos", "Paladini", 9800, False, 4.8),
    ("Mortadela", "Embutidos", "Paladini", 7200, False, 3.5),
    ("Panceta", "Embutidos", "Paladini", 8900, False, 2.6),
    ("Jamonada", "Embutidos", "Paladini", 6500, False, 3.0),
    ("Queso rallado", "Lacteos", "La Paulina", 5600, True, 0.15),
    ("Holanda", "Lacteos", "Sancor", 10100, False, 4.0),
    ("Danbo", "Lacteos", "La Serenísima", 8700, False, 3.6),
    ("Fontina", "Lacteos", "La Paulina", 11900, False, 4.3),
]


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _progress(label: str, current: int, total: int, started: float) -> None:
    pct = (current / total * 100) if total else 100
    elapsed = time.perf_counter() - started
    print(f"  {label}: {current}/{total} ({pct:.1f}%) — {elapsed:.1f}s")


def _datetime_on(day: date) -> datetime:
    hour = random.randint(7, 19)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    return datetime.combine(day, dt_time(hour, minute, second))


def clear_seed_data(session) -> None:
    seed_user_ids = list(
        session.scalars(select(User.id).where(User.email.like(f"%@{SEED_EMAIL_DOMAIN}")))
    )
    marked_product_ids = set(
        session.scalars(
            select(Product.id).where(
                or_(Product.category == SEED_PRODUCT_CATEGORY, Product.img == SEED_IMG_MARKER)
            )
        )
    )
    from_orders: set[int] = set()
    if seed_user_ids:
        from_orders = set(
            session.scalars(
                select(OrderProduct.id_product)
                .join(Order, Order.id == OrderProduct.id_order)
                .where(Order.id_user.in_(seed_user_ids))
            )
        )
        shared = set(
            session.scalars(
                select(OrderProduct.id_product)
                .join(Order, Order.id == OrderProduct.id_order)
                .where(or_(Order.id_user.is_(None), Order.id_user.notin_(seed_user_ids)))
            )
        )
        from_orders -= shared

    seed_product_ids = list(marked_product_ids | from_orders)

    if not seed_user_ids and not seed_product_ids:
        print("No hay datos seed previos para borrar.")
        return

    order_ids_subq = select(Order.id).where(Order.id_user.in_(seed_user_ids))
    n_lines = session.execute(delete(OrderProduct).where(OrderProduct.id_order.in_(order_ids_subq))).rowcount
    n_orders = (
        session.execute(delete(Order).where(Order.id_user.in_(seed_user_ids))).rowcount if seed_user_ids else 0
    )
    n_products = (
        session.execute(delete(Product).where(Product.id.in_(seed_product_ids))).rowcount
        if seed_product_ids
        else 0
    )
    n_users = (
        session.execute(delete(User).where(User.id.in_(seed_user_ids))).rowcount if seed_user_ids else 0
    )

    session.commit()
    print(
        f"Datos seed eliminados: {n_users} usuarios, {n_products} productos, "
        f"{n_orders} pedidos, {n_lines} lineas."
    )


def seed_clients(session, count: int, batch_size: int) -> list[int]:
    print(f"\n1. Clientes ({count})…")
    hashed = hash_password(DEFAULT_CLIENT_PASSWORD)
    started = time.perf_counter()
    user_ids: list[int] = []

    for start in range(0, count, batch_size):
        batch_count = min(batch_size, count - start)
        users = []
        for i in range(start + 1, start + batch_count + 1):
            name = CLIENT_NAMES[(i - 1) % len(CLIENT_NAMES)]
            if i > len(CLIENT_NAMES):
                name = f"{name} {i}"
            users.append(
                User(
                    name=name,
                    email=f"cliente{i:04d}@{SEED_EMAIL_DOMAIN}",
                    password=hashed,
                    location=random.choice(LOCATIONS),
                    rol="CLIENT",
                    active=True,
                )
            )
        session.add_all(users)
        session.flush()
        user_ids.extend(u.id for u in users)
        session.commit()
        _progress("Clientes", len(user_ids), count, started)

    return user_ids


def seed_products(session, count: int, batch_size: int) -> list[tuple[int, float, bool, float | None]]:
    print(f"\n2. Productos ({count})…")
    started = time.perf_counter()
    product_data: list[tuple[int, float, bool, float | None]] = []

    for start in range(0, count, batch_size):
        batch_count = min(batch_size, count - start)
        products = []
        for i in range(start, start + batch_count):
            spec = PRODUCT_CATALOG[i % len(PRODUCT_CATALOG)]
            name, category, brand, price, sold_by_piece, piece_weight = spec
            if i >= len(PRODUCT_CATALOG):
                name = f"{name} {i + 1}"
            products.append(
                Product(
                    name=name,
                    price=price,
                    brand=brand,
                    category=category,
                    has_tiered_pricing=False,
                    fixed_weight=sold_by_piece,
                    weight=piece_weight,
                    img=None,
                    status="active",
                    active=True,
                )
            )
        session.add_all(products)
        session.flush()
        product_data.extend((p.id, p.price, bool(p.fixed_weight), p.weight) for p in products)
        session.commit()
        _progress("Productos", len(product_data), count, started)

    return product_data


def _build_order_lines(
    product_data: list[tuple[int, float, bool, float | None]],
    lines_min: int,
    lines_max: int,
) -> tuple[list[tuple[int, float, float]], float]:
    n_lines = random.randint(lines_min, min(lines_max, len(product_data)))
    chosen = random.sample(product_data, k=n_lines)
    lines: list[tuple[int, float, float]] = []
    total = 0.0
    for pid, price, sold_by_piece, piece_weight in chosen:
        if sold_by_piece and piece_weight and piece_weight > 0:
            pieces = random.randint(1, 8)
            weight_kg = round(pieces * piece_weight, 3)
        else:
            weight_kg = round(random.uniform(0.5, 12.0), 3)
        lines.append((pid, weight_kg, price))
        total += round(weight_kg * price, 2)
    return lines, round(total, 2)


def _insert_order_batch(
    session,
    specs: list[tuple[date, datetime, int]],
    product_data: list[tuple[int, float, bool, float | None]],
    lines_min: int,
    lines_max: int,
) -> int:
    orders: list[Order] = []
    lines_per_order: list[list[tuple[int, float, float]]] = []

    for order_date, created_at, id_user in specs:
        lines, total = _build_order_lines(product_data, lines_min, lines_max)
        orders.append(
            Order(
                id_user=id_user,
                total=total,
                date=order_date,
                created_at=created_at,
                updated_at=created_at,
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
    return len(orders)


def seed_orders(
    session,
    count: int,
    user_ids: list[int],
    product_data: list[tuple[int, float, bool, float | None]],
    batch_size: int,
    lines_min: int = 1,
    lines_max: int = 5,
) -> int:
    print(f"\n3. Pedidos ({count})…")
    started = time.perf_counter()
    today = date.today()
    created = 0

    for batch_start in range(0, count, batch_size):
        batch_count = min(batch_size, count - batch_start)
        specs: list[tuple[date, datetime, int]] = []
        for _ in range(batch_count):
            days_ago = random.randint(0, 729)
            order_date = today - timedelta(days=days_ago)
            specs.append((order_date, _datetime_on(order_date), random.choice(user_ids)))
        created += _insert_order_batch(session, specs, product_data, lines_min, lines_max)
        _progress("Pedidos", created, count, started)
    return created


def seed_orders_by_day(
    session,
    user_ids: list[int],
    product_data: list[tuple[int, float, bool, float | None]],
    days: int,
    max_per_day: int,
    batch_size: int,
    lines_min: int = 1,
    lines_max: int = 5,
) -> int:
    today = date.today()
    start = today - timedelta(days=days - 1)
    specs: list[tuple[date, datetime, int]] = []

    for offset in range(days):
        day = start + timedelta(days=offset)
        n = int(random.triangular(0, max_per_day, max_per_day * 0.55))
        if day.weekday() >= 5:
            n = max(0, n // 2)
        n = min(n, max_per_day)
        for _ in range(n):
            specs.append((day, _datetime_on(day), random.choice(user_ids)))

    total = len(specs)
    print(f"\n3. Pedidos (~{days} dias, max. {max_per_day}/dia -> {total})...")
    started = time.perf_counter()
    created = 0
    for batch_start in range(0, total, batch_size):
        batch = specs[batch_start : batch_start + batch_size]
        created += _insert_order_batch(session, batch, product_data, lines_min, lines_max)
        _progress("Pedidos", created, total, started)
    return created


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Carga masiva de datos El Lepra (FK-safe).")
    parser.add_argument("--clients", type=int, default=int(os.getenv("SEED_CLIENTS", "500")))
    parser.add_argument("--products", type=int, default=int(os.getenv("SEED_PRODUCTS", "50")))
    parser.add_argument("--orders", type=int, default=int(os.getenv("SEED_ORDERS", "15000")))
    parser.add_argument(
        "--days",
        type=int,
        default=None,
        help="Si se indica, reparte pedidos en este calendario (en lugar de --orders).",
    )
    parser.add_argument(
        "--max-per-day",
        type=int,
        default=20,
        help="Tope de pedidos por día (solo con --days). Default: 20.",
    )
    parser.add_argument("--batch-size", type=int, default=int(os.getenv("SEED_BATCH_SIZE", "500")))
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Elimina datos seed previos (@seed.lepra.local / img __seed__) antes de cargar.",
    )
    parser.add_argument(
        "--clear-only",
        action="store_true",
        help="Solo elimina datos seed, sin insertar.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.clients < 1 or args.products < 1:
        print("clients y products deben ser >= 1.")
        sys.exit(1)
    if args.days is not None:
        if args.days < 1 or args.max_per_day < 1:
            print("days y max-per-day deben ser >= 1.")
            sys.exit(1)
    elif args.orders < 1:
        print("orders debe ser >= 1.")
        sys.exit(1)

    print("=== El Lepra bulk seed ===")
    if args.days is not None:
        print(
            f"Objetivo: {args.clients} clientes, {args.products} productos, "
            f"{args.days} días (máx. {args.max_per_day} pedidos/día)"
        )
    else:
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
        if args.days is not None:
            n_orders = seed_orders_by_day(
                session, user_ids, product_data, args.days, args.max_per_day, args.batch_size
            )
        else:
            n_orders = seed_orders(session, args.orders, user_ids, product_data, args.batch_size)

        print(f"\n=== Carga completada en {time.perf_counter() - t0:.1f}s ===")
        print(f"Clientes: {len(user_ids)} | Productos: {len(product_data)} | Pedidos: {n_orders}")
        print(f"Login de ejemplo: cliente0001@{SEED_EMAIL_DOMAIN} / {DEFAULT_CLIENT_PASSWORD}")
    except Exception as e:
        session.rollback()
        print(f"\nError: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
