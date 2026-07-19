import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Container, Button } from 'react-bootstrap'
import { LogOut } from 'lucide-react'
import { AdminSyncToolbar } from '@/components/AdminSyncToolbar'
import { useOnlineStatus } from '@/offline/network'
import { useEffect, useState } from 'react'
import { getAdminLastSync, runAdminIncrementalSync } from '@/offline/sync'
import { getOutboxStats, processOutbox, OUTBOX_CHANGED_EVENT } from '@/offline/outbox'
import toast from 'react-hot-toast'
import { OutboxModal } from '@/components/modals/OutboxModal'
import { isAuthRequiredFlagSet } from '@/offline/authGrace'
import { MENSAJE_SIN_CONEXION } from '@/lib/connectionLabels'
import { LepraNavbar } from '@/components/LepraNavbar'
import { releaseBootstrapModalLock } from '@/lib/bootstrapModal'

export function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const online = useOnlineStatus()
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<number>(0)
  const [pendingOutbox, setPendingOutbox] = useState<number>(0)
  const [outboxActionable, setOutboxActionable] = useState<number>(0)
  const [outboxFailed, setOutboxFailed] = useState<number>(0)
  const [outboxTotal, setOutboxTotal] = useState<number>(0)
  const [outboxOpen, setOutboxOpen] = useState(false)
  const [authRequired, setAuthRequired] = useState<boolean>(isAuthRequiredFlagSet())

  function refreshOutboxCounts() {
    getOutboxStats()
      .then((s) => {
        setPendingOutbox(s.pending)
        setOutboxFailed(s.failed)
        setOutboxActionable(s.actionable)
        setOutboxTotal(s.total)
      })
      .catch(() => {})
  }

  useEffect(() => {
    getAdminLastSync()
      .then((st) => setLastSync(Math.max(st.users, st.products, st.orders)))
      .catch(() => {})
    refreshOutboxCounts()
  }, [online])

  useEffect(() => {
    const handler = () => setAuthRequired(isAuthRequiredFlagSet())
    window.addEventListener('lepra-auth-required', handler)
    return () => window.removeEventListener('lepra-auth-required', handler)
  }, [])

  useEffect(() => {
    const onOutboxChanged = () => refreshOutboxCounts()
    window.addEventListener(OUTBOX_CHANGED_EVENT, onOutboxChanged)
    return () => window.removeEventListener(OUTBOX_CHANGED_EVENT, onOutboxChanged)
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
        refreshOutboxCounts()
      }
    })()
  }, [online, authRequired])

  useEffect(() => {
    if (!online) return
    if (pendingOutbox <= 0) return
    if (authRequired) return

    const id = window.setInterval(() => {
      processOutbox({ max: 25 })
        .finally(() => refreshOutboxCounts())
    }, 15000)

    return () => window.clearInterval(id)
  }, [online, pendingOutbox, authRequired])

  async function handleSync() {
    if (!online) {
      toast.error(MENSAJE_SIN_CONEXION)
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

      refreshOutboxCounts()
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

  function handleOutboxClose() {
    setOutboxOpen(false)
    releaseBootstrapModalLock()
    refreshOutboxCounts()
  }

  useEffect(() => {
    releaseBootstrapModalLock()
  }, [location.pathname])

  const hasOutboxItems = outboxTotal > 0

  return (
    <>
      <LepraNavbar
        collapseId="admin-nav"
        showAdminLink
        toolbarActions={
          <div className="lepra-navbar-mobile-sync d-lg-none">
            {online && authRequired && (
              <Button
                variant="danger"
                size="sm"
                className="lepra-navbar-mobile-relogin"
                onClick={() => navigate('/login', { state: { from: location }, replace: false })}
                title="Tu sesión expiró. Inicia sesión para sincronizar."
              >
                Login
              </Button>
            )}
            <AdminSyncToolbar
              online={online}
              syncing={syncing}
              authRequired={authRequired}
              lastSync={lastSync}
              pendingOutbox={pendingOutbox}
              outboxFailed={outboxFailed}
              outboxActionable={outboxActionable}
              hasOutboxItems={hasOutboxItems}
              onSync={handleSync}
              onOpenOutbox={() => setOutboxOpen(true)}
              compact
            />
          </div>
        }
        endNav={() => (
          <>
            <div className="lepra-navbar-tools lepra-navbar-tools-divided d-none d-lg-flex flex-wrap align-items-center justify-content-lg-end gap-2">
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
              <AdminSyncToolbar
                online={online}
                syncing={syncing}
                authRequired={authRequired}
                lastSync={lastSync}
                pendingOutbox={pendingOutbox}
                outboxFailed={outboxFailed}
                outboxActionable={outboxActionable}
                hasOutboxItems={hasOutboxItems}
                onSync={handleSync}
                onOpenOutbox={() => setOutboxOpen(true)}
              />
            </div>
            <Button
              variant="outline-light"
              size="sm"
              className="lepra-nav-logout"
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={16} className="me-1 lepra-nav-logout-icon" aria-hidden />
              <span className="lepra-nav-logout-label">Cerrar sesión</span>
            </Button>
          </>
        )}
      />
      <Container fluid="sm" className="px-3 px-sm-4 py-4">
        <Outlet />
      </Container>
      {outboxOpen && <OutboxModal show onClose={handleOutboxClose} />}
    </>
  )
}
