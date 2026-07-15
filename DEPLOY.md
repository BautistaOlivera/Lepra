# Deploy — Lepra

**Guía de producción:** [DEPLOY_CLOUDPANEL.md](./DEPLOY_CLOUDPANEL.md) (incluye **VPS nuevo — suscripción duplicada**)

**Hosting anterior (Render + Netlify):** [HOSTING_HISTORY.md](./HOSTING_HISTORY.md)

---

## Producción actual

| Componente | URL / ruta |
|------------|------------|
| Frontend | `https://store.lepramg.com` |
| API | `https://api.lepramg.com` |
| Código API | `/home/lepramg-store/lepra-api/Backend/` |
| PostgreSQL | `localhost:5432` (mismo VPS) |

**Build:** Node 22 + `pip install pymupdf` antes de `npm run build` (incluye bundles **legacy** para tablets) · **Runtime API:** Python 3.12 recomendado.

Variables: `Backend/.env.example` → `.env` en el servidor · `Frontend/.env.example` → `.env` para el build.

**VPS nuevo (suscripción duplicada):** mismo plan CloudPanel, máquina vacía, deploy desde cero con [DEPLOY_CLOUDPANEL.md](./DEPLOY_CLOUDPANEL.md) § *VPS nuevo*. Al final: DNS al nuevo + secrets de GitHub (`SSH_HOST`, `SSH_PORT`). Traer DB/`uploads/` del viejo es opcional.

---

## Desarrollo local

```bash
# Backend
cd Backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app:lepra --reload --port 8000

# Frontend
cd Frontend
npm install
npm run dev
```

`.env` local: `DATABASE_URL` o `DB_*` · `VITE_API_URL=http://localhost:8000`

---

## Deploy automático (GitHub)

Push a `main` → GitHub Actions despliega por SSH.

**[DEPLOY_GITHUB.md](./DEPLOY_GITHUB.md)** — clave SSH, secrets y primera ejecución.

---

## Tests

```bash
cd Backend && pytest
cd Frontend && npm test
```

---

## Más documentación

| Archivo | Contenido |
|---------|-----------|
| [DEPLOY_CLOUDPANEL.md](./DEPLOY_CLOUDPANEL.md) | Deploy completo en VPS (+ suscripción duplicada, legacy §3.8) |
| [DEPLOY_GITHUB.md](./DEPLOY_GITHUB.md) | CI/CD con GitHub Actions |
| [HOSTING_HISTORY.md](./HOSTING_HISTORY.md) | Render / Netlify (histórico) |
| [Frontend/OFFLINE_ADMIN_QA.md](./Frontend/OFFLINE_ADMIN_QA.md) | QA offline admin |
