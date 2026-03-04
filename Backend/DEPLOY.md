# Deploy Backend (Lepra API) to Render

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

## Frontend (Netlify)

En el frontend, configura la variable de entorno con la URL del backend en Render, por ejemplo:

- `VITE_API_URL=https://lepra-api.onrender.com`

(o el nombre real de tu servicio en Render).

## Notas

- **CORS**: La API tiene `allow_origins=["*"]`. Para producción puedes restringirlo al dominio del frontend en Netlify.
- **Uploads**: La ruta `/uploads` usa el disco del servicio. En Render el sistema de archivos es efímero; si necesitas persistencia, usa un almacenamiento externo (p. ej. S3).
- **Free tier**: El servicio free se “duerme” tras inactividad; la primera petición puede tardar unos segundos en responder.
