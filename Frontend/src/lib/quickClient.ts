/** Cliente rápido al crear pedido (solo nombre; sin login). */

export function slugifyClientName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function buildQuickClientEmail(name: string): string {
  const slug = slugifyClientName(name) || 'cliente'
  const suffix = Date.now().toString(36)
  return `${slug}-${suffix}@pedido.local`
}

export function buildQuickClientPassword(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 20)
  }
  return `tmp${Date.now()}${Math.random().toString(36).slice(2, 10)}`
}

export function findUserByClientQuery(
  users: { id: number; name?: string | null; email: string }[],
  query: string
): { id: number; name?: string | null; email: string } | undefined {
  const q = query.trim().toLowerCase()
  if (!q) return undefined
  return users.find((u) => {
    const name = (u.name || '').trim().toLowerCase()
    const email = u.email.trim().toLowerCase()
    const combined = [name, email].filter(Boolean).join(' — ').toLowerCase()
    return name === q || email === q || combined === q
  })
}

export const PEDIDO_NEW_USER_CLOSE_DELAY_MS = 3200

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
