import { useCallback, useEffect, useState } from 'react'
import { Badge, Button, Card, Form, InputGroup } from 'react-bootstrap'
import { CheckCircle2, Pencil, Plus, Search, Trash2, Truck } from 'lucide-react'
import { createColumnHelper } from '@tanstack/react-table'
import { LoadingCenter } from '@/components/LoadingOverlay'
import { DataTable } from '@/components/DataTable'
import { Select } from '@/components/Select'
import { AdminFilterResetButton } from '@/components/AdminFilterResetButton'
import { AdminPageHero } from '@/components/AdminPageHero'
import { ProveedorModal } from '@/components/modals/ProveedorModal'
import { AbastecimientoModal } from '@/components/modals/AbastecimientoModal'
import { deactivateSupplier } from '@/api/supplier'
import { deactivatePurchase } from '@/api/purchase'
import { getSuppliersPaginatedOfflineFirst } from '@/repositories/suppliersRepo'
import { getPurchasesPaginatedOfflineFirst } from '@/repositories/purchasesRepo'
import type { Purchase, Supplier } from '@/types'
import toast from 'react-hot-toast'
import { isOnlineNow } from '@/offline/network'
import { enqueueCommand } from '@/offline/outbox'
import { lepraDb } from '@/offline/db'
import { useOutboxPending } from '@/offline/useOutboxPending'
import { releaseBootstrapModalLock } from '@/lib/bootstrapModal'
import { useConfirm } from '@/context/ConfirmContext'
import { formatDateFromApi } from '@/lib/formatDate'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'

const supplierColumns = createColumnHelper<Supplier>()
const purchaseColumns = createColumnHelper<Purchase>()

type ProveedoresSection = 'purchases' | 'suppliers'

function SyncBadge({ pending, id }: { pending: boolean; id: number }) {
  if (id < 0 || pending) return <Badge bg="warning">Pendiente</Badge>
  return <CheckCircle2 size={18} className="text-success" aria-label="Sincronizado" />
}

export function Proveedores() {
  const confirm = useConfirm()
  const { suppliers: pendingSuppliers, purchases: pendingPurchases, refresh: refreshPending } = useOutboxPending()
  const [section, setSection] = useState<ProveedoresSection>('purchases')

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierOptions, setSupplierOptions] = useState<Supplier[]>([])
  const [supplierCursor, setSupplierCursor] = useState<number | null>(null)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierSearchDebounced, setSupplierSearchDebounced] = useState('')
  const [supplierActive, setSupplierActive] = useState<boolean | null>(true)
  const [suppliersLoading, setSuppliersLoading] = useState(true)
  const [supplierModalOpen, setSupplierModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [purchaseCursor, setPurchaseCursor] = useState<number | null>(null)
  const [purchaseSearch, setPurchaseSearch] = useState('')
  const [purchaseSearchDebounced, setPurchaseSearchDebounced] = useState('')
  const [purchaseSupplier, setPurchaseSupplier] = useState<number | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [purchaseActive, setPurchaseActive] = useState<boolean | null>(true)
  const [purchasesLoading, setPurchasesLoading] = useState(true)
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSupplierSearchDebounced(supplierSearch), 300)
    return () => clearTimeout(t)
  }, [supplierSearch])

  useEffect(() => {
    const t = setTimeout(() => setPurchaseSearchDebounced(purchaseSearch), 300)
    return () => clearTimeout(t)
  }, [purchaseSearch])

  const loadSupplierOptions = useCallback(async () => {
    const acc: Supplier[] = []
    let cursor: number | null = null
    for (let page = 0; page < 20; page++) {
      const { data } = await getSuppliersPaginatedOfflineFirst({
        limit: 100,
        last_seen_id: cursor,
        filters: {},
      })
      const items = data?.items ?? []
      acc.push(...items)
      cursor = data?.next_cursor ?? null
      if (!cursor || items.length === 0) break
    }
    setSupplierOptions(acc)
  }, [])

  const loadSuppliers = useCallback(
    async (lastId?: number) => {
      setSuppliersLoading(true)
      const filters: Record<string, unknown> = {}
      if (supplierSearchDebounced.trim()) filters.search = supplierSearchDebounced.trim()
      if (supplierActive !== null) filters.active = supplierActive
      const { data, error } = await getSuppliersPaginatedOfflineFirst({
        limit: 20,
        last_seen_id: lastId ?? null,
        filters,
      })
      if (error) toast.error(error.message)
      if (data) {
        setSuppliers((prev) => (lastId ? [...prev, ...data.items] : data.items))
        setSupplierCursor(data.next_cursor)
      }
      setSuppliersLoading(false)
    },
    [supplierSearchDebounced, supplierActive],
  )

  const loadPurchases = useCallback(
    async (lastId?: number) => {
      setPurchasesLoading(true)
      const filters: Record<string, unknown> = {}
      if (purchaseSearchDebounced.trim()) filters.search = purchaseSearchDebounced.trim()
      if (purchaseSupplier) filters.id_supplier = purchaseSupplier
      if (dateFrom) filters.date_from = dateFrom
      if (dateTo) filters.date_to = dateTo
      if (purchaseActive !== null) filters.active = purchaseActive
      const { data, error } = await getPurchasesPaginatedOfflineFirst({
        limit: 20,
        last_seen_id: lastId ?? null,
        filters,
      })
      if (error) toast.error(error.message)
      if (data) {
        setPurchases((prev) => (lastId ? [...prev, ...data.items] : data.items))
        setPurchaseCursor(data.next_cursor)
      }
      setPurchasesLoading(false)
    },
    [purchaseSearchDebounced, purchaseSupplier, dateFrom, dateTo, purchaseActive],
  )

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  useEffect(() => {
    loadPurchases()
  }, [loadPurchases])

  useEffect(() => {
    loadSupplierOptions().catch(() => {})
  }, [loadSupplierOptions])

  async function handleDeactivateSupplier(supplier: Supplier) {
    const ok = await confirm({
      title: 'Desactivar proveedor',
      message: `¿Desactivar a ${supplier.name}? Los abastecimientos que ya tiene se conservan.`,
      confirmLabel: 'Desactivar',
    })
    if (!ok) return
    if (!isOnlineNow()) {
      await enqueueCommand('SUPPLIER_DEACTIVATE', { id: supplier.id })
      await lepraDb.suppliers.update(supplier.id, { active: false })
      toast.success('Cambio guardado (pendiente de sincronizar)')
      refreshPending().catch(() => {})
      loadSuppliers()
      loadSupplierOptions().catch(() => {})
      return
    }
    const { error } = await deactivateSupplier(supplier.id)
    if (error) toast.error(error.message)
    else {
      toast.success('Proveedor desactivado')
      loadSuppliers()
      loadSupplierOptions().catch(() => {})
    }
  }

  async function handleDeactivatePurchase(purchase: Purchase) {
    const ok = await confirm({
      title: 'Desactivar abastecimiento',
      message: 'Se oculta de la lista de activos. No modifica productos ni stock.',
      confirmLabel: 'Desactivar',
    })
    if (!ok) return
    if (!isOnlineNow()) {
      await enqueueCommand('PURCHASE_DEACTIVATE', { id: purchase.id })
      await lepraDb.purchases.update(purchase.id, { active: false })
      toast.success('Cambio guardado (pendiente de sincronizar)')
      refreshPending().catch(() => {})
      loadPurchases()
      return
    }
    const { error } = await deactivatePurchase(purchase.id)
    if (error) toast.error(error.message)
    else {
      toast.success('Abastecimiento desactivado')
      loadPurchases()
    }
  }

  function closeSupplierModal(refresh?: boolean) {
    setSupplierModalOpen(false)
    setEditingSupplier(null)
    releaseBootstrapModalLock()
    if (refresh) {
      refreshPending().catch(() => {})
      loadSuppliers()
      loadSupplierOptions().catch(() => {})
    }
  }

  function closePurchaseModal(refresh?: boolean) {
    setPurchaseModalOpen(false)
    setEditingPurchase(null)
    releaseBootstrapModalLock()
    if (refresh) {
      refreshPending().catch(() => {})
      loadPurchases()
    }
  }

  const supplierCols = [
    supplierColumns.accessor('name', { header: 'Nombre' }),
    supplierColumns.accessor('active', {
      header: () => <span className="d-block text-center">Estado</span>,
      cell: (info) => (
        <div className="text-center">
          {info.getValue() ? <Badge bg="success">Activo</Badge> : <Badge bg="danger">Inactivo</Badge>}
        </div>
      ),
    }),
    supplierColumns.display({
      id: 'sync',
      header: () => <span className="d-block text-center">Sincronización</span>,
      cell: ({ row }) => (
        <div className="text-center">
          <SyncBadge id={row.original.id} pending={pendingSuppliers.has(row.original.id)} />
        </div>
      ),
    }),
    supplierColumns.display({
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.active ? (
          <>
            <Button
              variant="link"
              size="sm"
              className="text-dark p-0 me-2"
              onClick={() => {
                setEditingSupplier(row.original)
                setSupplierModalOpen(true)
              }}
              aria-label={`Editar ${row.original.name}`}
            >
              <Pencil size={16} />
            </Button>
            <Button
              variant="link"
              size="sm"
              className="text-danger p-0"
              onClick={() => handleDeactivateSupplier(row.original)}
              aria-label={`Desactivar ${row.original.name}`}
            >
              <Trash2 size={16} />
            </Button>
          </>
        ) : null,
    }),
  ]

  const purchaseCols = [
    purchaseColumns.accessor('date', {
      header: 'Fecha',
      cell: (info) => formatDateFromApi(info.getValue()),
    }),
    purchaseColumns.accessor('supplier_name', {
      header: 'Proveedor',
      cell: (info) => info.getValue() || '—',
    }),
    purchaseColumns.accessor('total', {
      header: 'Total',
      cell: (info) => formatMoneyWithSymbol(info.getValue()),
    }),
    purchaseColumns.display({
      id: 'products',
      header: 'Productos',
      cell: ({ row }) => {
        const count = row.original.lines?.length ?? 0
        return count > 0 ? String(count) : '—'
      },
    }),
    purchaseColumns.accessor('note', {
      header: 'Nota',
      cell: (info) => info.getValue() || '—',
    }),
    purchaseColumns.display({
      id: 'sync',
      header: () => <span className="d-block text-center">Sincronización</span>,
      cell: ({ row }) => (
        <div className="text-center">
          <SyncBadge id={row.original.id} pending={pendingPurchases.has(row.original.id)} />
        </div>
      ),
    }),
    purchaseColumns.display({
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.active ? (
          <>
            <Button
              variant="link"
              size="sm"
              className="text-dark p-0 me-2"
              onClick={() => {
                setEditingPurchase(row.original)
                setPurchaseModalOpen(true)
              }}
              aria-label="Editar abastecimiento"
            >
              <Pencil size={16} />
            </Button>
            <Button
              variant="link"
              size="sm"
              className="text-danger p-0"
              onClick={() => handleDeactivatePurchase(row.original)}
              aria-label="Desactivar abastecimiento"
            >
              <Trash2 size={16} />
            </Button>
          </>
        ) : null,
    }),
  ]

  return (
    <div className="admin-list-page">
      <AdminPageHero subtitle="Proveedores y lo que se les compra. No mueve stock.">
        <span className="d-inline-flex align-items-center gap-2">
          <Truck size={28} aria-hidden />
          Proveedores
        </span>
      </AdminPageHero>

      <div className="btn-group mb-3" role="tablist" aria-label="Sección">
        <Button
          type="button"
          role="tab"
          aria-selected={section === 'purchases'}
          variant={section === 'purchases' ? 'primary' : 'outline-dark'}
          className={section === 'purchases' ? 'btn-lepra' : undefined}
          onClick={() => setSection('purchases')}
        >
          Abastecimientos
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={section === 'suppliers'}
          variant={section === 'suppliers' ? 'primary' : 'outline-dark'}
          className={section === 'suppliers' ? 'btn-lepra' : undefined}
          onClick={() => setSection('suppliers')}
        >
          Proveedores
        </Button>
      </div>

      {section === 'suppliers' ? (
      <section>
        <div className="admin-list-toolbar">
          <InputGroup className="admin-list-search">
            <InputGroup.Text>
              <Search size={18} aria-hidden />
            </InputGroup.Text>
            <Form.Control
              placeholder="Buscar proveedor..."
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              aria-label="Buscar proveedor"
            />
          </InputGroup>
          <div className="admin-list-filters-row">
            <div className="admin-list-filter">
              <Select<string>
                options={[
                  { value: 'true', label: 'Activos' },
                  { value: 'false', label: 'Inactivos' },
                  { value: 'all', label: 'Todos' },
                ]}
                value={supplierActive === null ? 'all' : String(supplierActive)}
                onChange={(v) => setSupplierActive(v === 'all' || v === '' ? null : v === 'true')}
                placeholder="Estado"
                isSearchable={false}
              />
            </div>
            <AdminFilterResetButton
              onClick={() => {
                setSupplierSearch('')
                setSupplierActive(true)
              }}
            />
          </div>
          <Button
            className="btn-lepra admin-list-add-btn"
            onClick={() => {
              setEditingSupplier(null)
              setSupplierModalOpen(true)
            }}
          >
            <Plus size={18} className="me-1" aria-hidden /> Agregar proveedor
          </Button>
        </div>

        {suppliersLoading && suppliers.length === 0 ? (
          <LoadingCenter message="Cargando proveedores..." />
        ) : (
          <>
            <div className="admin-list-mobile d-lg-none">
              {suppliers.length === 0 ? (
                <p className="text-muted text-center py-4 mb-0">No hay proveedores con estos filtros.</p>
              ) : (
                suppliers.map((supplier) => (
                  <Card key={supplier.id} className="card-lepra admin-list-card mb-3">
                    <Card.Body className="p-3">
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div>
                          <div className="fw-semibold">{supplier.name}</div>
                          <div className="d-flex gap-2 mt-2">
                            {supplier.active ? <Badge bg="success">Activo</Badge> : <Badge bg="danger">Inactivo</Badge>}
                            <SyncBadge id={supplier.id} pending={pendingSuppliers.has(supplier.id)} />
                          </div>
                        </div>
                        {supplier.active && (
                          <div className="d-flex gap-1">
                            <Button
                              variant="outline-dark"
                              size="sm"
                              onClick={() => {
                                setEditingSupplier(supplier)
                                setSupplierModalOpen(true)
                              }}
                              aria-label={`Editar ${supplier.name}`}
                            >
                              <Pencil size={16} />
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDeactivateSupplier(supplier)}
                              aria-label={`Desactivar ${supplier.name}`}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card.Body>
                  </Card>
                ))
              )}
            </div>
            <div className="admin-list-desktop d-none d-lg-block">
              <DataTable columns={supplierCols} data={suppliers} getRowId={(row) => String(row.id)} />
            </div>
          </>
        )}
        {supplierCursor && (
          <div className="text-center mt-3">
            <Button variant="outline-dark" onClick={() => loadSuppliers(supplierCursor)} disabled={suppliersLoading}>
              {suppliersLoading ? 'Cargando...' : 'Cargar más'}
            </Button>
          </div>
        )}
      </section>
      ) : (
      <section>
        <div className="admin-list-toolbar">
          <InputGroup className="admin-list-search">
            <InputGroup.Text>
              <Search size={18} aria-hidden />
            </InputGroup.Text>
            <Form.Control
              placeholder="Buscar por proveedor o nota..."
              value={purchaseSearch}
              onChange={(e) => setPurchaseSearch(e.target.value)}
              aria-label="Buscar abastecimiento"
            />
          </InputGroup>
          <div className="admin-list-filters-row">
            <div className="admin-list-filter">
              <Select<number>
                options={[{ value: 0, label: 'Todos los proveedores' }, ...supplierOptions.map((s) => ({ value: s.id, label: s.name }))]}
                value={purchaseSupplier ?? 0}
                onChange={(v) => setPurchaseSupplier(v && v > 0 ? v : null)}
                placeholder="Proveedor"
              />
            </div>
            <Form.Control
              type="date"
              className="admin-list-date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Desde"
            />
            <Form.Control
              type="date"
              className="admin-list-date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Hasta"
            />
            <div className="admin-list-filter">
              <Select<string>
                options={[
                  { value: 'true', label: 'Activos' },
                  { value: 'false', label: 'Inactivos' },
                  { value: 'all', label: 'Todos' },
                ]}
                value={purchaseActive === null ? 'all' : String(purchaseActive)}
                onChange={(v) => setPurchaseActive(v === 'all' || v === '' ? null : v === 'true')}
                placeholder="Estado"
                isSearchable={false}
              />
            </div>
            <AdminFilterResetButton
              onClick={() => {
                setPurchaseSearch('')
                setPurchaseSupplier(null)
                setDateFrom('')
                setDateTo('')
                setPurchaseActive(true)
              }}
            />
          </div>
          <Button
            className="btn-lepra admin-list-add-btn"
            onClick={() => {
              setEditingPurchase(null)
              setPurchaseModalOpen(true)
            }}
          >
            <Plus size={18} className="me-1" aria-hidden /> Nuevo abastecimiento
          </Button>
        </div>

        {purchasesLoading && purchases.length === 0 ? (
          <LoadingCenter message="Cargando abastecimientos..." />
        ) : (
          <>
            <div className="admin-list-mobile d-lg-none">
              {purchases.length === 0 ? (
                <p className="text-muted text-center py-4 mb-0">No hay abastecimientos con estos filtros.</p>
              ) : (
                purchases.map((purchase) => (
                  <Card key={purchase.id} className="card-lepra admin-list-card mb-3">
                    <Card.Body className="p-3">
                      <div className="d-flex justify-content-between gap-2">
                        <div>
                          <div className="fw-semibold">{purchase.supplier_name || 'Proveedor'}</div>
                          <div className="text-muted small">{formatDateFromApi(purchase.date)}</div>
                          <div className="mt-1">{formatMoneyWithSymbol(purchase.total)}</div>
                          <div className="text-muted small">
                            {(purchase.lines?.length ?? 0) > 0
                              ? `${purchase.lines!.length} producto(s)`
                              : 'Sin productos'}
                          </div>
                          {purchase.note && <div className="small mt-1">{purchase.note}</div>}
                          <div className="mt-2">
                            <SyncBadge id={purchase.id} pending={pendingPurchases.has(purchase.id)} />
                          </div>
                        </div>
                        {purchase.active && (
                          <div className="d-flex gap-1">
                            <Button
                              variant="outline-dark"
                              size="sm"
                              onClick={() => {
                                setEditingPurchase(purchase)
                                setPurchaseModalOpen(true)
                              }}
                              aria-label="Editar abastecimiento"
                            >
                              <Pencil size={16} />
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDeactivatePurchase(purchase)}
                              aria-label="Desactivar abastecimiento"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card.Body>
                  </Card>
                ))
              )}
            </div>
            <div className="admin-list-desktop d-none d-lg-block">
              <DataTable columns={purchaseCols} data={purchases} getRowId={(row) => String(row.id)} />
            </div>
          </>
        )}
        {purchaseCursor && (
          <div className="text-center mt-3">
            <Button variant="outline-dark" onClick={() => loadPurchases(purchaseCursor)} disabled={purchasesLoading}>
              {purchasesLoading ? 'Cargando...' : 'Cargar más'}
            </Button>
          </div>
        )}
      </section>
      )}

      {supplierModalOpen && (
        <ProveedorModal show onClose={closeSupplierModal} editing={editingSupplier} />
      )}
      {purchaseModalOpen && (
        <AbastecimientoModal
          show
          onClose={closePurchaseModal}
          editing={editingPurchase}
          suppliers={supplierOptions}
        />
      )}
    </div>
  )
}
