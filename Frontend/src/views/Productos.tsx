import { useState, useEffect } from 'react'
import { Table, Button, Badge, Spinner } from 'react-bootstrap'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { getProductsPaginated, deactivateProduct, getImageUrl } from '@/api/product'
import { Product } from '@/types'
import toast from 'react-hot-toast'
import { ProductoModal } from '@/components/modals/ProductoModal'

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=80&q=80'

export function Productos() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  async function loadProducts(lastId?: number) {
    setLoading(true)
    const { data } = await getProductsPaginated({
      limit: 20,
      last_seen_id: lastId ?? null,
      filters: { active: undefined },
    })
    if (data) {
      setProducts((prev) => (lastId ? [...prev, ...data.items] : data.items))
      setNextCursor(data.next_cursor)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadProducts()
  }, [])

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
    if (refresh) loadProducts()
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="text-dark mb-0">Productos</h2>
        <Button className="btn-lepra" onClick={handleAdd}>
          <Plus size={18} className="me-1" /> Agregar producto
        </Button>
      </div>

      {loading && products.length === 0 ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : (
        <Table responsive hover>
          <thead className="table-dark">
            <tr>
              <th style={{ width: 60 }}></th>
              <th>Nombre</th>
              <th>Marca</th>
              <th>Categoría</th>
              <th>Precio</th>
              <th>Tramos</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  <img
                    src={getImageUrl(p.img) || DEFAULT_IMG}
                    alt={p.name}
                    style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }}
                  />
                </td>
                <td>{p.name}</td>
                <td>{p.brand || '-'}</td>
                <td>{p.category || '-'}</td>
                <td>${p.price.toFixed(2)}</td>
                <td>{p.has_tiered_pricing ? <Badge bg="warning" className="text-dark">Sí</Badge> : '-'}</td>
                <td>{p.active ? <Badge bg="success">Activo</Badge> : <Badge bg="danger">Inactivo</Badge>}</td>
                <td>
                  {p.active && (
                    <>
                      <Button variant="link" size="sm" className="text-dark p-0 me-2" onClick={() => handleEdit(p)}>
                        <Pencil size={16} />
                      </Button>
                      <Button variant="link" size="sm" className="text-danger p-0" onClick={() => handleDeactivate(p)}>
                        <Trash2 size={16} />
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
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
