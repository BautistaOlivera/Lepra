import { useState, useEffect } from 'react'
import { Modal, Form, Button } from 'react-bootstrap'
import { createProduct, updateProduct } from '@/api/product'
import { Product } from '@/types'
import toast from 'react-hot-toast'

interface ProductoModalProps {
  show: boolean
  onClose: (refresh?: boolean) => void
  editingProduct: Product | null
}

export function ProductoModal({ show, onClose, editingProduct }: ProductoModalProps) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('')
  const [img, setImg] = useState('')
  const [hasTieredPricing, setHasTieredPricing] = useState(false)
  const [loading, setLoading] = useState(false)

  const isEditing = !!editingProduct

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name)
      setPrice(String(editingProduct.price))
      setBrand(editingProduct.brand || '')
      setCategory(editingProduct.category || '')
      setImg(editingProduct.img || '')
      setHasTieredPricing(editingProduct.has_tiered_pricing)
    } else {
      setName('')
      setPrice('')
      setBrand('')
      setCategory('')
      setImg('')
      setHasTieredPricing(false)
    }
  }, [editingProduct, show])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Precio inválido')
      return
    }
    setLoading(true)
    if (isEditing) {
      const { error } = await updateProduct({
        id: editingProduct!.id,
        name,
        price: priceNum,
        brand: brand || undefined,
        category: category || undefined,
        img: img || undefined,
        has_tiered_pricing: hasTieredPricing,
      })
      if (error) toast.error(error.message)
      else {
        toast.success('Producto actualizado')
        onClose(true)
      }
    } else {
      const { error } = await createProduct({
        name,
        price: priceNum,
        brand: brand || undefined,
        category: category || undefined,
        img: img || undefined,
        has_tiered_pricing: hasTieredPricing,
      })
      if (error) toast.error(error.message)
      else {
        toast.success('Producto creado')
        onClose(true)
      }
    }
    setLoading(false)
  }

  return (
    <Modal show={show} onHide={() => onClose()}>
      <Modal.Header closeButton className="border-dark">
        <Modal.Title>{isEditing ? 'Editar producto' : 'Agregar producto'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Nombre</Form.Label>
            <Form.Control value={name} onChange={(e) => setName(e.target.value)} required />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Precio base</Form.Label>
            <Form.Control
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Marca</Form.Label>
            <Form.Control value={brand} onChange={(e) => setBrand(e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Categoría</Form.Label>
            <Form.Control value={category} onChange={(e) => setCategory(e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>URL imagen</Form.Label>
            <Form.Control value={img} onChange={(e) => setImg(e.target.value)} placeholder="https://..." />
          </Form.Group>
          <Form.Group className="mb-4">
            <Form.Check
              type="checkbox"
              label="Tiene precios por volumen"
              checked={hasTieredPricing}
              onChange={(e) => setHasTieredPricing(e.target.checked)}
            />
          </Form.Group>
          <div className="d-flex justify-content-end gap-2">
            <Button variant="outline-dark" onClick={() => onClose()}>Cancelar</Button>
            <Button type="submit" className="btn-lepra" disabled={loading}>
              {loading ? 'Guardando...' : isEditing ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  )
}
