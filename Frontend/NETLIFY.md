# Desplegar Frontend (Lepra) en Netlify

## 1. Conectar el repositorio

1. Entra en [Netlify](https://app.netlify.com/) e inicia sesión.
2. **Add new site → Import an existing project**.
3. Conecta GitHub/GitLab y elige el repo **Lepra**.
4. Configura el **build** así:
   - **Base directory:** `Frontend` (importante: la app está en esta carpeta).
   - **Build command:** `npm run build` (o déjalo vacío si usas `netlify.toml`).
   - **Publish directory:** `Frontend/dist` (o solo `dist` si Netlify ya usa `Frontend` como base).

Si tienes `Frontend/netlify.toml`, Netlify usará ese `command` y `publish`; solo asegúrate de que **Base directory** sea `Frontend`.

## 2. Variable de entorno (API del backend)

El frontend usa la variable **`VITE_API_URL`** para llamar al backend (Render).

1. En tu sitio en Netlify: **Site configuration → Environment variables** (o **Build & deploy → Environment**).
2. **Add a variable** (o **Add single variable** / **Add multiple**):
   - **Key:** `VITE_API_URL`
   - **Value:** la URL de tu API en Render, **sin barra final**, por ejemplo:
     ```text
     https://lepra-api.onrender.com
     ```
3. **Save** (o **Create variable**).

Importante: en Vite las variables `VITE_*` se inyectan en el **build**. Después de añadir o cambiar `VITE_API_URL` hay que hacer un **nuevo deploy** (Trigger deploy → Deploy site o push a tu rama) para que el cambio se aplique.

## 3. Deploy

- **Deploys automáticos:** cada push a la rama que tengas configurada (p. ej. `main`) generará un deploy.
- **Deploy manual:** **Deploys → Trigger deploy → Deploy site**.

Tras el deploy, la URL del sitio será algo como `https://nombre-random.netlify.app`. Puedes cambiar el nombre en **Domain management** o conectar un dominio propio.

## Resumen rápido

| Dónde        | Qué poner |
|-------------|-----------|
| Base directory | `Frontend` |
| Build command   | `npm run build` (o vacío con netlify.toml) |
| Publish directory | `dist` (relativo a Base directory) |
| Variable `VITE_API_URL` | `https://lepra-api.onrender.com` (tu URL de Render) |

## SPA y rutas

El `netlify.toml` (en la raíz del repo o en `Frontend/`) incluye un redirect `/* → /index.html` (status 200) para que React Router funcione al recargar o entrar por una ruta directa.

---

## Si no funciona (troubleshooting)

### El build falla en Netlify

1. **Revisa el log del deploy:** Deploys → el último deploy → "Build log". Ahí verás si falla `npm run build`, TypeScript o algo más.
2. **Hay un `netlify.toml` en la raíz del repo** que pone `base = "Frontend"`. Con eso Netlify ya usa la carpeta correcta; no hace falta tocar Base directory en la UI (pero si lo pones, que sea `Frontend`).
3. **Node:** En el `netlify.toml` de la raíz está `NODE_VERSION = "20"`. Si tu proyecto pide otra versión, cámbiala ahí o en Netlify → Build & deploy → Environment → NODE_VERSION.
4. **Variables en el build:** Si falta `VITE_API_URL`, el build puede pasar pero la app en producción no llamará a tu API. Añádela en Site configuration → Environment variables y vuelve a desplegar.

### La página sale en blanco o "Page Not Found"

- Asegúrate de que **Publish directory** sea `dist` (o vacío si usas el `netlify.toml` de la raíz, que ya lo define).
- Si entras por una ruta tipo `/login` o `/productos` y falla, el redirect SPA (`/* → /index.html`) debe estar activo. Comprueba que el `netlify.toml` de la raíz esté en el repo y que Netlify no lo ignore.

### La app carga pero el login/API no funciona

- **VITE_API_URL** tiene que ser exactamente la URL del backend, **sin barra final**: `https://lepra-api.onrender.com`.
- Después de cambiar cualquier variable `VITE_*`, hay que **volver a desplegar** (Trigger deploy), porque Vite las mete en el build.
- Si ves errores de CORS en la consola del navegador, el backend (Render) ya tiene `allow_origins=["*"]`; si lo cambiaste, incluye la URL de tu sitio Netlify.

### Resumen de comprobaciones

| Comprobación | Dónde |
|--------------|--------|
| Build usa la carpeta Frontend | `netlify.toml` en raíz con `base = "Frontend"` (ya está) |
| Variable de la API | Site configuration → Environment variables → `VITE_API_URL` |
| Re-deploy tras cambiar env | Deploys → Trigger deploy → Deploy site |
| Log del build | Deploys → último deploy → Build log |
