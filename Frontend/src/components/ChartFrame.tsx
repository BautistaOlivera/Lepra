import { useEffect, useRef, useState, type ReactElement } from 'react'
import { ResponsiveContainer } from 'recharts'

type ChartFrameProps = {
  height: number
  className?: string
  children: ReactElement
}

/**
 * Monta Recharts solo cuando el contenedor ya tiene ancho/alto > 0.
 * Evita el warn width(-1)/height(-1) al navegar o mientras el layout no está listo.
 */
export function ChartFrame({ height, className = '', children }: ChartFrameProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    function measure() {
      const el = ref.current
      if (!el) return
      const w = Math.floor(el.clientWidth)
      const h = Math.floor(el.clientHeight)
      if (w > 0 && h > 0) {
        setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
      } else {
        setSize(null)
      }
    }

    measure()

    const el = ref.current
    if (!el) return

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => measure())
      ro.observe(el)
      return () => ro.disconnect()
    }

    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  return (
    <div
      ref={ref}
      className={`lepra-chart-frame ${className}`.trim()}
      style={{ width: '100%', height, minWidth: 0, minHeight: height }}
    >
      {size ? (
        <ResponsiveContainer width={size.w} height={size.h}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  )
}
