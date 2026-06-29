import { extractApiErrorMessage, formatNetworkErrorMessage } from '@/lib/networkErrors'
import { httpRequest, xhrRequest } from '@/lib/httpTransport'
import { isLegacyClient } from '@/lib/legacyBrowser'

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

function buildHeaders(options: RequestInit): HeadersInit {
  const headers: Record<string, string> = {}
  if (options.body != null && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  const extra = options.headers
  if (extra instanceof Headers) {
    extra.forEach((v, k) => {
      headers[k] = v
    })
  } else if (Array.isArray(extra)) {
    for (const [k, v] of extra) headers[k] = v
  } else if (extra) {
    Object.assign(headers, extra)
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function request(url: string, options: RequestInit = {}): Promise<{
  ok: boolean
  status: number
  statusText: string
  json: () => Promise<unknown>
}> {
  const init: RequestInit = {
    ...options,
    headers: buildHeaders(options),
    // JWT va en Authorization, no en cookies — omit evita choque CORS con ACAO *.
    credentials: 'omit',
    mode: 'cors',
  }

  if (isLegacyClient()) {
    try {
      return await xhrRequest(url, init)
    } catch (xhrErr) {
      try {
        return await httpRequest(url, init)
      } catch {
        throw xhrErr
      }
    }
  }

  return httpRequest(url, init)
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: { status: number; message: string } }> {
  try {
    const res = await request(`${API_BASE}${path}`, options)
    const json = (await res.json().catch(() => ({}))) as { message?: string; detail?: unknown }
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        try {
          localStorage.setItem('lepra_auth_required', '1')
          window.dispatchEvent(new Event('lepra-auth-required'))
        } catch {
          // ignore
        }
      }
      return {
        error: {
          status: res.status,
          message: extractApiErrorMessage(json, res.status, res.statusText),
        },
      }
    }
    try {
      localStorage.removeItem('lepra_auth_required')
    } catch {
      // ignore
    }
    return { data: json as T }
  } catch (err) {
    return { error: { status: 0, message: formatNetworkErrorMessage(err) } }
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
    const res = await request(`${API_BASE}${path}`, { method: 'POST', body: formData, headers })
    const json = (await res.json().catch(() => ({}))) as { message?: string; detail?: unknown }
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        try {
          localStorage.setItem('lepra_auth_required', '1')
          window.dispatchEvent(new Event('lepra-auth-required'))
        } catch {
          // ignore
        }
      }
      return {
        error: {
          status: res.status,
          message: extractApiErrorMessage(json, res.status, res.statusText),
        },
      }
    }
    try {
      localStorage.removeItem('lepra_auth_required')
    } catch {
      // ignore
    }
    return { data: json as T }
  } catch (err) {
    return { error: { status: 0, message: formatNetworkErrorMessage(err) } }
  }
}
