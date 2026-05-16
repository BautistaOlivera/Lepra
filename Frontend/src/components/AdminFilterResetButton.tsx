import { Button } from 'react-bootstrap'
import { RotateCcw } from 'lucide-react'

interface AdminFilterResetButtonProps {
  onClick: () => void
}

export function AdminFilterResetButton({ onClick }: AdminFilterResetButtonProps) {
  const releaseBtn = (btn: HTMLButtonElement) => {
    window.setTimeout(() => {
      btn.classList.remove('admin-list-toolbar-reset--pressed')
      btn.blur()
    }, 150)
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.add('admin-list-toolbar-reset--pressed')
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    releaseBtn(e.currentTarget)
  }

  const handlePointerLeave = (e: React.PointerEvent<HTMLButtonElement>) => {
    releaseBtn(e.currentTarget)
  }

  return (
    <Button
      type="button"
      variant="outline-secondary"
      onClick={onClick}
      title="Limpiar filtros"
      aria-label="Limpiar filtros"
      className="admin-list-toolbar-reset"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      <RotateCcw size={18} aria-hidden />
    </Button>
  )
}
