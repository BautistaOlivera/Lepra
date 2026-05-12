/**
 * El backend guarda datetimes en UTC sin tz (naive) y antes los serializaba sin sufijo `Z`.
 * `new Date('2026-05-12T15:30:00')` en JS se interpreta como hora *local*, desfasando la hora.
 */
export function parseUtcFromApi(iso: string | null | undefined): Date | null {
  if (iso == null || String(iso).trim() === '') return null
  const s = String(iso).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T00:00:00Z`)
  }
  if (s.includes('T') && !/[zZ]$/.test(s) && !/[+-]\d{2}/.test(s.slice(10))) {
    return new Date(`${s}Z`)
  }
  return new Date(s)
}
