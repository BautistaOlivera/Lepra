import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { Modal, Button } from 'react-bootstrap'
import { releaseBootstrapModalLock } from '@/lib/bootstrapModal'

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

  const finish = (result: boolean) => {
    pending?.resolve(result)
    setPending(null)
  }

  const show = !!pending

  useEffect(() => {
    if (!show) {
      const t = window.setTimeout(releaseBootstrapModalLock, 400)
      return () => window.clearTimeout(t)
    }
  }, [show])

  const confirmVariant = pending?.confirmVariant ?? 'danger'

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Modal
        show={show}
        onHide={() => finish(false)}
        backdrop
        keyboard
        centered
        enforceFocus
        restoreFocus
      >
        <Modal.Header closeButton className="border-dark">
          <Modal.Title>{pending?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">{pending?.message}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-dark" onClick={() => finish(false)}>
            {pending?.cancelLabel ?? 'Cancelar'}
          </Button>
          <Button
            variant={confirmVariant === 'danger' ? 'outline-danger' : undefined}
            className={confirmVariant === 'primary' ? 'btn-lepra' : undefined}
            onClick={() => finish(true)}
          >
            {pending?.confirmLabel ?? 'Confirmar'}
          </Button>
        </Modal.Footer>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx.confirm
}
