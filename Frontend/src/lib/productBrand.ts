/** Normalización de marca de producto (frontend). */

function brandKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

/** Si ya existe una marca igual sin importar mayúsculas, reutiliza esa. */
export function canonicalizeBrand(raw: string, knownBrands: string[]): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const key = brandKey(trimmed)
  const hit = knownBrands.find((b) => brandKey(b) === key)
  return hit ?? trimmed
}

export function brandKeysEqual(a: string, b: string): boolean {
  return brandKey(a) === brandKey(b)
}
