import { useEffect } from 'react'
import { OverlayScrollbars } from 'overlayscrollbars'
import type { OverlayScrollbars as OverlayScrollbarsInstance } from 'overlayscrollbars'

const DESKTOP_MQ = '(min-width: 992px)'

function syncNavbarScrollbarOffset() {
  const nav = document.querySelector<HTMLElement>('.navbar-lepra')
  const height = nav ? Math.ceil(nav.getBoundingClientRect().height) : 56
  document.documentElement.style.setProperty('--lepra-navbar-offset', `${height}px`)
}

/** Scrollbar overlay en desktop: estilo El Lepra, sin desplazar el layout. */
export function DesktopOverlayScroll() {
  useEffect(() => {
    let instance: OverlayScrollbarsInstance | null = null
    let stopNavbarOffset: (() => void) | null = null
    const mq = window.matchMedia(DESKTOP_MQ)

    function bindNavbarOffset() {
      syncNavbarScrollbarOffset()
      const nav = document.querySelector<HTMLElement>('.navbar-lepra')
      if (!nav) return () => {}

      const ro = new ResizeObserver(() => syncNavbarScrollbarOffset())
      ro.observe(nav)
      window.addEventListener('resize', syncNavbarScrollbarOffset)
      return () => {
        ro.disconnect()
        window.removeEventListener('resize', syncNavbarScrollbarOffset)
        document.documentElement.style.removeProperty('--lepra-navbar-offset')
      }
    }

    function enable() {
      document.documentElement.setAttribute('data-overlayscrollbars-initialize', '')
      document.body.setAttribute('data-overlayscrollbars-initialize', '')
      document.documentElement.classList.add('lepra-overlay-scroll')
      stopNavbarOffset = bindNavbarOffset()

      instance = OverlayScrollbars(document.body, {
        scrollbars: {
          theme: 'os-theme-lepra',
          autoHide: 'scroll',
          autoHideDelay: 700,
        },
      })
    }

    function disable() {
      instance?.destroy()
      instance = null
      stopNavbarOffset?.()
      stopNavbarOffset = null
      document.documentElement.removeAttribute('data-overlayscrollbars-initialize')
      document.body.removeAttribute('data-overlayscrollbars-initialize')
      document.documentElement.classList.remove('lepra-overlay-scroll')
    }

    function sync() {
      if (mq.matches) {
        if (!instance) enable()
      } else {
        disable()
      }
    }

    sync()
    mq.addEventListener('change', sync)
    return () => {
      mq.removeEventListener('change', sync)
      disable()
    }
  }, [])

  return null
}
