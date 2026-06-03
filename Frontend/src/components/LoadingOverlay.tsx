import type { ReactNode } from 'react'
import { Spinner } from 'react-bootstrap'

type LoadingOverlayProps = {
  message: string
  variant?: 'modal' | 'page'
}

/** Capa oscura con spinner grande (modales o bloques). */
export function LoadingOverlay({ message, variant = 'modal' }: LoadingOverlayProps) {
  return (
    <div
      className={`lepra-loading-overlay lepra-loading-overlay--${variant}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Spinner animation="border" variant="light" className="lepra-loading-overlay__spinner" />
      <p className="lepra-loading-overlay__message mb-0">{message}</p>
    </div>
  )
}

/** Spinner centrado para listas / páginas (sin oscurecer). */
export function LoadingCenter({ message = 'Cargando...' }: { message?: string }) {
  return (
    <div className="lepra-loading-center" role="status" aria-live="polite">
      <Spinner animation="border" className="lepra-loading-center__spinner" />
      <p className="lepra-loading-center__message mb-0">{message}</p>
    </div>
  )
}

type ModalBusyFrameProps = {
  busy: boolean
  message: string
  children: ReactNode
}

/** Envuelve cuerpo + pie del modal; al estar busy oscurece todo y muestra overlay. */
export function ModalBusyFrame({ busy, message, children }: ModalBusyFrameProps) {
  return (
    <div className={`lepra-modal-busy-frame${busy ? ' lepra-modal-busy-frame--busy' : ''}`}>
      {children}
      {busy ? <LoadingOverlay message={message} variant="modal" /> : null}
    </div>
  )
}
