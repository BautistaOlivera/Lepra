# Deploy automático con GitHub Actions (SSH)

Cada **push a `main`** (o ejecución manual) hace:

1. Build del frontend con `VITE_API_URL`
2. **rsync** del `Backend/` al VPS (sin borrar `uploads/` ni `.env`)
3. **rsync** de `Frontend/dist/` al sitio estático
4. `pip install` + `systemctl restart lepra-api`

Workflow: [.github/workflows/deploy.yml](./.github/workflows/deploy.yml)

---

## 1. Clave SSH para GitHub

En tu PC (PowerShell o Git Bash):

```bash
ssh-keygen -t ed25519 -C "github-deploy-lepra" -f lepra_deploy_key -N ""
```

Quedan dos archivos:

- `lepra_deploy_key` → **privada** (solo GitHub Secrets)
- `lepra_deploy_key.pub` → **pública** (va al servidor)

---

## 2. Autorizar la clave en el VPS

Por SSH como **root**:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
```

Pegá el contenido de `lepra_deploy_key.pub` (una línea), guardá.

```bash
chmod 600 ~/.ssh/authorized_keys
```

Probar desde tu PC (si tu proveedor usa otro puerto SSH, agregá `-p PUERTO`):

```bash
ssh -p 5742 -i C:/Users/Juani/Desktop/Bau/lepra_deploy_key root@138.36.239.140
```

Tiene que entrar sin pedir contraseña (igual que tu acceso habitual, pero con la clave en lugar de contraseña si ya la tenías configurada).

> Usá usuario **`root`** en GitHub si el workflow reinicia `systemctl`. El servicio `lepra-api` sigue corriendo como `lepramg-store`.

---

## 3. Secrets en GitHub

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret | Valor | Ejemplo |
|--------|--------|---------|
| `SSH_HOST` | IP o hostname del VPS | `138.36.239.140` |
| `SSH_PORT` | Puerto SSH (no el 22 por defecto en muchos VPS) | `5742` |
| `SSH_USER` | Usuario SSH | `root` |
| `SSH_PRIVATE_KEY` | Contenido completo de `lepra_deploy_key` | `-----BEGIN OPENSSH PRIVATE KEY-----` … |
| `VITE_API_URL` | URL pública de la API (sin `/` final) | `https://api.lepramg.com` |

Para `SSH_PRIVATE_KEY`: copiá el archivo privado entero, incluyendo las líneas `BEGIN` y `END`.

---

## 4. Primera vez en el servidor

Antes del primer deploy automático, el servidor ya debe tener:

- PostgreSQL + base `lepra`
- `.env` en `/home/lepramg-store/lepra-api/Backend/.env` (no está en Git)
- Servicio `lepra-api` creado (`systemctl`)

Ver [DEPLOY_CLOUDPANEL.md](./DEPLOY_CLOUDPANEL.md) si falta algo.

---

## 5. Probar el deploy

1. Hacé un commit y push a `main`, **o**
2. GitHub → **Actions** → **Deploy to VPS** → **Run workflow**

Revisá el log del job. Al final debe decir `lepra-api is active`.

Comprobá:

- `https://api.lepramg.com/docs`
- `https://store.lepramg.com`

---

## Qué no toca el workflow

| En el servidor | Motivo |
|----------------|--------|
| `Backend/.env` | Secretos; solo en el VPS |
| `Backend/uploads/` | Imágenes ya subidas |
| `Backend/venv/` | Se reutiliza; solo `pip install` |

---

## Deploy manual (alternativa)

Seguí usando SFTP + `systemctl restart` como en [DEPLOY_CLOUDPANEL.md](./DEPLOY_CLOUDPANEL.md) Parte 5.

---

## Problemas frecuentes

| Error | Solución |
|-------|----------|
| `Connection timed out` en puerto 22 | Agregá secret `SSH_PORT` (ej. `5742`) y usá `-p` al probar en tu PC |
| `Permission denied (publickey)` | Revisá `SSH_PRIVATE_KEY` y `authorized_keys` en el VPS |
| `systemctl: command not found` o falla restart | `SSH_USER` debe ser `root` (o sudo sin password) |
| Front llama a API vieja | Secret `VITE_API_URL` correcto; re-run workflow |
| `pip` / `venv` falla | En el VPS: `apt install python3-venv python3-pip` |
| rsync no encontrado | En el runner de GitHub ya está; en VPS no hace falta para pull |

---

## Cambiar rutas o rama

Editá variables al inicio de `.github/workflows/deploy.yml`:

```yaml
on:
  push:
    branches: [main]   # otra rama si querés

env:
  REMOTE_BACKEND: /home/lepramg-store/lepra-api/Backend
  REMOTE_FRONTEND: /home/lepramg-store/htdocs/store.lepramg.com
```
