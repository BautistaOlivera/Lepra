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

/**
 * Flexbox `gap` llegó en Chrome 84. En Chrome 81 / Android 4.4 se ignora
 * y queda todo pegado (cards, botones, badges, toolbar).
 * Feature-detect al estilo Modernizr (no alcanza con @supports).
 */
export function supportsFlexGap(): boolean {
  if (typeof document === 'undefined') return true
  try {
    const flex = document.createElement('div')
    flex.style.display = 'flex'
    flex.style.flexDirection = 'column'
    flex.style.rowGap = '1px'
    flex.appendChild(document.createElement('div'))
    flex.appendChild(document.createElement('div'))
    document.documentElement.appendChild(flex)
    const supported = flex.scrollHeight === 1
    document.documentElement.removeChild(flex)
    return supported
  } catch {
    return false
  }
}

/** Marca el documento para CSS de fallback (márgenes donde falta flex gap). */
export function applyLegacyLayoutFlags(): void {
  if (typeof document === 'undefined') return
  if (!supportsFlexGap()) {
    document.documentElement.classList.add('no-flexbox-gap')
  }
}
