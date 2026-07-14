import { useState, useEffect, useCallback } from 'react'
import { Button, Badge, Form, InputGroup, Card } from 'react-bootstrap'
import { LoadingCenter } from '@/components/LoadingOverlay'
import { Plus, Pencil, Trash2, Search, CheckCircle2, Users } from 'lucide-react'
import { createColumnHelper } from '@tanstack/react-table'
import { deactivateUser } from '@/api/user'
import { getUsersPaginatedOfflineFirst } from '@/repositories/usersRepo'
import { User } from '@/types'
import toast from 'react-hot-toast'
import { ClienteModal } from '@/components/modals/ClienteModal'
import { DataTable } from '@/components/DataTable'
import { Select } from '@/components/Select'
import { AdminFilterResetButton } from '@/components/AdminFilterResetButton'
import { isOnlineNow } from '@/offline/network'
import { enqueueCommand } from '@/offline/outbox'
import { lepraDb } from '@/offline/db'
import { useOutboxPending } from '@/offline/useOutboxPending'
import { releaseBootstrapModalLock } from '@/lib/bootstrapModal'
import { useConfirm } from '@/context/ConfirmContext'
import { AdminPageHero } from '@/components/AdminPageHero'

const columnHelper = createColumnHelper<User>()

function displayRolLabel(rol: string): string {
  if (rol.toUpperCase() === 'CLIENT') return 'CLIENTE'
  return rol
}

function ClienteSyncBadge({ user, pending }: { user: User; pending: boolean }) {
  if (user.id < 0 || pending) {
    return <Badge bg="warning">Pendiente</Badge>
  }
  return <CheckCircle2 size={18} className="text-success" aria-label="Sincronizado" />
}

export function Clientes() {
  const confirm = useConfirm()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [rolFilter, setRolFilter] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<boolean | null>(true)
  const { users: pendingUsers, refresh: refreshPending } = useOutboxPending()

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const loadUsers = useCallback(async (lastId?: number) => {
    setLoading(true)
    const filters: Record<string, unknown> = {}
    if (searchDebounced.trim()) filters.search = searchDebounced.trim()
    if (rolFilter) filters.rol = rolFilter
    if (activeFilter !== null) filters.active = activeFilter
    const { data } = await getUsersPaginatedOfflineFirst({
      limit: 20,
      last_seen_id: lastId ?? null,
      filters,
    })
    if (data) {
      setUsers((prev) => (lastId ? [...prev, ...data.items] : data.items))
      setNextCursor(data.next_cursor)
    }
    setLoading(false)
  }, [searchDebounced, rolFilter, activeFilter])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  function handleAdd() {
    setEditingUser(null)
    setModalOpen(true)
  }

  function handleEdit(u: User) {
    setEditingUser(u)
    setModalOpen(true)
  }

  async function handleDeactivate(u: User) {
    const ok = await confirm({
      title: 'Desactivar cliente',
      message: `¿Desactivar a ${u.email}? No podrá iniciar sesión hasta que lo reactives.`,
      confirmLabel: 'Desactivar',
    })
    if (!ok) return
    if (!isOnlineNow()) {
      await enqueueCommand('USER_DEACTIVATE', { id: u.id })
      await lepraDb.users.update(u.id, { active: false })
      toast.success('Cambio guardado (pendiente de sincronizar)')
      refreshPending().catch(() => {})
      loadUsers()
      return
    }
    const { error } = await deactivateUser(u.id)
    if (error) toast.error(error.message)
    else {
      toast.success('Usuario desactivado')
      loadUsers()
    }
  }

  function onModalClose(refresh?: boolean) {
    setModalOpen(false)
    setEditingUser(null)
    releaseBootstrapModalLock()
    if (refresh) {
      refreshPending().catch(() => {})
      loadUsers()
    }
  }

  function clearFilters() {
    setSearch('')
    setRolFilter(null)
    setActiveFilter(true)
  }

  const columns = [
    columnHelper.accessor('email', { header: 'Email' }),
    columnHelper.accessor('name', {
      header: 'Nombre',
      cell: (info) => info.getValue() || '-',
    }),
    columnHelper.accessor('location', {
      header: 'Ubicación',
      cell: (info) => info.getValue() || '-',
    }),
    columnHelper.accessor('rol', {
      header: () => <span className="d-block text-center">Rol</span>,
      cell: (info) => {
        const rol = info.getValue()
        return (
          <div className="text-center">
            <Badge bg={rol === 'ADMIN' ? 'dark' : 'secondary'}>{displayRolLabel(rol)}</Badge>
          </div>
        )
      },
    }),
    columnHelper.accessor('active', {
      header: 'Estado',
      cell: (info) =>
        info.getValue() ? <Badge bg="success">Activo</Badge> : <Badge bg="danger">Inactivo</Badge>,
    }),
    columnHelper.display({
      id: 'sync',
      header: () => <span className="d-block text-center">Sincronización</span>,
      cell: ({ row }) => (
        <div className="text-center">
          <ClienteSyncBadge user={row.original} pending={pendingUsers.has(row.original.id)} />
        </div>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.active ? (
          <>
            <Button
              variant="link"
              size="sm"
              className="text-dark p-0 me-2"
              onClick={() => handleEdit(row.original)}
              aria-label={`Editar ${row.original.email}`}
            >
              <Pencil size={16} />
            </Button>
            <Button
              variant="link"
              size="sm"
              className="text-danger p-0"
              onClick={() => handleDeactivate(row.original)}
              aria-label={`Desactivar ${row.original.email}`}
            >
              <Trash2 size={16} />
            </Button>
          </>
        ) : null,
    }),
  ]

  return (
    <div className="admin-list-page">
      <AdminPageHero>
        <span className="d-inline-flex align-items-center gap-2">
          <Users size={28} aria-hidden />
          Clientes
        </span>
      </AdminPageHero>

      <div className="admin-list-toolbar">
        <InputGroup className="admin-list-search">
          <InputGroup.Text>
            <Search size={18} aria-hidden />
          </InputGroup.Text>
          <Form.Control
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar clientes"
          />
        </InputGroup>

        <div className="admin-list-filters-row">
          <div className="admin-list-filter">
            <Select<string>
              options={[
                { value: '', label: 'Todos los roles' },
                { value: 'CLIENT', label: 'Cliente' },
                { value: 'ADMIN', label: 'Administrador' },
              ]}
              value={rolFilter ?? ''}
              onChange={(v) => setRolFilter(v || null)}
              placeholder="Rol"
              isSearchable={false}
            />
          </div>
          <div className="admin-list-filter">
            <Select<string>
              options={[
                { value: 'true', label: 'Activos' },
                { value: 'false', label: 'Inactivos' },
                { value: 'all', label: 'Todos' },
              ]}
              value={activeFilter === null ? 'all' : String(activeFilter)}
              onChange={(v) => setActiveFilter(v === 'all' || v === '' ? null : v === 'true')}
              placeholder="Estado"
              isSearchable={false}
            />
          </div>
          <AdminFilterResetButton onClick={clearFilters} />
        </div>

        <Button className="btn-lepra admin-list-add-btn" onClick={handleAdd}>
          <Plus size={18} className="me-1" aria-hidden /> Agregar cliente
        </Button>
      </div>

      {loading && users.length === 0 ? (
        <LoadingCenter message="Cargando clientes..." />
      ) : (
        <>
          <div className="admin-list-mobile d-lg-none">
            {users.length === 0 ? (
              <p className="text-muted text-center py-4 mb-0">No hay clientes con estos filtros.</p>
            ) : (
              users.map((u) => (
                <Card key={u.id} className="card-lepra admin-list-card mb-3">
                  <Card.Body className="p-3">
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                      <div className="min-w-0 flex-grow-1">
                        <div className="admin-list-card-email fw-semibold text-dark">
                          {u.email || '—'}
                        </div>
                        {u.name && (
                          <div className="text-muted small mt-1">{u.name}</div>
                        )}
                      </div>
                      {u.active && (
                        <div className="admin-list-card-actions d-flex gap-1 flex-shrink-0">
                          <Button
                            variant="outline-dark"
                            size="sm"
                            onClick={() => handleEdit(u)}
                            aria-label={`Editar ${u.email}`}
                          >
                            <Pencil size={16} aria-hidden />
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleDeactivate(u)}
                            aria-label={`Desactivar ${u.email}`}
                          >
                            <Trash2 size={16} aria-hidden />
                          </Button>
                        </div>
                      )}
                    </div>

                    {u.location && (
                      <p className="small text-muted mb-2">{u.location}</p>
                    )}

                    <div className="d-flex flex-wrap gap-2 align-items-center">
                      <Badge bg={u.rol === 'ADMIN' ? 'dark' : 'secondary'}>{u.rol}</Badge>
                      {u.active ? (
                        <Badge bg="success">Activo</Badge>
                      ) : (
                        <Badge bg="danger">Inactivo</Badge>
                      )}
                      <ClienteSyncBadge user={u} pending={pendingUsers.has(u.id)} />
                    </div>
                  </Card.Body>
                </Card>
              ))
            )}
          </div>

          <div className="admin-list-desktop d-none d-lg-block">
            <DataTable columns={columns} data={users} getRowId={(row) => String(row.id)} />
          </div>
        </>
      )}

      {nextCursor && (
        <div className="text-center mt-3">
          <Button
            variant="outline-dark"
            className="admin-list-load-more"
            onClick={() => loadUsers(nextCursor)}
            disabled={loading}
          >
            {loading ? 'Cargando...' : 'Cargar más'}
          </Button>
        </div>
      )}

      {modalOpen && (
        <ClienteModal show onClose={onModalClose} editingUser={editingUser} />
      )}
    </div>
  )
}
