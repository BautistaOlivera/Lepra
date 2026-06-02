import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Container, Button, Badge } from 'react-bootstrap'
import { LogOut, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useOnlineStatus } from '@/offline/network'
import { useEffect, useState } from 'react'
import { getAdminLastSync, runAdminIncrementalSync } from '@/offline/sync'
import { getPendingCount, processOutbox } from '@/offline/outbox'
import toast from 'react-hot-toast'
import { OutboxModal } from '@/components/modals/OutboxModal'
import { isAuthRequiredFlagSet } from '@/offline/authGrace'
import { LepraNavbar } from '@/components/LepraNavbar'

export function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const online = useOnlineStatus()
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<number>(0)
  const [pendingOutbox, setPendingOutbox] = useState<number>(0)
  const [outboxOpen, setOutboxOpen] = useState(false)
  const [authRequired, setAuthRequired] = useState<boolean>(isAuthRequiredFlagSet())

  useEffect(() => {
    getAdminLastSync()
      .then((s) => setLastSync(Math.max(s.users, s.products, s.orders)))
      .catch(() => {})
    getPendingCount()
      .then(setPendingOutbox)
      .catch(() => {})
  }, [online])

  useEffect(() => {
    const handler = () => setAuthRequired(isAuthRequiredFlagSet())
    window.addEventListener('lepra-auth-required', handler)
    return () => window.removeEventListener('lepra-auth-required', handler)
  }, [])

  useEffect(() => {
    if (!online) return
    if (authRequired) return
    ;(async () => {
      try {
        await processOutbox({ max: 100 })
        const res = await runAdminIncrementalSync({ force: true })
        if (res.ran) setLastSync(res.serverTime)
      } catch {
        // noop
      } finally {
        getPendingCount().then(setPendingOutbox).catch(() => {})
      }
    })()
  }, [online, authRequired])

  useEffect(() => {
    if (!online) return
    if (pendingOutbox <= 0) return
    if (authRequired) return

    const id = window.setInterval(() => {
      processOutbox({ max: 25 })
        .finally(() => getPendingCount().then(setPendingOutbox).catch(() => {}))
    }, 15000)

    return () => window.clearInterval(id)
  }, [online, pendingOutbox, authRequired])

  async function handleSync() {
    if (!online) {
      toast.error('Estás offline')
      return
    }
    if (authRequired) {
      toast.error('Sesión expirada. Inicia sesión para sincronizar.')
      return
    }
    setSyncing(true)
    try {
      const out = await processOutbox({ max: 200 })
      if (out.processed > 0) {
        toast.success(out.failed > 0 ? `Cambios pendientes: ${out.succeeded} OK, ${out.failed} fallaron` : `Cambios pendientes: ${out.succeeded} OK`)
      }

      const res = await runAdminIncrementalSync({ force: true })
      if (res.ran) {
        setLastSync(res.serverTime)
        const total = res.usersUpserted + res.productsUpserted + res.ordersUpserted
        toast.success(
          total === 0
            ? 'Sin cambios'
            : `Sincronizado: ${total} cambios (U:${res.usersUpserted} P:${res.productsUpserted} O:${res.ordersUpserted})`
        )
      } else if (out.processed === 0) {
        toast.success('Ya estás sincronizado')
      }

      const pc = await getPendingCount()
      setPendingOutbox(pc)
    } catch (e: any) {
      toast.error(e?.message || 'Error al sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('lepra_token')
    localStorage.removeItem('lepra_user')
    localStorage.removeItem('lepra_auth_required')
    navigate('/')
  }

  const hasPendingSync = pendingOutbox > 0
  const isFullySynced = !syncing && !hasPendingSync && !authRequired

  function handleOutboxClose() {
    setOutboxOpen(false)
    getPendingCount().then(setPendingOutbox).catch(() => {})
  }

  return (
    <>
      <LepraNavbar
        collapseId="admin-nav"
        showAdminLink
        endNav={() => (
          <>
            <div className="lepra-navbar-tools lepra-navbar-tools-divided d-flex flex-wrap align-items-center justify-content-center justify-content-lg-end gap-2">
              <Badge bg={online ? 'success' : 'secondary'}>
                {online ? 'Online' : 'Offline'}
              </Badge>
              {online && authRequired && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => navigate('/login', { state: { from: location }, replace: false })}
                  title="Tu sesión expiró. Inicia sesión para sincronizar."
                >
                  Re-login
                </Button>
              )}
              <Button
                variant={hasPendingSync ? 'warning' : 'outline-light'}
                size="sm"
                className={hasPendingSync ? 'text-dark' : undefined}
                onClick={handleSync}
                disabled={!online || syncing || isFullySynced}
                title={
                  [
                    isFullySynced
                      ? lastSync
                        ? `Sincronizado · ${new Date(lastSync).toLocaleString()}`
                        : 'Sincronizado'
                      : lastSync
                        ? `Última sync: ${new Date(lastSync).toLocaleString()}`
                        : 'Nunca sincronizado',
                    hasPendingSync ? `${pendingOutbox} cambio(s) por enviar` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                }
              >
                {syncing ? (
                  <>
                    <RefreshCw size={16} className="me-1 lepra-icon-spin" aria-hidden />
                    Sincronizando…
                  </>
                ) : isFullySynced ? (
                  <>
                    <CheckCircle2 size={16} className="me-1 text-success" aria-hidden />
                    Sincronizado
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} className="me-1" aria-hidden />
                    Sincronizar{hasPendingSync ? ` (${pendingOutbox})` : ''}
                  </>
                )}
              </Button>
              <Button
                variant="outline-light"
                size="sm"
                onClick={() => setOutboxOpen(true)}
                title="Ver cambios pendientes"
              >
                Pendientes
                {pendingOutbox ? ` (${pendingOutbox})` : ''}
              </Button>
            </div>
            <Button variant="outline-light" size="sm" className="lepra-nav-logout" onClick={handleLogout}>
              <LogOut size={16} className="me-1" /> Cerrar sesión
            </Button>
          </>
        )}
      />
      <Container fluid="sm" className="px-3 px-sm-4 py-4">
        <Outlet />
      </Container>
      <OutboxModal show={outboxOpen} onClose={handleOutboxClose} />
    </>
  )
}
