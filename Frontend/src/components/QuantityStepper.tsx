import { Minus, Plus } from 'lucide-react'

interface QuantityStepperProps {
  value: number
  onChange: (next: number) => void
  min?: number
  ariaLabel?: string
  className?: string
  /** Compacto para filas de tabla (mismo alto que inputs sm ≈ 31px). */
  size?: 'sm' | 'md'
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  ariaLabel = 'Cantidad',
  className = '',
  size = 'md',
}: QuantityStepperProps) {
  const compact = size === 'sm'
  const iconSize = compact ? 14 : 20

  const releaseBtn = (btn: HTMLButtonElement) => {
    window.setTimeout(() => {
      btn.classList.remove('product-detail-qty-btn--pressed')
      btn.blur()
    }, 150)
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.disabled) return
    e.currentTarget.classList.add('product-detail-qty-btn--pressed')
  }

  const handlePointerUp = (
    e: React.PointerEvent<HTMLButtonElement>,
    action: () => void,
  ) => {
    const btn = e.currentTarget
    if (btn.disabled) return
    action()
    releaseBtn(btn)
  }

  const handlePointerLeave = (e: React.PointerEvent<HTMLButtonElement>) => {
    releaseBtn(e.currentTarget)
  }

  // Fallback para navegadores sin Pointer Events (Android 4.4 / Chrome viejo).
  const handleClick = (action: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.currentTarget.disabled) return
    // Si hay Pointer Events, onPointerUp ya disparó la acción; evitamos doble.
    if (typeof window !== 'undefined' && 'PointerEvent' in window) return
    action()
  }

  return (
    <div
      className={[
        'product-detail-qty-stepper',
        compact ? 'qty-stepper--sm' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        className="btn btn-outline-dark product-detail-qty-btn"
        onPointerDown={handlePointerDown}
        onPointerUp={(e) => handlePointerUp(e, () => onChange(Math.max(min, value - 1)))}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick(() => onChange(Math.max(min, value - 1)))}
        disabled={value <= min}
        aria-label="Reducir cantidad"
      >
        <Minus size={iconSize} aria-hidden />
      </button>
      <span className="product-detail-qty-value" aria-live="polite" aria-atomic="true">
        {value}
      </span>
      <button
        type="button"
        className="btn btn-outline-dark product-detail-qty-btn"
        onPointerDown={handlePointerDown}
        onPointerUp={(e) => handlePointerUp(e, () => onChange(value + 1))}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick(() => onChange(value + 1))}
        aria-label="Aumentar cantidad"
      >
        <Plus size={iconSize} aria-hidden />
      </button>
    </div>
  )
}
