# Deploy Backend (El Lepra API) to Render

## Opción 1: Blueprint (recomendado)

1. Entra en [Render Dashboard](https://dashboard.render.com/) y conecta el repo de GitHub/GitLab.
2. **New → Blueprint**.
3. Selecciona el repo y confirma que use el archivo `render.yaml` en la raíz del repo.
4. Render creará:
   - Una base **PostgreSQL** (`lepra-db`).
   - Un **Web Service** (`lepra-api`) que usa `Backend/` como raíz, instala dependencias y arranca con `uvicorn`.
5. **SECRET_KEY** se genera solo; si quieres una fija, en el servicio **lepra-api → Environment** cambia `SECRET_KEY` por un valor que tú definas (y borra el que generó Render).
6. Tras el primer deploy, la API quedará en `https://lepra-api.onrender.com` (o el nombre que tenga tu servicio).

## Opción 2: Manual (sin Blueprint)

1. **PostgreSQL**
   - **New → PostgreSQL**. Crea una base (ej. `lepra-db`).
   - En la base, copia **Internal Database URL** (mejor si el backend está en la misma región).

2. **Web Service**
   - **New → Web Service**, repo y rama.
   - **Root Directory**: `Backend`.
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app:lepra --host 0.0.0.0 --port $PORT`
   - **Environment**:
     - `DATABASE_URL` = Internal Database URL (pegado desde lepra-db).
     - `SECRET_KEY` = una clave larga y aleatoria (ej. generada con `openssl rand -hex 32`).

## Crear el primer usuario admin

Después del primer deploy, crea un usuario administrador:

**En Render (recomendado):** Servicio **lepra-api** → pestaña **Shell** → ejecuta:

```bash
python scripts/create_admin.py
```

Por defecto crea: `admin@lepra.local` / `admin123`. **Cambia la contraseña** tras el primer login en producción.

**Con email/contraseña propios:** En el servicio lepra-api → **Environment** añade `ADMIN_EMAIL`, `ADMIN_PASSWORD` y opcionalmente `ADMIN_NAME`. Luego en Shell ejecuta de nuevo `python scripts/create_admin.py`.

**Desde tu PC:** Usa la **External Database URL** de lepra-db, así en la terminal (desde la carpeta `Backend`):

```bash
export DATABASE_URL="postgresql://..."
python scripts/create_admin.py
```

## Frontend (Netlify)

Configuración detallada en **Frontend/NETLIFY.md**. Resumen:

- **Base directory:** `Frontend`
- **Variable de entorno:** `VITE_API_URL` = URL de tu API en Render (ej. `https://lepra-api.onrender.com`, sin barra final)
- Después de cambiar `VITE_API_URL`, haz un nuevo deploy para que el build use la nueva URL.

## Notas

- **CORS**: La API tiene `allow_origins=["*"]`. Para producción puedes restringirlo al dominio del frontend en Netlify.
- **Uploads**: La ruta `/uploads` usa el disco del servicio. En Render el sistema de archivos es efímero; si necesitas persistencia, usa un almacenamiento externo (p. ej. S3).
- **Free tier**: El servicio free se “duerme” tras inactividad; la primera petición puede tardar unos segundos en responder.

## Issue conocido: imágenes (uploads) se “pierden” en Render Free

En el deploy gratuito de Render, los archivos guardados localmente en el servicio (por ejemplo `Backend/uploads/`) pueden desaparecer tras un tiempo porque el filesystem del servicio es **efímero** (sleep/restart/redeploy).

- **Síntoma**: la DB mantiene la ruta/URL, pero al pedirla la API devuelve 404 porque el archivo ya no está.
- **Decisión para producción** (antes de entregar):
  - **Opción A (recomendada)**: mover uploads a storage externo (S3 / Cloudflare R2 / Supabase Storage) y guardar en DB la URL o key.
  - **Opción B**: usar un hosting con **disco persistente** (en Render, Persistent Disk) y montar una ruta fija para uploads.
