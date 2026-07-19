import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { Button } from 'react-bootstrap'
import { RefreshCw } from 'lucide-react'
import {
  applyPwaUpdate,
  isPwaUpdateAvailable,
  PWA_UPDATE_AVAILABLE_EVENT,
} from '@/pwaRegister'

const TOAST_ID = 'lepra-pwa-update'

function onUpdateClick(toastId: string) {
  toast.loading('Actualizando...', { id: toastId, duration: Infinity })
  // Activa el SW nuevo; la página se recarga sola cuando toma control.
  void applyPwaUpdate()
}

/**
 * Aviso de "nueva versión disponible" con botón para actualizar en el momento.
 * Funciona igual en navegador y en la PWA instalada. Si el usuario lo ignora,
 * la versión nueva se aplica sola al cerrar y volver a abrir la app.
 */
export function PwaUpdatePrompt() {
  useEffect(() => {
    const show = () => {
      toast(
        (t) => (
          <div className="d-flex align-items-center gap-2">
            <span>Hay una nueva versión disponible</span>
            <Button size="sm" className="btn-lepra flex-shrink-0" onClick={() => onUpdateClick(t.id)}>
              <RefreshCw size={14} className="me-1" />
              Actualizar
            </Button>
          </div>
        ),
        { id: TOAST_ID, duration: Infinity }
      )
    }
    // Por si la versión nueva se detectó antes de que este componente montara.
    if (isPwaUpdateAvailable()) show()
    window.addEventListener(PWA_UPDATE_AVAILABLE_EVENT, show)
    return () => window.removeEventListener(PWA_UPDATE_AVAILABLE_EVENT, show)
  }, [])

  return null
}
