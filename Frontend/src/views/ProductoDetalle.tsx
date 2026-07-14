import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from 'react-bootstrap'
import { LoadingCenter } from '@/components/LoadingOverlay'
import { ArrowLeft, ShoppingCart } from 'lucide-react'
import { getProduct } from '@/api/product'
import { Product } from '@/types'
import { useCart } from '@/context/CartContext'
import { ProductImage } from '@/components/ProductImage'
import { formatMoneyWithSymbol } from '@/lib/formatMoney'
import { formatWeight, hasWeight, parseWeightInput } from '@/lib/formatWeight'
import {
  defaultLineWeightKg,
  isFixedWeightProduct,
  minKgFromPieces,
  pieceWeightKg,
  tierLabel,
  validateLineWeightKg,
} from '@/lib/pricing'
import { QuantityStepper } from '@/components/QuantityStepper'
import { DecimalInput } from '@/components/DecimalInput'
import toast from 'react-hot-toast'

export function ProductoDetalle() {
  const { id } = useParams()
  const { addItem, updateWeight, items } = useCart()
  const [product, setProduct] = useState<Product | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [weightInput, setWeightInput] = useState('')
  const [pieces, setPieces] = useState(1)

  useEffect(() => {
    if (!id) return
    getProduct(parseInt(id)).then(({ data }) => {
      setProduct(data ?? undefined)
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    if (!product) return
    const defaultW = defaultLineWeightKg(product)
    setWeightInput(String(defaultW))
    const piece = pieceWeightKg(product)
    if (isFixedWeightProduct(product) && piece) {
      setPieces(Math.max(1, Math.round(defaultW / piece)))
    }
  }, [product])

  if (loading) {
    return (
      <div className="product-detail-page px-3 px-sm-4 py-4 text-center">
        <LoadingCenter message="Cargando producto..." />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="product-detail-page px-3 px-sm-4 py-4 text-center">
        <p className="mb-3">Producto no encontrado.</p>
        <Link to="/" className="btn btn-lepra product-detail-back-btn">
          <ArrowLeft size={18} className="me-1" aria-hidden /> Volver al catálogo
        </Link>
      </div>
    )
  }

  const detailProduct = product
  const piece = pieceWeightKg(detailProduct)
  const fixed = isFixedWeightProduct(detailProduct)
  const inCart = items.find((i) => i.id_product === detailProduct.id)

  function handleAddToCart() {
    let weightKg: number
    if (fixed && piece) {
      weightKg = minKgFromPieces(pieces, piece)
    } else {
      const parsed = parseWeightInput(weightInput)
      if (!parsed.ok) {
        toast.error(parsed.message)
        return
      }
      if (parsed.value == null) {
        toast.error('Indicá el peso en kg')
        return
      }
      weightKg = parsed.value
    }
    const valid = validateLineWeightKg(detailProduct, weightKg)
    if (!valid.ok) {
      toast.error(valid.message)
      return
    }
    if (inCart) {
      updateWeight(detailProduct.id, weightKg)
    } else {
      addItem(detailProduct)
      updateWeight(detailProduct.id, weightKg)
    }
    toast.success(inCart ? 'Carrito actualizado' : 'Agregado al carrito')
  }

  const specs: { label: string; value: string }[] = []
  if (product.brand) specs.push({ label: 'Marca', value: product.brand })
  if (product.category) specs.push({ label: 'Categoría', value: product.category })
  if (hasWeight(product.weight)) specs.push({ label: 'Peso por pieza', value: formatWeight(product.weight) })
  if (fixed) specs.push({ label: 'Venta', value: 'Por pieza' })
  if (product.has_tiered_pricing) specs.push({ label: 'Precio', value: 'Por volumen' })

  const sortedTiers =
    product.has_tiered_pricing && product.price_tiers?.length
      ? [...product.price_tiers].sort((a, b) => a.min_kg - b.min_kg)
      : []

  return (
    <div className="product-detail-page px-3 px-sm-4 py-2 py-md-3">
      <div className="product-detail-page-inner mx-auto">
        <Link to="/" className="product-detail-back text-dark text-decoration-none">
          <ArrowLeft size={20} className="me-1" aria-hidden /> Volver al catálogo
        </Link>

        <article className="product-detail-panel card-lepra mt-2">
          <div className="product-detail-image-wrap">
            <ProductImage src={product.img} alt={product.name} variant="detail" className="w-100 h-100" />
          </div>

          <div className="product-detail-info">
            <div className="product-detail-summary">
              <h1 className="product-detail-title h4 mb-2">{product.name}</h1>

              {specs.length > 0 ? (
                <dl className="product-detail-specs mb-2">
                  {specs.map((row) => (
                    <div key={row.label} className="product-detail-spec-row">
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              <p className="product-detail-price fw-bold text-dark mb-0">
                {formatMoneyWithSymbol(detailProduct.price)}
                {fixed ? '' : '/kg'}
              </p>

              {sortedTiers.length > 0 ? (
                <div className="product-detail-tiers mt-2 pt-2 border-top">
                  <p className="small fw-bold mb-1">Precios por volumen</p>
                  <ul className="list-unstyled small mb-0 product-detail-tiers-list">
                    {sortedTiers.map((t) => (
                      <li key={t.id}>
                        Desde {tierLabel(t, piece, fixed)}: {formatMoneyWithSymbol(t.price_per_kg)}
                        {fixed ? '' : '/kg'}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="product-detail-actions">
              <div className="product-detail-quantity">
                <span className="product-detail-qty-label">
                  {fixed ? 'Piezas' : 'Peso (kg)'}
                </span>
                {fixed ? (
                  <QuantityStepper
                    value={pieces}
                    onChange={setPieces}
                    ariaLabel="Piezas del producto"
                  />
                ) : (
                  <DecimalInput
                    kind="weight"
                    allowEmpty
                    className="input-kg"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    aria-label="Peso en kg"
                  />
                )}
              </div>

              <div className="product-detail-buttons">
                <Button className="btn-lepra w-100" onClick={handleAddToCart}>
                  <ShoppingCart size={18} className="me-1" aria-hidden />
                  {inCart ? 'Actualizar carrito' : 'Agregar al carrito'}
                </Button>
                <Link to="/carrito" className="btn btn-outline-dark w-100">
                  Ver carrito
                </Link>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}
