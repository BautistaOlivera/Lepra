import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Container, Card, Spinner } from 'react-bootstrap'
import { ArrowLeft } from 'lucide-react'
import { getProduct } from '@/api/product'
import { Product } from '@/types'

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=600&q=80'

export function ProductoDetalle() {
  const { id } = useParams()
  const [product, setProduct] = useState<Product | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getProduct(parseInt(id)).then(({ data }) => {
      setProduct(data ?? undefined)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
      </Container>
    )
  }

  if (!product) {
    return (
      <Container className="py-5">
        <p>Producto no encontrado.</p>
        <Link to="/" className="btn btn-lepra">← Volver al catálogo</Link>
      </Container>
    )
  }

  return (
    <Container className="py-4">
      <Link to="/" className="text-dark text-decoration-none d-inline-flex align-items-center mb-3">
        <ArrowLeft size={20} className="me-1" /> Volver al catálogo
      </Link>
      <Card className="card-lepra overflow-hidden">
        <div className="row g-0">
          <div className="col-md-5">
            <div
              style={{
                height: 300,
                backgroundImage: `url(${product.img || DEFAULT_IMG})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          </div>
          <div className="col-md-7">
            <Card.Body className="p-4">
              <h2 className="mb-2">{product.name}</h2>
              {product.brand && <p className="text-muted mb-2">{product.brand}</p>}
              {product.category && <p className="small text-muted">{product.category}</p>}
              <p className="fs-3 fw-bold text-dark mt-3">${product.price.toFixed(2)}</p>
              {product.has_tiered_pricing && product.price_tiers?.length && (
                <div className="mt-3">
                  <p className="small fw-bold mb-2">Precios por volumen</p>
                  <ul className="list-unstyled small">
                    {product.price_tiers
                      .sort((a, b) => a.min_quantity - b.min_quantity)
                      .map((t) => (
                        <li key={t.id}>Desde {t.min_quantity} u: ${t.unit_price.toFixed(2)}/u</li>
                      ))}
                  </ul>
                </div>
              )}
            </Card.Body>
          </div>
        </div>
      </Card>
    </Container>
  )
}
