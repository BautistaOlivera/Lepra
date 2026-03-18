import { useState, useEffect, useCallback } from 'react'
import { Button, Badge, Spinner, Form, InputGroup } from 'react-bootstrap'
import { Plus, Pencil, Trash2, Search, RotateCcw } from 'lucide-react'
import { createColumnHelper } from '@tanstack/react-table'
import { deactivateProduct, getImageUrl } from '@/api/product'
import { getProductsPaginatedOfflineFirst } from '@/repositories/productsRepo'
import { Product } from '@/types'
import toast from 'react-hot-toast'
import { ProductoModal } from '@/components/modals/ProductoModal'
import { DataTable } from '@/components/DataTable'
import { Select } from '@/components/Select'
import { isOnlineNow } from '@/offline/network'
import { enqueueCommand } from '@/offline/outbox'
import { lepraDb } from '@/offline/db'
import { useOutboxPending } from '@/offline/useOutboxPending'

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=80&q=80'
const columnHelper = createColumnHelper<Product>()

export function Productos() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<boolean | null>(true)
  const { products: pendingProducts, refresh: refreshPending } = useOutboxPending()

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const loadProducts = useCallback(async (lastId?: number) => {
    setLoading(true)
    const filters: Record<string, unknown> = {}
    if (searchDebounced.trim()) filters.search = searchDebounced.trim()
    if (categoryFilter) filters.category = categoryFilter
    if (activeFilter !== null) filters.active = activeFilter
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
  }, [searchDebounced, categoryFilter, activeFilter])

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

  async function handleDeactivate(p: Product) {
    if (!confirm(`¿Desactivar "${p.name}"?`)) return
    if (!isOnlineNow()) {
      await enqueueCommand('PRODUCT_DEACTIVATE', { id: p.id })
      await lepraDb.products.update(p.id, { active: false })
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
    if (refresh) {
      refreshPending().catch(() => {})
      loadProducts()
    }
  }

  function clearFilters() {
    setSearch('')
    setCategoryFilter(null)
    setActiveFilter(true)
  }

  const columns = [
    columnHelper.display({
      id: 'img',
      header: '',
      size: 60,
      cell: ({ row }) => (
        <img
          src={getImageUrl(row.original.img) || DEFAULT_IMG}
          alt={row.original.name}
          style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }}
        />
      ),
    }),
    columnHelper.accessor('name', { header: 'Nombre' }),
    columnHelper.accessor('brand', { header: 'Marca', cell: (info) => info.getValue() || '-' }),
    columnHelper.accessor('category', { header: 'Categoría', cell: (info) => info.getValue() || '-' }),
    columnHelper.accessor('price', {
      header: 'Precio',
      cell: (info) => `$${info.getValue().toFixed(2)}`,
    }),
    columnHelper.accessor('has_tiered_pricing', {
      header: 'Tramos',
      cell: (info) =>
        info.getValue() ? <Badge bg="warning" className="text-dark">Sí</Badge> : '-',
    }),
    columnHelper.accessor('active', {
      header: 'Estado',
      cell: (info) =>
        info.getValue() ? <Badge bg="success">Activo</Badge> : <Badge bg="danger">Inactivo</Badge>,
    }),
    columnHelper.display({
      id: 'sync',
      header: 'Sync',
      cell: ({ row }) =>
        row.original.id < 0 || pendingProducts.has(row.original.id) ? (
          <Badge bg="warning" className="text-dark">Pendiente</Badge>
        ) : null,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.active ? (
          <>
            <Button variant="link" size="sm" className="text-dark p-0 me-2" onClick={() => handleEdit(row.original)}>
              <Pencil size={16} />
            </Button>
            <Button variant="link" size="sm" className="text-danger p-0" onClick={() => handleDeactivate(row.original)}>
              <Trash2 size={16} />
            </Button>
          </>
        ) : null,
    }),
  ]

  return (
    <>
      <h2 className="text-dark mb-3">Productos</h2>
      <div className="d-flex align-items-center gap-3 mb-4 flex-wrap" style={{ width: '100%' }}>
        <InputGroup className="flex-grow-1" style={{ minWidth: 200, maxWidth: 340 }}>
          <InputGroup.Text><Search size={18} /></InputGroup.Text>
          <Form.Control
            placeholder="Buscar por nombre o marca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
        <div style={{ minWidth: 150, width: 150 }}>
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
        <div style={{ minWidth: 150, width: 150 }}>
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
        <Button
          variant="outline-secondary"
          onClick={clearFilters}
          title="Limpiar filtros"
          className="d-flex align-items-center justify-content-center p-0 flex-shrink-0"
          style={{ height: 38, width: 38 }}
        >
          <RotateCcw size={18} />
        </Button>
        <Button className="btn-lepra flex-shrink-0 ms-auto" onClick={handleAdd}>
          <Plus size={18} className="me-1" /> Agregar producto
        </Button>
      </div>

      {loading && products.length === 0 ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : (
        <DataTable columns={columns} data={products} getRowId={(row) => String(row.id)} />
      )}

      {nextCursor && (
        <div className="text-center mt-3">
          <Button variant="outline-dark" size="sm" onClick={() => loadProducts(nextCursor)} disabled={loading}>
            Cargar más
          </Button>
        </div>
      )}

      <ProductoModal show={modalOpen} onClose={onModalClose} editingProduct={editingProduct} />
    </>
  )
}
