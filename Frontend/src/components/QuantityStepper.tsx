import { Minus, Plus } from 'lucide-react'

interface QuantityStepperProps {
  value: number
  onChange: (next: number) => void
  min?: number
  ariaLabel?: string
  className?: string
  /** Compacto para filas de tabla (mismo alto que inputs sm ≈ 31px). */
  size?: 'sm' | 'md'
  /** Si se define, value < min se muestra como vacío (p. ej. "—") y se puede bajar a 0. */
  emptyLabel?: string
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  ariaLabel = 'Cantidad',
  className = '',
  size = 'md',
  emptyLabel,
}: QuantityStepperProps) {
  const compact = size === 'sm'
  const iconSize = compact ? 14 : 20
  const isEmpty = emptyLabel != null && value < min

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

  const decrement = () => {
    if (emptyLabel != null && value <= min) {
      onChange(0)
      return
    }
    onChange(Math.max(min, value - 1))
  }

  const increment = () => {
    if (isEmpty) {
      onChange(min)
      return
    }
    onChange(value + 1)
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
        onPointerUp={(e) => handlePointerUp(e, decrement)}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick(decrement)}
        disabled={emptyLabel != null ? value <= 0 : value <= min}
        aria-label="Reducir cantidad"
      >
        <Minus size={iconSize} aria-hidden />
      </button>
      <span className="product-detail-qty-value" aria-live="polite" aria-atomic="true">
        {isEmpty ? emptyLabel : value}
      </span>
      <button
        type="button"
        className="btn btn-outline-dark product-detail-qty-btn"
        onPointerDown={handlePointerDown}
        onPointerUp={(e) => handlePointerUp(e, increment)}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick(increment)}
        aria-label="Aumentar cantidad"
      >
        <Plus size={iconSize} aria-hidden />
      </button>
    </div>
  )
}
