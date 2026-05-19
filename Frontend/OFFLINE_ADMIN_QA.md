# QA Checklist — Offline Admin (Fase 1 + Fase 2)

Este documento valida el uso offline del **ADMIN** (IndexedDB + outbox + sync).

> **Producción:** front en `https://store.lepramg.com`, API en `https://api.lepramg.com`.  
> Este checklist está pensado para **desarrollo local**; en producción usá las mismas rutas con esas URLs si probás online.

## Requisitos previos

- Backend local corriendo en `http://127.0.0.1:8000` (o API de staging)
- Frontend corriendo en `http://127.0.0.1:5173`
- Variables del frontend:
  - `VITE_API_URL=http://127.0.0.1:8000`
- Credenciales:
  - `admin@lepra.local` / `admin123`

## Preparación (online)

1. Abrir `http://127.0.0.1:5173/login` e iniciar sesión con admin.
2. Confirmar que redirige a `/admin`.
3. En la navbar de admin confirmar:
   - Badge **Online**
   - Botón **Sincronizar**
   - Botón **Pendientes**
4. Abrir **Pendientes**:
   - Esperado: “Sin cambios pendientes”.

## Fase 1 — Lectura offline (cache)

### A. Cambiar a Offline

1. Abrir DevTools → **Network** → activar **Offline**.
2. Esperado:
   - navbar muestra badge **Offline**

### B. Navegación en admin

1. Ir a:
   - `/admin/clientes`
   - `/admin/productos`
   - `/admin/pedidos`
2. Esperado:
   - Si hubo cargas previas, deben mostrarse datos desde IndexedDB.
   - La UI no debe romperse (sin crashes).

## Fase 2 — Outbox (writes offline) + badges

Con DevTools en **Offline**:

### A. Crear Usuario offline

1. `/admin/clientes` → **Agregar cliente** → completar email+password+rol → Crear.
2. Esperado:
   - Toast: “Usuario creado (pendiente de sincronizar)”
   - En tabla: columna **Sync** muestra badge **Pendiente** (id temporal < 0).
3. Abrir **Pendientes**:
   - Debe aparecer un item tipo `USER_CREATE`.

### B. Crear Producto offline (sin imagen)

1. `/admin/productos` → **Agregar producto** → nombre+precio → Crear.
2. Esperado:
   - Toast: “Producto creado (pendiente de sincronizar)”
   - En tabla: columna **Sync** muestra badge **Pendiente**.
3. Abrir **Pendientes**:
   - Debe aparecer un item tipo `PRODUCT_CREATE`.

### C. Editar/Desactivar offline (id positivo)

1. Elegir un **usuario/producto existente** (id real).
2. Hacer update o deactivate estando Offline.
3. Esperado:
   - Toast: “Cambio guardado (pendiente de sincronizar)”
   - En tabla: aparece badge **Pendiente** aunque el id sea positivo (porque está en outbox).

### D. Crear Pedido offline

1. `/admin/pedidos` → **Nuevo pedido**
2. Caso 1 (cliente/productos con IDs reales > 0):
   - Esperado: “Pedido creado (pendiente de sincronizar)” y en tabla badge **Pendiente**.
3. Caso 2 (cliente o algún producto creados offline en esta sesión, IDs < 0):
   - Esperado: “Pedido creado (pendiente; sincronizará después de productos/clientes nuevos)”.
   - En tabla: badge **Pendiente**.
   - Al volver online, el outbox procesa primero los `*_CREATE` (orden FIFO por createdAt) y reconcilia los IDs temporales antes de procesar el `ORDER_CREATE_ADMIN`. Si por carrera el pedido se intenta antes de que las dependencias estén mapeadas, se reintenta automáticamente cada 2s (`DependencyNotReadyError`).

## Volver Online — reconciliación (idmap) + sync “redondo”

1. DevTools → Network → desactivar **Offline**.
2. Esperado:
   - navbar vuelve a **Online**
3. Esperar ~15s:
   - Esperado: auto-procesado intenta enviar cola (sin spam de toasts).
4. Manual:
   - Click **Sincronizar**
5. Esperado:
   - Outbox se procesa (pendientes pasan a OK o Falló)
   - Sync incremental refresca cache
   - Los registros creados offline dejan de tener id negativo (reconciliación) y desaparecen badges “Pendiente”.

## Caso crítico — Token inválido / sesión expirada sin expulsar

Objetivo: la app **no expulsa** al admin de la UI; solo pausa sync y muestra **Re-login**.

1. Estando online en `/admin`, abrir DevTools → **Application → Local Storage**.
2. Cambiar `lepra_token` por un string inválido (o borrarlo).
3. Click **Sincronizar**.
4. Esperado:
   - Aparece botón **Re-login** en navbar
   - Toast: “Sesión expirada. Inicia sesión para sincronizar.”
   - No debe cortar navegación/uso offline (solo se pausa sync).
5. Click **Re-login**, volver a loguear:
   - Esperado: sync/outbox vuelven a estar habilitados.

## Evidencia recomendada (capturas)

- Navbar en Online/Offline.
- Modal Pendientes mostrando items y estados (Pendiente / Enviando / Falló / OK / Bloqueado).
- Tabla Clientes/Productos con columna Sync y badges “Pendiente”.
- Tabla Pedidos con badge “Pendiente” junto al estado.

