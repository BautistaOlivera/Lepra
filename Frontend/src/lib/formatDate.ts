import { parseUtcFromApi } from '@/lib/dateApi'

/** Locale de visualización (Argentina). El API sigue usando ISO `YYYY-MM-DD` / UTC en timestamps. */
export const AR_LOCALE = 'es-AR' as const

const dateDisplay = new Intl.DateTimeFormat(AR_LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const dateTimeDisplay = new Intl.DateTimeFormat(AR_LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const dateMonthShort = new Intl.DateTimeFormat(AR_LOCALE, {
  day: 'numeric',
  month: 'short',
})

/** Fecha calendario: dd/mm/aaaa */
export function formatDateAR(date: Date): string {
  if (!Number.isFinite(date.getTime())) return '—'
  return dateDisplay.format(date)
}

/** Fecha y hora en formato argentino */
export function formatDateTimeAR(date: Date): string {
  if (!Number.isFinite(date.getTime())) return '—'
  return dateTimeDisplay.format(date)
}

/** Timestamp ISO del API → dd/mm/aaaa (fechas `YYYY-MM-DD` sin corrimiento por huso). */
export function formatDateFromApi(iso: string | null | undefined): string {
  if (iso == null || String(iso).trim() === '') return '—'
  const s = String(iso).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return isoDateToDisplay(s) || '—'
  }
  const d = parseUtcFromApi(s)
  return d ? formatDateAR(d) : '—'
}

/** `YYYY-MM-DD` (filtros API) → texto `dd/mm/aaaa` */
export function isoDateToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return ''
  return `${m[3]}/${m[2]}/${m[1]}`
}

/** `dd/mm/aaaa` → `YYYY-MM-DD` o null si no es válida */
/** `YYYY-MM-DD` → Date local para el calendario (mediodía evita saltos de huso). */
export function isoToPickerDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

/** Día elegido en el calendario → `YYYY-MM-DD` para el API. */
export function pickerDateToIso(date: Date): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function displayDateToIso(display: string): string | null {
  const t = display.trim()
  if (!t) return null
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1000) return null
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Etiqueta corta para gráficos (ej. `16 may`). */
export function formatShortDateFromIso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return dateMonthShort.format(new Date(Date.UTC(y, m - 1, d)))
}

export function startOfIsoDayMs(iso: string): number {
  return parseUtcFromApi(iso)?.getTime() ?? -Infinity
}

export function endOfIsoDayMs(iso: string): number {
  const start = parseUtcFromApi(iso)
  if (!start) return Infinity
  return start.getTime() + 86_400_000 - 1
}
