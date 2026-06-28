/** Android 4.x / WebViews viejos: el service worker suele romper fetch a la API. */
export function isLegacyAndroidWebView(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android 4\./i.test(navigator.userAgent)
}

export function getChromeMajorVersion(): number | null {
  if (typeof navigator === 'undefined') return null
  const m = navigator.userAgent.match(/Chrom(?:e|ium)\/(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

/** Clientes viejos (Chrome ≤81 / Android 4.x): transporte XHR para llamadas online a la API. */
export function isLegacyClient(): boolean {
  if (isLegacyAndroidWebView()) return true
  const chrome = getChromeMajorVersion()
  return chrome !== null && chrome <= 81
}
