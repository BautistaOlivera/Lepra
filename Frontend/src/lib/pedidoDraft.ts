import type { ClientePedidoValue } from '@/components/ClientePedidoSelect'

const STORAGE_KEY = 'lepra.pedidoDraft.v1'

export type PedidoDraftLine = {
  id_product: number
  weight: string
  price: string
}

export type PedidoDraft = {
  client: ClientePedidoValue | null
  lines: PedidoDraftLine[]
  extraAmount: string
  extraNote: string
}

export function isPedidoDraftMeaningful(draft: PedidoDraft): boolean {
  if (draft.client) {
    if (draft.client.kind === 'existing') return true
    if (draft.client.kind === 'new' && draft.client.name.trim().length > 0) return true
  }
  if (draft.lines.some((l) => l.id_product !== 0 || l.weight.trim() || l.price.trim())) {
    return true
  }
  if (draft.extraAmount.trim() || draft.extraNote.trim()) return true
  return false
}

export function loadPedidoDraft(): PedidoDraft | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PedidoDraft
    if (!parsed || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed.lines)) return null
    return {
      client: parsed.client ?? null,
      lines: parsed.lines.map((l) => ({
        id_product: Number(l.id_product) || 0,
        weight: String(l.weight ?? ''),
        price: String(l.price ?? ''),
      })),
      extraAmount: String(parsed.extraAmount ?? ''),
      extraNote: String(parsed.extraNote ?? ''),
    }
  } catch {
    return null
  }
}

export function savePedidoDraft(draft: PedidoDraft): void {
  if (typeof localStorage === 'undefined') return
  try {
    if (!isPedidoDraftMeaningful(draft)) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        client: draft.client,
        lines: draft.lines.map((l) => ({
          id_product: l.id_product,
          weight: l.weight,
          price: l.price,
        })),
        extraAmount: draft.extraAmount,
        extraNote: draft.extraNote,
      }),
    )
  } catch {
    /* quota / private mode */
  }
}

export function clearPedidoDraft(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function hasPedidoDraft(): boolean {
  const draft = loadPedidoDraft()
  return !!draft && isPedidoDraftMeaningful(draft)
}
