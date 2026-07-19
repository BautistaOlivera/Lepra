import { useState, useEffect, useCallback } from 'react'
import { Button, Badge, Form, InputGroup, Card } from 'react-bootstrap'
import { LoadingCenter } from '@/components/LoadingOverlay'
import { Plus, Pencil, Trash2, Search, CheckCircle2, CircleAlert, Settings, Package } from 'lucide-react'
import { createColumnHelper } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import { deactivateProduct, getImageUrl, setProductVisibility } from '@/api/product'
import { getProductsPaginatedOfflineFirst, isProductInactive } from '@/repositories/productsRepo'
import {
  isProductInCatalog,
  PRODUCT_ADMIN_STATUS_FILTER_LABELS,
  PRODUCT_STATUS_LABELS,
  productStatus,
  type ProductAdminStatusFilter,
  type ProductStatus,
} from '@/lib/productStatus'
import { Product } from '@/types'
import toast from 'react-hot-toast'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'
import { formatWeight, hasWeight } from '@/lib/formatWeight'
import { ProductoModal } from '@/components/modals/ProductoModal'
import { DataTable } from '@/components/DataTable'
import { Select } from '@/components/Select'
import { AdminFilterResetButton } from '@/components/AdminFilterResetButton'
import { AdminPageHero } from '@/components/AdminPageHero'
import { isOnlineNow } from '@/offline/network'
import { enqueueCommand } from '@/offline/outbox'
import { lepraDb } from '@/offline/db'
import { useOutboxPending } from '@/offline/useOutboxPending'
import { releaseBootstrapModalLock } from '@/lib/bootstrapModal'
import { useConfirm } from '@/context/ConfirmContext'
import { productPlaceholderImg } from '@/lib/brandingAssets'

const columnHelper = createColumnHelper<Product>()

function ProductoSyncBadge({ product, pending }: { product: Product; pending: boolean }) {
  if (product.id < 0 || pending) {
    return (
      <CircleAlert
        size={18}
        className="text-warning"
        aria-label="Pendiente de sincronizar"
      />
    )
  }
  return <CheckCircle2 size={18} className="text-success" aria-label="Sincronizado" />
}

function statusBadgeVariant(status: ProductStatus): string {
  if (status === 'active') return 'success'
  if (status === 'sin_stock') return 'warning'
  return 'danger'
}

export function Productos() {
  const confirm = useConfirm()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<ProductAdminStatusFilter>('all')
  const { products: pendingProducts, refresh: refreshPending } = useOutboxPending()

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const loadProducts = useCallback(async (lastId?: number) => {
    setLoading(true)
    const filters: Record<string, unknown> = { admin_list: true, status: statusFilter }
    if (searchDebounced.trim()) filters.search = searchDebounced.trim()
    if (categoryFilter) filters.category = categoryFilter
    const { data } = await getProductsPaginatedOfflineFirst({
      limit: 20,
      last_seen_id: lastId ?? null,
      filters,
    })
    if (data) {
      setProducts((prev) => (lastId ? [...prev, ...data.items] : data.items))
      setNextCursor(data.next_cursor)
    }
    setLoading(false)
  }, [searchDebounced, categoryFilter, statusFilter])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  function handleAdd() {
    setEditingProduct(null)
    setModalOpen(true)
  }

  function handleEdit(p: Product) {
    setEditingProduct(p)
    setModalOpen(true)
  }

  async function handleToggleCatalogVisibility(p: Product) {
    const current = productStatus(p)
    if (current === 'inactive') return
    const next: ProductStatus = current === 'active' ? 'sin_stock' : 'active'
    if (!isOnlineNow()) {
      await enqueueCommand('PRODUCT_UPDATE', { id: p.id, status: next })
      await lepraDb.products.update(p.id, { status: next, active: true })
      toast.success(
        next === 'sin_stock'
          ? 'Marcado sin stock (pendiente de sincronizar)'
          : 'Visible en catálogo (pendiente de sincronizar)',
      )
      refreshPending().catch(() => {})
      loadProducts()
      return
    }
    const { error } = await setProductVisibility(p.id, next)
    if (error) toast.error(error.message)
    else {
      toast.success(next === 'sin_stock' ? 'Producto sin stock' : 'Producto visible en catálogo')
      loadProducts()
    }
  }

  async function handleDeactivate(p: Product) {
    const ok = await confirm({
      title: 'Desactivar producto',
      message: `¿Desactivar "${p.name}"? Dejará de mostrarse en el catálogo.`,
      confirmLabel: 'Desactivar',
    })
    if (!ok) return
    if (!isOnlineNow()) {
      await enqueueCommand('PRODUCT_DEACTIVATE', { id: p.id })
      await lepraDb.products.update(p.id, { active: false, status: 'inactive' })
      toast.success('Cambio guardado (pendiente de sincronizar)')
      refreshPending().catch(() => {})
      loadProducts()
      return
    }
    const { error } = await deactivateProduct(p.id)
    if (error) toast.error(error.message)
    else {
      toast.success('Producto desactivado')
      loadProducts()
    }
  }

  function onModalClose(refresh?: boolean) {
    setModalOpen(false)
    setEditingProduct(null)
    releaseBootstrapModalLock()
    if (refresh) {
      refreshPending().catch(() => {})
      loadProducts()
    }
  }

  function clearFilters() {
    setSearch('')
    setCategoryFilter(null)
    setStatusFilter('all')
  }

  const columns = [
    columnHelper.display({
      id: 'img',
      header: '',
      size: 60,
      cell: ({ row }) => (
        <img
          src={getImageUrl(row.original.img) || productPlaceholderImg(row.original.category)}
          alt={row.original.name}
          style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }}
        />
      ),
    }),
    columnHelper.accessor('name', { header: 'Nombre' }),
    columnHelper.accessor('brand', { header: 'Marca', cell: (info) => info.getValue() || '-' }),
    columnHelper.accessor('category', { header: 'Categoría', cell: (info) => info.getValue() || '-' }),
    columnHelper.accessor('weight', {
      header: 'Peso',
      size: 68,
      meta: { align: 'start' },
      cell: (info) => {
        const w = info.getValue()
        return hasWeight(w) ? formatWeight(w) : '-'
      },
    }),
    columnHelper.accessor('price', {
      header: 'Precio',
      size: 96,
      meta: { align: 'start' },
      cell: (info) => formatMoneyWithSymbol(info.getValue()),
    }),
    columnHelper.accessor('has_tiered_pricing', {
      header: () => <span className="d-block text-center">Volumen</span>,
      size: 92,
      cell: (info) => (
        <div className="text-center">
          {info.getValue() ? <Badge bg="success">Sí</Badge> : '-'}
        </div>
      ),
    }),
    columnHelper.display({
      id: 'status',
      header: 'Estado',
      size: 100,
      cell: ({ row }) => {
        const status = productStatus(row.original)
        return <Badge bg={statusBadgeVariant(status)}>{PRODUCT_STATUS_LABELS[status]}</Badge>
      },
    }),
    columnHelper.display({
      id: 'sync',
      header: () => (
        <span className="d-flex justify-content-center" title="Sincronización" aria-label="Sincronización">
          <CheckCircle2 size={16} aria-hidden />
        </span>
      ),
      size: 40,
      cell: ({ row }) => (
        <div className="text-center">
          <ProductoSyncBadge product={row.original} pending={pendingProducts.has(row.original.id)} />
        </div>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: () => (
        <span className="d-flex justify-content-center" title="Opciones" aria-label="Opciones">
          <Settings size={16} aria-hidden />
        </span>
      ),
      size: 88,
      cell: ({ row }) => {
        const p = row.original
        if (isProductInactive(p)) return null
        const inCatalog = isProductInCatalog(p)
        return (
          <div className="d-flex align-items-center justify-content-center gap-1">
            <Button
              variant="link"
              size="sm"
              className={`p-0 ${inCatalog ? 'text-success' : 'text-warning'}`}
              onClick={() => handleToggleCatalogVisibility(p)}
              aria-label={inCatalog ? `Marcar sin stock: ${p.name}` : `Mostrar en catálogo: ${p.name}`}
              title={inCatalog ? 'Marcar sin stock' : 'Mostrar en catálogo'}
            >
              <Package size={16} aria-hidden />
            </Button>
            <Button
              variant="link"
              size="sm"
              className="text-dark p-0"
              onClick={() => handleEdit(p)}
              aria-label={`Editar ${p.name}`}
            >
              <Pencil size={16} />
            </Button>
            <Button
              variant="link"
              size="sm"
              className="text-danger p-0"
              onClick={() => handleDeactivate(p)}
              aria-label={`Desactivar ${p.name}`}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        )
      },
    }),
  ]

  return (
    <div className="admin-list-page">
      <AdminPageHero>
        <span className="d-inline-flex align-items-center gap-2">
          <Package size={28} aria-hidden />
          Productos
        </span>
      </AdminPageHero>

      <div className="admin-list-toolbar">
        <InputGroup className="admin-list-search">
          <InputGroup.Text>
            <Search size={18} aria-hidden />
          </InputGroup.Text>
          <Form.Control
            placeholder="Buscar por nombre o marca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar productos"
          />
        </InputGroup>

        <div className="admin-list-filters-row">
          <div className="admin-list-filter">
            <Select<string>
              options={[
                { value: '', label: 'Todas las categorías' },
                { value: 'Lacteos', label: 'Lácteos' },
                { value: 'Embutidos', label: 'Embutidos' },
              ]}
              value={categoryFilter ?? ''}
              onChange={(v) => setCategoryFilter(v || null)}
              placeholder="Categoría"
              isSearchable={false}
            />
          </div>
          <div className="admin-list-filter">
            <Select<string>
              options={(
                Object.entries(PRODUCT_ADMIN_STATUS_FILTER_LABELS) as [ProductAdminStatusFilter, string][]
              ).map(([value, label]) => ({ value, label }))}
              value={statusFilter}
              onChange={(v) => setStatusFilter((v as ProductAdminStatusFilter) || 'all')}
              placeholder="Estado"
              isSearchable={false}
            />
          </div>
          <AdminFilterResetButton onClick={clearFilters} />
        </div>

        <Button className="btn-lepra admin-list-add-btn" onClick={handleAdd}>
          <Plus size={18} className="me-1" aria-hidden /> Agregar producto
        </Button>
      </div>

      {loading && products.length === 0 ? (
        <LoadingCenter message="Cargando productos..." />
      ) : (
        <>
          <div className="admin-list-mobile d-lg-none">
            {products.length === 0 ? (
              <p className="text-muted text-center py-4 mb-0">No hay productos con estos filtros.</p>
            ) : (
              products.map((p) => (
                <Card key={p.id} className="card-lepra admin-list-card mb-3">
                  <Card.Body className="p-3">
                    <div className="d-flex gap-3 align-items-start">
                      <Link
                        to={`/producto/${p.id}`}
                        className="flex-shrink-0"
                        aria-label={`Ver ${p.name}`}
                      >
                        <img
                          src={getImageUrl(p.img) || productPlaceholderImg(p.category)}
                          alt=""
                          className="admin-list-card-image rounded"
                        />
                      </Link>
                      <div className="min-w-0 flex-grow-1 overflow-hidden">
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div className="min-w-0 flex-grow-1 overflow-hidden">
                            <div className="fw-semibold text-dark admin-list-card-title">{p.name}</div>
                            {p.brand && (
                              <div className="text-muted small mt-1 admin-list-card-subtitle">{p.brand}</div>
                            )}
                            {hasWeight(p.weight) && (
                              <div className="text-muted small admin-list-card-subtitle">{formatWeight(p.weight)}</div>
                            )}
                            <div className="fw-bold text-dark mt-1">{formatMoneyWithSymbol(p.price)}</div>
                          </div>
                          {!isProductInactive(p) && (
                            <div className="admin-list-card-actions d-flex gap-1 flex-shrink-0">
                              <Button
                                variant={isProductInCatalog(p) ? 'outline-success' : 'outline-warning'}
                                size="sm"
                                onClick={() => handleToggleCatalogVisibility(p)}
                                aria-label={
                                  isProductInCatalog(p)
                                    ? `Marcar sin stock: ${p.name}`
                                    : `Mostrar en catálogo: ${p.name}`
                                }
                                title={isProductInCatalog(p) ? 'Marcar sin stock' : 'Mostrar en catálogo'}
                              >
                                <Package size={16} aria-hidden />
                              </Button>
                              <Button
                                variant="outline-dark"
                                size="sm"
                                onClick={() => handleEdit(p)}
                                aria-label={`Editar ${p.name}`}
                              >
                                <Pencil size={16} aria-hidden />
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleDeactivate(p)}
                                aria-label={`Desactivar ${p.name}`}
                              >
                                <Trash2 size={16} aria-hidden />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="d-flex flex-wrap gap-2 align-items-center mt-2">
                          {p.category && (
                            <Badge bg="secondary">{p.category}</Badge>
                          )}
                          {p.has_tiered_pricing && (
                            <Badge bg="success">Volumen</Badge>
                          )}
                          <Badge bg={statusBadgeVariant(productStatus(p))}>
                            {PRODUCT_STATUS_LABELS[productStatus(p)]}
                          </Badge>
                          <ProductoSyncBadge product={p} pending={pendingProducts.has(p.id)} />
                        </div>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              ))
            )}
          </div>

          <div className="admin-list-desktop d-none d-lg-block">
            <DataTable columns={columns} data={products} getRowId={(row) => String(row.id)} />
          </div>
        </>
      )}

      {nextCursor && (
        <div className="text-center mt-3">
          <Button
            variant="outline-dark"
            className="admin-list-load-more"
            onClick={() => loadProducts(nextCursor)}
            disabled={loading}
          >
            {loading ? 'Cargando...' : 'Cargar más'}
          </Button>
        </div>
      )}

      {modalOpen && (
        <ProductoModal show onClose={onModalClose} editingProduct={editingProduct} />
      )}
    </div>
  )
}
