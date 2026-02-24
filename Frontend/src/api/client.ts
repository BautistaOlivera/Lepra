const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getToken(): string | null {
  return localStorage.getItem('lepra_token')
}

/** URL absoluta para imágenes del backend (uploads relativos) */
export function getImageUrl(img: string | null | undefined): string {
  if (!img) return ''
  if (img.startsWith('http')) return img
  const base = API_BASE.replace(/\/$/, '')
  const path = img.startsWith('/') ? img : `/${img}`
  return `${base}${path}`
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: { status: number; message: string } }> {
  const token = getToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { error: { status: res.status, message: json.message || res.statusText } }
    }
    return { data: json as T }
  } catch (err) {
    return { error: { status: 0, message: (err as Error).message } }
  }
}

/** Llamada para subir archivos (multipart). No usa Content-Type JSON. */
export async function apiUpload<T>(
  path: string,
  formData: FormData
): Promise<{ data?: T; error?: { status: number; message: string } }> {
  const token = getToken()
  const headers: HeadersInit = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body: formData, headers })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { error: { status: res.status, message: json.message || res.statusText } }
    return { data: json as T }
  } catch (err) {
    return { error: { status: 0, message: (err as Error).message } }
  }
}
