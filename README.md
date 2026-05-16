# El Lepra

PWA para un negocio de venta de lácteos y otros productos: catálogo público, pedidos para clientes registrados y generación de tickets/facturas. La diferencia principal es que los administradores pueden usar la app sin conexión (catálogo, usuarios, productos, pedidos, tickets) y sincronizar cuando haya internet.

---

## Qué hace la app

-Sin login: Cualquiera puede ver el catálogo (foto, descripción breve y precio). Las imágenes son pequeñas para poder cachear y usar offline en modo gestor.

-Clientes (con login): Solo quienes estén registrados (por el administrador) pueden hacer pedidos. Necesitan conexión; no hay modo offline para clientes. En la app, "registrado" = puede iniciar sesión; se listan y filtran por rol.

-Administradores: Pueden hacer todo lo de un cliente y además gestionar usuarios (altas, edición, baja), productos y precios por volumen, y pedidos (propios o de clientes). Todo eso puede hacerse offline. Los datos se guardan en IndexedDB y se envían al servidor al tener conexión. Los tickets se generan en el navegador con esos datos locales, así el administrador siempre puede imprimir sin conexión.

Solo hay dos roles: Cliente y Administrador.

---

## Roles

-Cliente: Ve el catálogo y puede crear y gestionar sus propios pedidos, solo con conexión.

-Administrador: Ve el catálogo, crea/edita/cancela pedidos (propios o de clientes), usuarios, productos y configura precios por volumen cuando haga falta. Todo eso offline; los cambios se suben al servidor cuando hay conexión.

En toda la app usamos baja lógica: usuarios, productos y pedidos no se borran; se marcan como inactivos (o cancelados/cumplidos en pedidos) para conservar historial.

---

## Pedidos: estado y "baja"

Cada pedido tiene un estado:

- PENDING: Creado, aún no cumplido ni cancelado.
- FULFILLED: Cumplido (entregado, cobrado, etc.).
- CANCELED: Cancelado (se guarda, pero en listados se trata como dado de baja).

Además el pedido tiene un flag active (booleano) por si más adelante queremos un "oculto" o "archivado" global.

La baja lógica de pedidos se expresa con el estado (p. ej. CANCELED) y opcionalmente con active; no se hace borrado físico.

---

## Offline y sincronización (solo administradores)

Solo el administrador trabaja offline. En IndexedDB se guardan catálogo (productos y volumen), usuarios, productos, precios por volumen y pedidos con sus líneas.

Cuando hay conexión, la app sincroniza esos cambios con el backend. Para ordenar y evitar duplicados al sincronizar varios administradores se usa created_at (y opcionalmente dispositivo/sesión). El id definitivo del pedido lo asigna la base de datos al recibirlo; no usamos número de pedido en BD. El ticket muestra la fecha de creación (y la referencia local que se quiera) para que sea útil en el momento de crearlo, sin depender del id del servidor.

---

## Precios por volumen

Algunos productos tienen mejor precio unitario al comprar más (ej.: 1 u = 10, 5 u = 8, 10 u = 7). La mayoría tienen un solo precio; solo algunos tienen precio por volumen.

En Product está el price base (cantidad 1) y el booleano has_tiered_pricing. Si es true, se usa la tabla Product_price_tier (min_quantity, unit_price). Al añadir al carrito se calcula el unit_price correcto (base o por volumen) y se guardan quantity y unit_price en Order-Product. Para el total y el ticket solo se lee Order-Product: total = suma de (quantity × unit_price); no hace falta tocar Product ni Product_price_tier en ese momento.

---

## Stack y estructura


Frontend: React 19, TypeScript, Vite, Tailwind, Bootstrap, Chart.js, react-router-dom, react-hot-toast, TanStack Table, react-select, lucide-react, jwt-decode. 

Backend: FastAPI, SQLAlchemy, PostgreSQL, JWT, control por rol (Administrador / Cliente). 

Carpetas: `Backend/` (app, routes, models, auth, config) y `Frontend/src` (api, components, hooks, types, views, layouts, routes).

Lo añadido en este proyecto es la capa IndexedDB en el frontend para los datos offline del administrador y la sincronización.

---

## Modelo de datos (resumen)

Product — id, name, price (base), brand, category, has_tiered_pricing, img (string), active.

User — id, name, email, password (hash), location, rol (Client | Admin), active.

Order — id (asignado por BD al sincronizar), id_user, **Total** (guardado: suma de las líneas del pedido), Date, created_at, Payment, status (PENDING | FULFILLED | CANCELED), active.

Order-Product — id, id_order, id_product, quantity, unit_price (fijado al crear el pedido). Al crear o actualizar el pedido se recalcula y se guarda Total en Order.

Product_price_tier — id, id_product, min_quantity, unit_price.

---

## Próximos pasos

1. Backend: modelos (Order.status y Order.active), auth, CRUD de Product, User, Order, Order-Product, Product_price_tier.
2. Frontend: catálogo público, login, creación de pedidos (carrito y lógica de volúmenes), generación de PDF/ticket en el navegador.
3. Capa IndexedDB: guardar y sincronizar usuarios, productos (con volúmenes) y pedidos del administrador; deduplicar por created_at.
4. PWA (manifest, service worker, offline): **implementado** en `Frontend` (`vite-plugin-pwa`). Para probar instalación en el teléfono en tu red Wi‑Fi: `npm run dev:https` en la carpeta Frontend y abrir `https://<IP-de-tu-PC>:5173` (certificado de desarrollo: el navegador pedirá confiar una vez). Si el catálogo o el login no cargan datos desde el móvil, usá `VITE_API_URL` apuntando al backend por IP de la misma red (no `localhost`).
5. Probar: administrador crea/edita usuarios, productos y pedidos offline, genera ticket y luego sincroniza al conectarse.

---

## Tests automáticos

- **Frontend** (`Frontend/`): `npm install` y `npm run test` (Vitest; no usa el `vite.config` de producción, solo `vitest.config.ts`). `npm run build` sigue igual.
- **Backend** (`Backend/`): `pip install -r requirements-dev.txt` y `pytest` (no levanta la API ni requiere Postgres para los tests actuales).
