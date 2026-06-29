/** Mensaje legible cuando fetch()/XHR falla antes de obtener respuesta HTTP. */
export function formatNetworkErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const trimmed = raw.trim()
  if (!trimmed) {
    return 'No se pudo conectar con el servidor (sin respuesta).'
  }
  return trimmed
}

type ApiErrorJson = {
  message?: unknown
  detail?: unknown
}

/** Mensaje de error desde el cuerpo JSON de la API (FastAPI: message o detail). */
export function extractApiErrorMessage(
  json: ApiErrorJson,
  status: number,
  statusText: string,
): string {
  if (typeof json.message === 'string' && json.message.trim()) {
    return json.message.trim()
  }

  const detail = json.detail
  if (typeof detail === 'string' && detail.trim()) {
    return detail.trim()
  }
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item && typeof item.msg === 'string') {
          return item.msg
        }
        return null
      })
      .filter((s): s is string => Boolean(s))
    if (parts.length > 0) return parts.join('; ')
  }

  if (statusText.trim()) return statusText.trim()
  return `Error del servidor (${status})`
}
