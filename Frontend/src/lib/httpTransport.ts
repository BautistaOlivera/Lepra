type HttpResult = {
  ok: boolean
  status: number
  statusText: string
  json: () => Promise<unknown>
}

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {}
  if (headers instanceof Headers) {
    const out: Record<string, string> = {}
    headers.forEach((v, k) => {
      out[k] = v
    })
    return out
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }
  return { ...headers }
}

/** XHR para WebViews viejos donde fetch() falla con CORS o por service worker. */
export function xhrRequest(url: string, options: RequestInit = {}): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(options.method || 'GET', url, true)
    const headers = headersToRecord(options.headers)
    Object.entries(headers).forEach(([k, v]) => {
      xhr.setRequestHeader(k, v)
    })
    xhr.onload = () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        statusText: xhr.statusText,
        json: async () => {
          const text = xhr.responseText || '{}'
          return text ? JSON.parse(text) : {}
        },
      })
    }
    xhr.onerror = () => reject(new Error('NetworkError'))
    xhr.ontimeout = () => reject(new Error('NetworkError'))
    xhr.send((options.body as string | undefined) ?? null)
  })
}

export async function httpRequest(url: string, options: RequestInit = {}): Promise<HttpResult> {
  if (typeof fetch === 'undefined') {
    return xhrRequest(url, options)
  }
  const res = await fetch(url, options)
  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    json: () => res.json(),
  }
}
