# Historial de hosting — Lepra

Este archivo documenta el hosting **anterior** y el **actual**. Las guías operativas están solo en [DEPLOY_CLOUDPANEL.md](./DEPLOY_CLOUDPANEL.md).

---

## Actual (desde 2026)

**Un solo VPS con CloudPanel** (Ubuntu, DattaWeb u otro proveedor).

| Pieza | Cómo |
|-------|------|
| **Frontend** | Build Vite (`npm run build`) → archivos estáticos en `htdocs/store.lepramg.com` |
| **API** | FastAPI + uvicorn en `127.0.0.1:8000`, servicio `systemd` `lepra-api` |
| **Base de datos** | PostgreSQL instalado en el mismo servidor (`localhost:5432`) |
| **Dominios** | `store.lepramg.com` (tienda), `api.lepramg.com` (API + `/uploads`) |
| **Imágenes** | Disco persistente en `Backend/uploads/` (WebP optimizado al subir) |

Variables: `Backend/.env` (`DATABASE_URL`, `SECRET_KEY`) y `Frontend/.env` (`VITE_API_URL`).

---

## Anterior (Render + Netlify)

Antes del VPS, el proyecto se desplegaba en dos servicios separados:

### Backend — [Render](https://render.com)

- **Web Service** Python: carpeta `Backend/`, `uvicorn app:lepra --port $PORT`
- **PostgreSQL** gestionado por Render (`lepra-db`)
- Variables: `DATABASE_URL` o `INTERNAL_DATABASE_URL`, `SECRET_KEY` auto-generada
- URL típica: `https://lepra-api.onrender.com`
- Blueprint: archivo `render.yaml` en la raíz del repo (ya eliminado)

**Limitaciones que motivaron el cambio:**

- Plan free: el servicio **se dormía** con inactividad (primera petición lenta).
- **Uploads efímeros:** imágenes en `Backend/uploads/` podían **perderse** tras restart/redeploy.
- Coste y control limitado frente a un VPS propio.

### Frontend — [Netlify](https://netlify.com)

- Build: `npm run build` desde `Frontend/`
- Publish: carpeta `dist/`
- Variable de build: `VITE_API_URL` → URL de la API en Render
- Config: `netlify.toml` (raíz y/o `Frontend/`) con redirect SPA (ya eliminados)
- Node 20 en el build

**Flujo típico:** push a `main` → Netlify rebuild → front nuevo apuntando a la API en Render.

---

## Migración resumida

| Antes | Ahora |
|-------|--------|
| API en Render | API en VPS (`systemd`) |
| Postgres en Render | Postgres local en VPS |
| Front en Netlify | Front estático en CloudPanel |
| `INTERNAL_DATABASE_URL` | Solo `DATABASE_URL` → `localhost` |
| Deploy automático Netlify/Render | Manual: build + SFTP (+ GitHub Actions pendiente) |

---

## Archivos eliminados del repo

Al pasar a CloudPanel se quitaron configuraciones que ya no se usan:

- `render.yaml`
- `netlify.toml` (raíz)
- `Frontend/netlify.toml`
- `Backend/DEPLOY.md` / `DEPLOY_RENDER.md`
- `Frontend/NETLIFY.md`

Si necesitás volver a Render o Netlify, recuperalos desde el historial de Git de este repositorio.

---

## Documentación vigente

| Archivo | Uso |
|---------|-----|
| [DEPLOY.md](./DEPLOY.md) | Índice de deploy |
| [DEPLOY_CLOUDPANEL.md](./DEPLOY_CLOUDPANEL.md) | Guía paso a paso (producción) |
| Este archivo | Contexto histórico |
