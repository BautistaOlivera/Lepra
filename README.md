# Lepra

PWA para un negocio de venta de lácteos y otros productos: catálogo público, pedidos para clientes registrados y generación de tickets/facturas. La diferencia principal es que los administradores pueden usar la app sin conexión (catálogo, usuarios, productos, pedidos, tickets) y sincronizar cuando haya internet.

**Producción:** [store.lepramg.com](https://store.lepramg.com) (front) · [api.lepramg.com](https://api.lepramg.com) (API)

---

## Qué hace la app

- **Sin login:** Cualquiera puede ver el catálogo (foto, descripción breve y precio). Las imágenes son pequeñas para poder cachear y usar offline en modo gestor.

- **Clientes (con login):** Solo quienes estén registrados (por el administrador) pueden hacer pedidos. Necesitan conexión; no hay modo offline para clientes.

- **Administradores:** Gestionan usuarios, productos, precios por volumen y pedidos; pueden trabajar offline con IndexedDB y sincronizar al tener conexión. Los tickets se generan en el navegador con datos locales.

Solo hay dos roles: **Cliente** y **Administrador**.

---

## Roles

- **Cliente:** Catálogo y sus propios pedidos (solo online).

- **Administrador:** Todo lo anterior más gestión offline de usuarios, productos y pedidos; cambios en cola de sincronización.

Baja lógica en usuarios, productos y pedidos (`active` / estados).

---

## Pedidos: estado y "baja"

- **PENDING** — Creado, pendiente.
- **FULFILLED** — Cumplido.
- **CANCELED** — Cancelado (baja lógica).

---

## Offline y sincronización (solo administradores)

IndexedDB guarda catálogo, usuarios, productos y pedidos. Al reconectar, la app sincroniza con la API. Ver [Frontend/OFFLINE_ADMIN_QA.md](./Frontend/OFFLINE_ADMIN_QA.md).

---

## Precios por volumen

`Product.price` base; si `has_tiered_pricing`, se usan filas en `Product_price_tier`. En el pedido se guarda `unit_price` por línea en `Order-Product`.

---

## Stack y estructura

| Capa | Tecnologías |
|------|-------------|
| **Frontend** | React 18, TypeScript, Vite, Bootstrap, PWA (`vite-plugin-pwa`), Dexie, react-router-dom |
| **Backend** | FastAPI, SQLAlchemy, PostgreSQL, JWT |
| **Producción** | CloudPanel (Nginx + estático), uvicorn, PostgreSQL en VPS |

Carpetas: `Backend/` (API) y `Frontend/src` (app).

Imágenes de producto: optimización al subir (WebP, máx. 1200 px) en `Backend/routes/product.py`.

---

## Modelo de datos (resumen)

- **Product** — id, name, price, brand, category, has_tiered_pricing, img, active  
- **User** — id, name, email, password (hash), location, rol, active  
- **Order** — id, id_user, total, date, created_at, payment, status, active  
- **Order-Product** — id, id_order, id_product, quantity, unit_price  
- **Product_price_tier** — id, id_product, min_quantity, unit_price  

---

## Desarrollo local

```bash
# Backend
cd Backend
python -m venv venv
venv\Scripts\activate          # Linux/Mac: source venv/bin/activate
pip install -r requirements-dev.txt
copy .env.example .env         # ajustar DATABASE_URL o DB_*
uvicorn app:lepra --reload --port 8000

# Frontend
cd Frontend
copy .env.example .env         # VITE_API_URL=http://localhost:8000
npm install
npm run dev
```

---

## Deploy

| Guía | Uso |
|------|-----|
| **[DEPLOY_CLOUDPANEL.md](./DEPLOY_CLOUDPANEL.md)** | Producción — VPS, Postgres, API, front |
| **[DEPLOY_GITHUB.md](./DEPLOY_GITHUB.md)** | Deploy automático (push a `main`) |
| [DEPLOY.md](./DEPLOY.md) | Índice rápido |
| [HOSTING_HISTORY.md](./HOSTING_HISTORY.md) | Hosting anterior (Render + Netlify) |

Variables: `Backend/.env.example`, `Frontend/.env.example`.

---

## Tests

```bash
cd Backend && pip install -r requirements-dev.txt && pytest
cd Frontend && npm install && npm test
```

---

## Documentación

| Archivo | Contenido |
|---------|-----------|
| [DEPLOY_CLOUDPANEL.md](./DEPLOY_CLOUDPANEL.md) | Deploy VPS paso a paso |
| [HOSTING_HISTORY.md](./HOSTING_HISTORY.md) | Histórico Render / Netlify |
| [Frontend/OFFLINE_ADMIN_QA.md](./Frontend/OFFLINE_ADMIN_QA.md) | Checklist QA offline admin |
