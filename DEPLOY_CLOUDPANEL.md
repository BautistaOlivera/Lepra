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
├── config/
├── routes/
├── models/
├── auth/
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

### 2.3 Archivo `.env`

Creá `/home/lepramg-store/lepra-api/Backend/.env`:

```env
DATABASE_URL=postgresql://lepra_user:TU_PASSWORD_SEGURA@localhost:5432/lepra
SECRET_KEY=GENERA_UNA_CLAVE_LARGA

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

### 2.8 Carpeta `uploads` (imágenes)

La API crea sola:

```text
/home/lepramg-store/lepra-api/Backend/uploads/
```

Las imágenes se optimizan al subir (WebP, máx. 1200 px, calidad 80). En el VPS **persisten** en disco.

URLs públicas: `https://api.lepramg.com/uploads/nombre.webp`

---

## Parte 3 — Frontend (estático)

El front **no usa puerto propio** en producción. Es HTML/JS/CSS en Nginx (puertos 80/443).

### 3.1 Variable de la API (en tu PC)

Creá o editá `Frontend/.env`:

```env
VITE_API_URL=https://api.lepramg.com
```

Sin barra final. Vite la embebe en el build (no se lee en runtime en el servidor).

### 3.2 Build

En tu PC (Node **20**):

```bash
cd Frontend
npm ci
npm run build
```

Salida: `Frontend/dist/`

**PowerShell** (alternativa sin `.env`):

```powershell
$env:VITE_API_URL="https://api.lepramg.com"
npm run build
```

### 3.3 Subir al servidor

Por SFTP, subí **el contenido de `dist/`** (no la carpeta `dist` entera) a:

```text
/home/lepramg-store/htdocs/store.lepramg.com/
```

Debe quedar `index.html`, carpeta `assets/`, etc.

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

---

## Parte 4 — Verificación final

| Prueba | Cómo |
|--------|------|
| API viva | `systemctl status lepra-api` → `active (running)` |
| API pública | `https://api.lepramg.com/docs` |
| Tablas | `sudo -u postgres psql -d lepra -c "\dt"` |
| Login API | POST `/auth/login` en `/docs` |
| Front → API | F12 → Red → peticiones a `api.lepramg.com` |
| Login web | `https://store.lepramg.com` con admin |
| Imagen | Subir producto; URL `/uploads/....webp` |

### Prueba de carga ligera (opcional)

En tu PC, desde la raíz del repo:

```powershell
powershell -File scripts/load-test.ps1
```

Más peticiones:

```powershell
powershell -File scripts/load-test.ps1 -Requests 50
```

---

## Parte 5 — Actualizar tras un cambio en `main`

### Automático (recomendado): GitHub Actions + SSH

Cada push a `main` despliega front + back. Configuración paso a paso:

**[DEPLOY_GITHUB.md](./DEPLOY_GITHUB.md)**

Resumen: secrets `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `VITE_API_URL` en el repo de GitHub.

### Manual (SFTP)

**Solo frontend:**

```bash
cd Frontend
npm run build
```

Subir contenido de `dist/` a `htdocs/store.lepramg.com/`.

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
| Front llama a URL vieja o localhost | Rebuild con `VITE_API_URL` y volver a subir `dist` |
| 404 al recargar rutas | Regla `try_files` en Nginx |
| Imagen 404 | Archivo en `Backend/uploads/`, API en `api.` dominio |
| Permiso denegado en uploads | `chown -R lepramg-store:lepramg-store .../Backend/uploads` |
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

*Última actualización: deploy en CloudPanel con PostgreSQL local, systemd y front estático.*
