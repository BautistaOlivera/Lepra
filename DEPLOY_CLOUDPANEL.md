# Guía de deploy — Lepra en VPS + CloudPanel

> **Deploy de producción actual.** Índice general: [DEPLOY.md](./DEPLOY.md).

Deploy completo en un solo servidor: **PostgreSQL**, **API FastAPI** y **frontend estático (Vite/React)**.

Dominios de ejemplo (ajustá los tuyos):

| Componente | Dominio ejemplo |
|------------|-----------------|
| Frontend (tienda) | `https://store.lepramg.com` |
| API | `https://api.lepramg.com` |

Rutas de ejemplo en el servidor:

| Qué | Ruta |
|-----|------|
| Usuario del sitio | `lepramg-store` |
| Front (document root) | `/home/lepramg-store/htdocs/store.lepramg.com/` |
| Backend | `/home/lepramg-store/lepra-api/Backend/` |
| Imágenes subidas | `/home/lepramg-store/lepra-api/Backend/uploads/` |

---

## Requisitos previos

- VPS con **CloudPanel** (Ubuntu 22.04/24.04 recomendado).
- Mínimo recomendado: **2 vCPU / 2 GB RAM**.
- Acceso **SSH como root** (para PostgreSQL, systemd y reverse proxy).
- Acceso **SFTP** como usuario del sitio (`lepramg-store`) para subir archivos.
- DNS:
  - `store` → IP del VPS
  - `api` → IP del VPS

CloudPanel trae **MariaDB** para sitios PHP; **Lepra usa PostgreSQL**, que se instala aparte por SSH.

---

## Arquitectura

```text
Navegador
   │
   ├─► store.tudominio.com  →  Nginx (CloudPanel)  →  archivos estáticos (dist/)
   │
   └─► api.tudominio.com    →  Nginx (reverse proxy)  →  uvicorn :8000
                                                              │
                                                              ▼
                                                         PostgreSQL (localhost:5432)
```

El frontend **no** se conecta a Postgres. Solo llama a la API por HTTPS.

**Versiones alineadas con CI** (`.github/workflows/deploy.yml`): **Node 22**, **Python 3.12**.

---

## VPS nuevo (suscripción duplicada)

Contrataste **otro VPS igual al actual** (mismo proveedor, mismo plan CloudPanel, mismas specs) como **suscripción aparte**. Es una máquina **nueva y vacía** — no un clon de disco ni snapshot del servidor viejo.

| Qué es | Qué no es |
|--------|-----------|
| Mismo tipo de servidor (CloudPanel + Ubuntu, mismas rutas de esta guía) | Copiar el VPS anterior tal cual (imagen/snapshot del proveedor) |
| IP y suscripción nuevas | Migración automática de datos |
| Deploy desde cero con las Partes 1–4 de esta guía | Cambiar dominios (seguís con `store.*` y `api.*`) |

El VPS **actual sigue siendo producción** hasta que apuntes el DNS al nuevo. En paralelo montás el nuevo con la misma receta.

### Orden recomendado

| Paso | Qué |
|------|-----|
| 1 | Contratar VPS idéntico + instalar CloudPanel (Ubuntu 22.04/24.04) |
| 2 | Crear usuario del sitio `lepramg-store` y sitios `store.*` / `api.*` (mismas rutas que la tabla inicial) |
| 3 | Partes 1–2 (Postgres + API + `.env` + systemd + reverse proxy) |
| 4 | Parte 3 (build del front en tu PC + subir `dist/` completo) |
| 5 | Reglas Nginx del front (SPA, caché PWA, `pagespeed off`, §3.8 legacy) |
| 6 | Parte 4 (verificación en el VPS nuevo, **antes** del corte) |
| 7 | *(Opcional)* Traer datos del VPS viejo — ver abajo |
| 8 | Corte DNS: `store` y `api` → IP del VPS nuevo |
| 9 | Actualizar secrets de GitHub (`SSH_HOST`, `SSH_PORT`) → [DEPLOY_GITHUB.md](./DEPLOY_GITHUB.md) |
| 10 | *Run workflow* en GitHub Actions para validar CI en el servidor nuevo |
| 11 | Dar de baja la suscripción del VPS viejo cuando confirmes estabilidad |

### Probar antes del corte de DNS

Mientras los dominios siguen apuntando al VPS actual, validá el nuevo con entradas temporales en `C:\Windows\System32\drivers\etc\hosts` (solo en tu PC):

```text
IP_DEL_VPS_NUEVO   store.lepramg.com
IP_DEL_VPS_NUEVO   api.lepramg.com
```

Quitá esas líneas después del corte.

### Traer datos del VPS anterior (opcional)

Solo si el VPS viejo **ya tenía producción** y al pasar al nuevo querés conservar productos, pedidos, usuarios e imágenes. Si es un **arranque limpio**, saltá este bloque: la API crea tablas vacías con `create_all()` y el admin con `create_admin.py`.

**En el VPS viejo** (como root):

```bash
sudo -u postgres pg_dump lepra > /tmp/lepra_backup.sql
tar czf /tmp/lepra_uploads.tar.gz -C /home/lepramg-store/lepra-api/Backend uploads/
```

Descargá ambos archivos (SFTP/SCP) y subilos al VPS nuevo.

**En el VPS nuevo**, después de la Parte 1 (Postgres creado) y **antes** de usar la API con datos reales:

```bash
sudo -u postgres psql -d lepra < /tmp/lepra_backup.sql
mkdir -p /home/lepramg-store/lepra-api/Backend/uploads
tar xzf /tmp/lepra_uploads.tar.gz -C /home/lepramg-store/lepra-api/Backend
chown -R lepramg-store:lepramg-store /home/lepramg-store/lepra-api
```

### Checklist post-corte

- [ ] `https://api.lepramg.com/health` → `{"ok":true}`
- [ ] Login admin en `https://store.lepramg.com`
- [ ] **Tablet legacy** (si aplica): login admin + una pantalla `/admin/*` (ver §3.8)
- [ ] Imágenes de productos cargan (`/uploads/...`)
- [ ] Logo en comprobante PDF (`/uploads/lepra-logo-watermark.png`)
- [ ] GitHub Actions termina con `lepra-api is active`
- [ ] Suscripción del VPS viejo: cancelar solo cuando todo esté estable en el nuevo

---

## Parte 1 — PostgreSQL

Conectate por SSH como **root**.

### 1.1 Instalar PostgreSQL

```bash
apt update
apt install -y postgresql postgresql-contrib
systemctl status postgresql
```

Debe estar `active (running)`.

### 1.2 Crear usuario y base de datos

Reemplazá `TU_PASSWORD_SEGURA` por una contraseña fuerte (solo letras y números evita problemas en URLs).

```bash
sudo -u postgres psql -c "CREATE USER lepra_user WITH PASSWORD 'TU_PASSWORD_SEGURA';"
sudo -u postgres psql -c "CREATE DATABASE lepra OWNER lepra_user;"
sudo -u postgres psql -d lepra -c "GRANT ALL ON SCHEMA public TO lepra_user;"
```

### 1.3 Verificar

```bash
sudo -u postgres psql -d lepra -c "\dt"
```

Al inicio no hay tablas (normal). Las crea la API al arrancar.

Probar conexión con tu usuario:

```bash
PGPASSWORD='TU_PASSWORD_SEGURA' psql -h localhost -U lepra_user -d lepra -c "SELECT 1;"
```

### 1.4 Seguridad

- Postgres escucha en `localhost` (no abras el puerto **5432** al público en el firewall).
- Solo la API en el mismo VPS se conecta.

---

## Parte 2 — Backend (API FastAPI)

### 2.1 Subir el código

Por **SFTP** (usuario `lepramg-store`), creá la carpeta y subí el contenido de la carpeta `Backend/` del repo:

```text
/home/lepramg-store/lepra-api/Backend/
├── app.py
├── requirements.txt
├── branding/          ← PNG del logo (ver §2.8)
├── config/
├── routes/
├── models/
├── auth/
├── services/
├── scripts/
└── ...
```

No subas `__pycache__`, `.venv` ni `.env` desde tu PC (el `.env` se crea en el servidor).

### 2.2 Python y dependencias (SSH como root)

```bash
apt install -y python3 python3-venv python3-pip
cd /home/lepramg-store/lepra-api/Backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Usá **Python 3.12** si está disponible en el VPS (`python3 --version`). Es la versión del runner de GitHub Actions.

### 2.3 Archivo `.env`

Creá `/home/lepramg-store/lepra-api/Backend/.env`:

```env
DATABASE_URL=postgresql://lepra_user:TU_PASSWORD_SEGURA@localhost:5432/lepra
SECRET_KEY=GENERA_UNA_CLAVE_LARGA

# Solo si el dominio del front no es store.lepramg.com (coma-separados, sin espacios extra)
# CORS_ORIGINS=https://store.tudominio.com

ADMIN_EMAIL=admin@lepra.local
ADMIN_PASSWORD=admin123
ADMIN_NAME=Admin
```

Usá solo `DATABASE_URL` (no `INTERNAL_DATABASE_URL`; ver [HOSTING_HISTORY.md](./HOSTING_HISTORY.md)).

Generar `SECRET_KEY` en el servidor:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

Permisos:

```bash
chown -R lepramg-store:lepramg-store /home/lepramg-store/lepra-api
```

### 2.4 Probar arranque manual

```bash
cd /home/lepramg-store/lepra-api/Backend
source venv/bin/activate
export $(grep -v '^#' .env | xargs)
uvicorn app:lepra --host 127.0.0.1 --port 8000
```

En otra sesión SSH:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/docs
```

Debe devolver `200`. Pará uvicorn con `Ctrl+C`.

Al arrancar, `app.py` ejecuta `Base.metadata.create_all()` y **crea las tablas** en `lepra`.

### 2.5 Servicio systemd (API siempre encendida)

Creá `/etc/systemd/system/lepra-api.service`:

```ini
[Unit]
Description=Lepra FastAPI
After=network.target postgresql.service

[Service]
User=lepramg-store
Group=lepramg-store
WorkingDirectory=/home/lepramg-store/lepra-api/Backend
EnvironmentFile=/home/lepramg-store/lepra-api/Backend/.env
ExecStart=/home/lepramg-store/lepra-api/Backend/venv/bin/uvicorn app:lepra --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Activar:

```bash
systemctl daemon-reload
systemctl enable lepra-api
systemctl start lepra-api
systemctl status lepra-api
```

Comandos útiles:

```bash
systemctl restart lepra-api
journalctl -u lepra-api -n 50 --no-pager
journalctl -u lepra-api -f
```

### 2.6 Reverse proxy en CloudPanel (API pública)

1. CloudPanel → **Sites** → **Add Site**.
2. Tipo: **Reverse Proxy**.
3. Dominio: `api.lepramg.com` (el tuyo).
4. Destino: `http://127.0.0.1:8000`.
5. Activá **SSL** (Let's Encrypt).

Comprobá en el navegador: `https://api.lepramg.com/docs`

### 2.7 Crear usuario administrador

```bash
cd /home/lepramg-store/lepra-api/Backend
source venv/bin/activate
export $(grep -v '^#' .env | xargs)
python scripts/create_admin.py
```

Por defecto: `admin@lepra.local` / `admin123` — **cambiá la contraseña** después del primer login.

Verificar en DB:

```bash
sudo -u postgres psql -d lepra -c "SELECT id, email, rol FROM users;"
```

### 2.8 Carpeta `uploads` y logo en PDF

La API crea sola la carpeta de imágenes de productos:

```text
/home/lepramg-store/lepra-api/Backend/uploads/
```

Las imágenes se optimizan al subir (WebP, máx. 1200 px, calidad 80). En el VPS **persisten** en disco.

URLs públicas: `https://api.lepramg.com/uploads/nombre.webp`

**Logo en comprobantes PDF:** el build del front genera `lepra-logo-watermark.png` (desde el PDF de marca). En el servidor debe existir en `uploads/` o en `branding/`.

#### Deploy manual (SFTP)

1. En tu PC, después del build del front (Parte 3.2), copiá el PNG al backend antes o después de subir por SFTP:

   ```text
   Frontend/public/branding/lepra-logo-watermark.png
     → /home/lepramg-store/lepra-api/Backend/branding/lepra-logo-watermark.png
   ```

2. En el VPS:

   ```bash
   cd /home/lepramg-store/lepra-api/Backend
   source venv/bin/activate
   python3 scripts/sync_branding_logo.py
   ```

   Eso copia el PNG a `uploads/lepra-logo-watermark.png`.

> En el servidor **no** está la carpeta `Frontend/` del repo. `sync_branding_logo.py` no puede leer `../Frontend/...` salvo que subas ese PNG a `Backend/branding/`.

#### Deploy con GitHub Actions

El workflow genera el PNG en el build, lo deja en `Backend/branding/` y ejecuta `sync_branding_logo.py` en el VPS tras cada deploy. No hace falta subir el PNG a mano.

El frontend usa `VITE_PDF_LOGO_URL=/uploads/lepra-logo-watermark.png` (sin pdf.js en el navegador).

---

## Parte 3 — Frontend (estático)

El front **no usa puerto propio** en producción. Es HTML/JS/CSS en Nginx (puertos 80/443).

### 3.1 Variable de la API (en tu PC)

Creá o editá `Frontend/.env`:

```env
VITE_API_URL=https://api.lepramg.com
VITE_PDF_LOGO_URL=/uploads/lepra-logo-watermark.png

# Pie de página del catálogo (dueño + Olivera.co)
VITE_CONTACT_LABEL=El Lepra
VITE_CONTACT_TAGLINE=Quesos y lácteos de calidad
VITE_OWNER_NAME=Maxi Laraburru
VITE_CONTACT_EMAIL=contacto@tudominio.com
VITE_CONTACT_PHONE=+54 9 11 0000-0000
VITE_CONTACT_WHATSAPP=5491100000000
VITE_DEVELOPER_NAME=Olivera.co
VITE_DEVELOPER_URL=https://olivera.co
```

Sin barra final. Vite la embebe en el build (no se lee en runtime en el servidor).

### 3.2 Build

En tu PC necesitás **Node 22** (misma versión que GitHub Actions) y **Python 3** con **PyMuPDF** — el script `prebuild` rasteriza el logo desde el PDF antes de `vite build`.

```bash
pip install pymupdf
cd Frontend
npm ci
npm run build
```

Salida: `Frontend/dist/` y `Frontend/public/branding/lepra-logo-watermark.png` (subilo a `Backend/branding/` en el VPS; ver §2.8).

El build incluye **`@vitejs/plugin-legacy`** (Chrome ≥81 / Android ≥4.4): genera bundles transpilados y polyfills además del shell PWA. Es normal que `dist/assets/` tenga más archivos y que el build tarde un poco más que una SPA solo moderna (ver §3.8).

**PowerShell** (alternativa sin `.env`):

```powershell
pip install pymupdf
$env:VITE_API_URL="https://api.lepramg.com"
npm ci
npm run build
```

Si `prebuild` falla con `No module named 'fitz'`, falta instalar pymupdf en el entorno Python que ejecuta `npm run build`.

### 3.3 Subir al servidor

Por SFTP, subí **el contenido completo de `dist/`** (no la carpeta `dist` entera) a:

```text
/home/lepramg-store/htdocs/store.lepramg.com/
```

Debe quedar `index.html`, carpeta `assets/` (incluye chunks **legacy** y `polyfills-*.js`), `sw.js`, `workbox-*.js`, `manifest.webmanifest`, etc. No subas solo un subconjunto de `assets/`.

### 3.4 Sitio en CloudPanel

- Tipo: **Static HTML** (o PHP si solo servís estáticos).
- Dominio: `store.lepramg.com`.
- SSL activado.

### 3.5 Regla SPA (React Router)

Si al recargar `/login` o `/productos` da 404, en CloudPanel → sitio del front → **Vhost** → añadí:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### 3.6 Caché del shell (PWA / deploy)

Tras cada deploy cambian los hashes en `/assets/`. Si Nginx o el navegador guardan `index.html` o el service worker en caché, ves errores de Workbox (`bad-precaching-response`, CSS 404).

En el **Vhost** del front, además de la regla SPA:

```nginx
location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
location ~ ^/(sw\.js|workbox-.*\.js|registerSW\.js)$ {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

Los archivos en `/assets/` pueden seguir con caché larga (tienen hash en el nombre).

### 3.7 PageSpeed (ngx_pagespeed) y avisos de «preload» en consola

Si en Chrome ves *«A preload for … is found, but is not used because the request credentials mode does not match»* en las líneas del `<script>` / `<link rel="stylesheet">` (no hace falta otro navegador ni borrar caché para reproducirlo), **no suele ser el HTML del build**: el sitio puede tener **ngx_pagespeed** activo (en CloudPanel aparece en URLs como `x….pagespeed.ic.….png`).

PageSpeed añade cabeceras HTTP del estilo:

```http
Link: </assets/index-….js>; rel=preload; as=script; nopush, </assets/vendor-….css>; rel=preload; as=style; nopush, …
```

Esos preload **no llevan `crossorigin`**, pero Vite emite `<script type="module" crossorigin>` y hojas con `crossorigin` → Chrome avisa y no usa el preload.

**Solución recomendada (SPA + PWA): desactivar PageSpeed en el front**

En el Vhost de `store.lepramg.com`:

```nginx
pagespeed off;
```

Si no podés apagarlo del todo, al menos:

```nginx
pagespeed DisableFilters hint_preload_subresources;
```

El `index.html` del repo incluye `<!-- pagespeed off -->` para que mod_pagespeed no reescriba esa página; si el módulo ignora el comentario, usá `pagespeed off;` en Nginx.

Comprobación (PowerShell):

```powershell
(Invoke-WebRequest "https://store.lepramg.com/" -UseBasicParsing).Headers["Link"]
```

Si devuelve varias líneas `rel=preload` hacia `/assets/…`, PageSpeed sigue activo.

### 3.8 Navegadores legacy (tablets admin)

El panel **admin offline** está pensado para **tablets viejas** (Chrome ≤81, Android 4.4). Eso afecta el deploy aunque no cambie la arquitectura del VPS.

| Pieza | Qué hace en producción |
|-------|-------------------------|
| `@vitejs/plugin-legacy` | Transpila el JS/CSS a targets `chrome >= 81`, `android >= 4.4` (`Frontend/package.json` → `browserslist`) |
| `renderModernChunks: false` | En `dist/` solo van bundles legacy (no hay “rama moderna” paralela) |
| `legacyBrowser.ts` | En clientes viejos: XHR para la API, UI con clases `.lepra-legacy-ui`, sin animaciones pesadas en gráficos |
| PWA | Service worker registrado desde la app (`pwaRegister.ts`), no desde `registerSW.js` en el HTML (evita carreras en Android 4.x) |
| API `/health` | Ping simple para probar conectividad desde dispositivos con stack HTTP limitado |

**Requisitos en el servidor (Nginx / CloudPanel):**

1. **HTTPS** en `store.*` — contexto seguro para service worker y PWA.
2. **Reglas §3.5–3.6** — SPA + no-cache en `index.html`, `sw.js` y `workbox-*.js`. Tras un deploy, si la tablet queda con shell viejo en caché, fallan login/sync (síntomas: 404 en CSS, `bad-precaching-response`).
3. **`pagespeed off`** (§3.7) — especialmente importante en Chrome 81; los preloads de PageSpeed rompen la carga de módulos/chunks.
4. **Subir `dist/` entero** — los chunks legacy tienen hash en el nombre pero deben estar todos en `assets/`; el workflow con `rsync --delete` está bien porque reemplaza el `dist/` completo.
5. **`CORS_ORIGINS`** en el backend si el dominio del front cambia — los clientes legacy usan XHR con CORS explícito.

**Verificación en dispositivo real (no solo Chrome de escritorio):**

- Login admin en la tablet objetivo.
- `https://api.lepramg.com/health` responde desde el navegador de la tablet.
- Modo offline admin: ver [Frontend/OFFLINE_ADMIN_QA.md](./Frontend/OFFLINE_ADMIN_QA.md) (mismas URLs de producción).

**Síntomas típicos si el deploy ignoró legacy:**

| Síntoma en tablet | Causa probable |
|-------------------|----------------|
| Pantalla en blanco tras deploy | Falta subir chunks legacy/polyfills o `index.html` cacheado |
| API no responde solo en tablet | CORS, SW viejo, o PageSpeed activo |
| UI “apretada” sin espacios | CSS legacy no cargó (404 en `assets/`) |
| Offline admin roto | `sw.js` / workbox en caché agresiva — revisar headers §3.6 |

---

## Parte 4 — Verificación final

| Prueba | Cómo |
|--------|------|
| API viva | `systemctl status lepra-api` → `active (running)` |
| Health | `curl -s https://api.lepramg.com/health` → `{"ok":true}` |
| API pública | `https://api.lepramg.com/docs` |
| Logo PDF | `https://api.lepramg.com/uploads/lepra-logo-watermark.png` → 200 |
| Tablas | `sudo -u postgres psql -d lepra -c "\dt"` |
| Login API | POST `/auth/login` en `/docs` |
| Front → API | F12 → Red → peticiones a `api.lepramg.com` |
| Login web | `https://store.lepramg.com` con admin |
| Imagen | Subir producto; URL `/uploads/....webp` |
| Tablet legacy | Login admin en dispositivo Chrome ≤81 / Android 4.4 (§3.8) |
| Offline admin | Sync + lectura offline según [OFFLINE_ADMIN_QA.md](./Frontend/OFFLINE_ADMIN_QA.md) |

---

## Parte 5 — Actualizar tras un cambio en `main`

### Automático (recomendado): GitHub Actions + SSH

Cada push a `main` despliega front + back. Configuración paso a paso:

**[DEPLOY_GITHUB.md](./DEPLOY_GITHUB.md)**

Resumen: secrets `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_PORT`, `VITE_API_URL` en el repo de GitHub. Tras migrar a un VPS nuevo, **actualizá `SSH_HOST` y `SSH_PORT`** antes del primer deploy automático.

### Manual (SFTP)

**Solo frontend:**

```bash
pip install pymupdf
cd Frontend
npm ci
npm run build
```

Subir contenido de `dist/` a `htdocs/store.lepramg.com/` y el PNG a `Backend/branding/` (§2.8).

**Solo backend:** subir cambios a `lepra-api/Backend/`, luego:

```bash
cd /home/lepramg-store/lepra-api/Backend
source venv/bin/activate
pip install -r requirements.txt
systemctl restart lepra-api
```

**No borres** la carpeta `uploads/` al actualizar.

---

## Troubleshooting

| Problema | Qué revisar |
|----------|-------------|
| API no responde | `systemctl status lepra-api`, `journalctl -u lepra-api` |
| Error de DB | `DATABASE_URL` en `.env`, Postgres activo |
| `INTERNAL_DATABASE_URL` en .env | Eliminar; solo `DATABASE_URL` en CloudPanel |
| CORS / login falla desde el front | `CORS_ORIGINS` en `.env` debe incluir la URL exacta del front (`https://store...`) |
| Front llama a URL vieja o localhost | Rebuild con `VITE_API_URL` y volver a subir `dist` |
| `npm run build` falla en prebuild | `pip install pymupdf` en la PC de build |
| Logo PDF 404 | PNG en `Backend/branding/` + `python3 scripts/sync_branding_logo.py` |
| 404 al recargar rutas | Regla `try_files` en Nginx |
| Imagen 404 | Archivo en `Backend/uploads/`, API en `api.` dominio |
| Permiso denegado en uploads | `chown -R lepramg-store:lepramg-store .../Backend/uploads` |
| GitHub Actions al VPS viejo | Actualizar secrets `SSH_HOST` / `SSH_PORT` tras migración |
| Tablet en blanco tras deploy | `dist/` completo en el servidor; no-cache en `index.html` / SW (§3.6); §3.8 |
| Solo la tablet falla, PC OK | PageSpeed (§3.7), CORS, o caché del service worker |
| No pegar en terminal web | Usar SSH desde Windows: `ssh root@IP`, pegar con clic derecho |
| Contraseña invisible al escribir | Normal en Linux; Enter al terminar |

---

## Referencia rápida de comandos

```bash
# Postgres
sudo -u postgres psql -d lepra -c "\dt"

# API
systemctl restart lepra-api
journalctl -u lepra-api -n 50 --no-pager
curl http://127.0.0.1:8000/docs

# Admin
cd /home/lepramg-store/lepra-api/Backend && source venv/bin/activate
export $(grep -v '^#' .env | xargs) && python scripts/create_admin.py
```

---

## Historial de hosting

Antes se usó **Render** (API + Postgres) y **Netlify** (frontend). Detalle: [HOSTING_HISTORY.md](./HOSTING_HISTORY.md).

---

*Última actualización: VPS suscripción duplicada, Node 22, pymupdf, branding, CORS, legacy tablets (§3.8), GitHub Actions.*
