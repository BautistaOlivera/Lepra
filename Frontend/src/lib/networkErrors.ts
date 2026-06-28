const NETWORK_ERROR_PATTERNS = [
  /^failed to fetch$/i,
  /^networkerror/i,
  /^network request failed$/i,
  /^load failed$/i,
  /^the operation was aborted\.?$/i,
]

/** Mensaje legible cuando fetch() falla (TLS, DNS, sin red, etc.). */
export function formatNetworkErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const trimmed = raw.trim()
  if (!trimmed) {
    return 'No se pudo conectar con el servidor. Revisá internet o probá abrir la API en el navegador.'
  }
  if (NETWORK_ERROR_PATTERNS.some((re) => re.test(trimmed))) {
    return 'No se pudo conectar con el servidor. Revisá internet o que el certificado HTTPS sea válido en este dispositivo.'
  }
  return trimmed
}
