import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Button } from 'react-bootstrap'

export type ConfirmOptions = {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: 'danger' | 'primary'
}

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean) => void
}

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const titleId = useId()
  const messageId = useId()

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({
        title: options.title ?? '¿Confirmar?',
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Confirmar',
        cancelLabel: options.cancelLabel ?? 'Cancelar',
        confirmVariant: options.confirmVariant ?? 'danger',
        resolve,
      })
    })
  }, [])

  const finish = useCallback((result: boolean) => {
    setPending((current) => {
      current?.resolve(result)
      return null
    })
  }, [])

  const show = !!pending

  useEffect(() => {
    if (!show) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        finish(false)
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [show, finish])

  const confirmVariant = pending?.confirmVariant ?? 'danger'

  const overlay =
    show && typeof document !== 'undefined'
      ? createPortal(
          <div className="lepra-confirm-root" role="presentation">
            <button
              type="button"
              className="lepra-confirm-backdrop"
              aria-label="Cancelar"
              onClick={() => finish(false)}
            />
            <div
              className="lepra-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={messageId}
            >
              <div className="lepra-confirm-header">
                <h2 id={titleId} className="lepra-confirm-title">
                  {pending?.title}
                </h2>
              </div>
              <div className="lepra-confirm-body">
                <p id={messageId} className="mb-0">
                  {pending?.message}
                </p>
              </div>
              <div className="lepra-confirm-footer">
                <Button variant="outline-dark" onClick={() => finish(false)}>
                  {pending?.cancelLabel ?? 'Cancelar'}
                </Button>
                <Button
                  variant={confirmVariant === 'danger' ? 'outline-danger' : undefined}
                  className={confirmVariant === 'primary' ? 'btn-lepra' : undefined}
                  onClick={() => finish(true)}
                  autoFocus
                >
                  {pending?.confirmLabel ?? 'Confirmar'}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {overlay}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx.confirm
}
