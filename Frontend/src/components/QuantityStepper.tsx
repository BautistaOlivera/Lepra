import { Minus, Plus } from 'lucide-react'

interface QuantityStepperProps {
  value: number
  onChange: (next: number) => void
  min?: number
  ariaLabel?: string
  className?: string
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  ariaLabel = 'Cantidad',
  className = '',
}: QuantityStepperProps) {
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

  return (
    <div
      className={`product-detail-qty-stepper ${className}`.trim()}
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        className="btn btn-outline-dark product-detail-qty-btn"
        onPointerDown={handlePointerDown}
        onPointerUp={(e) => handlePointerUp(e, () => onChange(Math.max(min, value - 1)))}
        onPointerLeave={handlePointerLeave}
        disabled={value <= min}
        aria-label="Reducir cantidad"
      >
        <Minus size={20} aria-hidden />
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
        aria-label="Aumentar cantidad"
      >
        <Plus size={20} aria-hidden />
      </button>
    </div>
  )
}
