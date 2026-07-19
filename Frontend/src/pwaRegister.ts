/**
 * Registra el service worker desde la app (no desde registerSW.js en el HTML).
 * El SW precachea el shell (HTML/JS/CSS) para usar la app sin conexión en la tablet.
 * Los datos del admin offline viven en IndexedDB; el SW no cachea la API JSON.
 *
 * Actualizaciones (modo prompt): cuando hay una versión nueva se dispara
 * PWA_UPDATE_AVAILABLE_EVENT y la app muestra un aviso con botón "Actualizar"
 * (PwaUpdatePrompt). Si el usuario lo ignora, el SW nuevo queda en espera y se
 * activa solo al cerrar y volver a abrir la app.
 */

export const PWA_UPDATE_AVAILABLE_EVENT = 'lepra-pwa-update-available'

/** Chequeo periódico por si la app queda abierta todo el día (tablet). */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

let updateFn: ((reloadPage?: boolean) => Promise<void>) | undefined
let updateAvailable = false

/** True si ya se detectó una versión nueva (por si el aviso monta después del evento). */
export function isPwaUpdateAvailable(): boolean {
  return updateAvailable
}

/**
 * Activa el service worker nuevo. La página se recarga sola cuando el SW
 * toma control (listener 'controlling' del módulo de registro del plugin).
 */
export async function applyPwaUpdate(): Promise<void> {
  if (!updateFn) return
  await updateFn(true)
}

export async function setupPwa(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  try {
    const { registerSW } = await import('virtual:pwa-register')
    updateFn = registerSW({
      immediate: true,
      onNeedRefresh() {
        updateAvailable = true
        window.dispatchEvent(new Event(PWA_UPDATE_AVAILABLE_EVENT))
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return
        window.setInterval(() => {
          registration.update().catch(() => {})
        }, UPDATE_CHECK_INTERVAL_MS)
      },
    })
  } catch {
    // build sin plugin PWA (dev) — ignorar
  }
}
