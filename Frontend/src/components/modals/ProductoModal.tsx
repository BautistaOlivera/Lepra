import { useState, useEffect, useRef } from 'react'
import { Modal, Form, Button } from 'react-bootstrap'
import { createProduct, updateProduct, uploadProductImage, getImageUrl } from '@/api/product'
import { Product } from '@/types'
import toast from 'react-hot-toast'
import { Select } from '@/components/Select'
import { isOnlineNow } from '@/offline/network'
import { enqueueCommand } from '@/offline/outbox'
import { lepraDb } from '@/offline/db'

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
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

const CATEGORIAS = [
    { value: 'Lacteos', label: 'Lácteos' },
    { value: 'Embutidos', label: 'Embutidos' },
  ]

  const isEditing = !!editingProduct
  const imgDisplayUrl = img ? getImageUrl(img) : 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=200&q=80'

  const priceNum = parseFloat(price)
  const isPriceValid = !isNaN(priceNum) && priceNum >= 0
  const isFormValid = name.trim() !== '' && isPriceValid

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!isOnlineNow()) {
      toast.error('Sin conexión: no se puede subir imagen')
      e.target.value = ''
      return
    }
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowed.includes(file.type)) {
      toast.error('Formato no permitido. Use JPEG, PNG, GIF o WebP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar 5 MB')
      return
    }
    setUploading(true)
    const { data, error } = await uploadProductImage(file)
    setUploading(false)
    if (error) {
      toast.error(error.message || 'Error al subir la imagen')
      return
    }
    if (data?.url) setImg(data.url)
    e.target.value = ''
  }

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
      if (!isOnlineNow()) {
        const patch = {
          id: editingProduct!.id,
          name,
          price: priceNum,
          brand: brand || undefined,
          category: category || undefined,
          img: img || undefined,
          has_tiered_pricing: hasTieredPricing,
        }
        await enqueueCommand('PRODUCT_UPDATE', patch)
        await lepraDb.products.update(editingProduct!.id, {
          name,
          price: priceNum,
          brand: brand || null,
          category: category || null,
          img: img || null,
          has_tiered_pricing: hasTieredPricing,
        })
        toast.success('Cambio guardado (pendiente de sincronizar)')
        onClose(true)
        setLoading(false)
        return
      }
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
      if (!isOnlineNow()) {
        if (img) {
          toast.error('Sin conexión: no se puede crear con imagen. Quita la imagen o espera a estar online.')
          setLoading(false)
          return
        }
        const tempId = -Date.now()
        const data = {
          name,
          price: priceNum,
          brand: brand || undefined,
          category: category || undefined,
          img: undefined,
          has_tiered_pricing: hasTieredPricing,
        }
        await enqueueCommand('PRODUCT_CREATE', { tempId, data })
        await lepraDb.products.put({
          id: tempId,
          name,
          price: priceNum,
          brand: brand || null,
          category: category || null,
          has_tiered_pricing: hasTieredPricing,
          img: null,
          active: true,
        } as any)
        toast.success('Producto creado (pendiente de sincronizar)')
        onClose(true)
        setLoading(false)
        return
      }
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
            <Select<string>
              options={CATEGORIAS}
              value={category || null}
              onChange={(v) => setCategory(v ?? '')}
              placeholder="Seleccionar categoría..."
              isSearchable={false}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Imagen del producto</Form.Label>
            <div className="d-flex align-items-start gap-3">
              <div
                className="border rounded overflow-hidden bg-light"
                style={{ width: 80, height: 80, flexShrink: 0 }}
              >
                <img
                  src={imgDisplayUrl}
                  alt="Vista previa"
                  className="w-100 h-100 object-fit-cover"
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="d-none"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline-dark"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? 'Subiendo...' : img ? 'Cambiar imagen' : 'Subir imagen'}
                </Button>
                {img && (
                  <Button type="button" variant="link" size="sm" className="text-muted ms-1" onClick={() => setImg('')}>
                    Quitar
                  </Button>
                )}
              </div>
            </div>
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
            <Button type="submit" className="btn-lepra" disabled={loading || !isFormValid}>
              {loading ? 'Guardando...' : isEditing ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  )
}
