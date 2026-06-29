/** Nombre de archivo seguro para descargas en el dispositivo. */
export function sanitizeDownloadFilename(name: string, fallback = 'producto'): string {
  const cleaned = name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  return cleaned || fallback
}

function imageExtensionFromUrl(url: string): string {
  const match = url.match(/\.(webp|jpe?g|png|gif)(?:\?|$)/i)
  return match?.[1]?.toLowerCase() ?? 'webp'
}

/** Descarga una imagen remota (p. ej. /uploads con marca quemada). */
export async function downloadRemoteImage(imageUrl: string, filenameBase: string): Promise<void> {
  if (!imageUrl.trim()) throw new Error('Sin URL de imagen')

  const res = await fetch(imageUrl, { mode: 'cors', credentials: 'omit' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const blob = await res.blob()
  const ext = imageExtensionFromUrl(imageUrl)
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = `${sanitizeDownloadFilename(filenameBase)}.${ext}`
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}
