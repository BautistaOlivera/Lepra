/**
 * Registra el service worker desde la app (no desde registerSW.js en el HTML).
 * El SW precachea el shell (HTML/JS/CSS) para usar la app sin conexión en la tablet.
 * Los datos del admin offline viven en IndexedDB; el SW no cachea la API JSON.
 */
export async function setupPwa(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  try {
    const { registerSW } = await import('virtual:pwa-register')
    registerSW({ immediate: true })
  } catch {
    // build sin plugin PWA (dev) — ignorar
  }
}
