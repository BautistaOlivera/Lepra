import { useState, useEffect } from 'react'
import { Container, Row, Col, Card, Form, Spinner } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { getProductsPaginated } from '@/api/product'
import { Product } from '@/types'
import { useCart } from '@/context/CartContext'
import { getImageUrl } from '@/api/product'

const CHEESE_HERO = 'https://images.unsplash.com/photo-1452195100486-9cc805987862?w=1200&q=80'

export function Catalogo() {
  const { addItem } = useCart()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [nextCursor, setNextCursor] = useState<number | null>(null)

  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts(lastId?: number) {
    setLoading(true)
    const { data } = await getProductsPaginated({
      limit: 20,
      last_seen_id: lastId ?? null,
      filters: { search: search || undefined },
    })
    if (data) {
      setProducts((prev) => (lastId ? [...prev, ...data.items] : data.items))
      setNextCursor(data.next_cursor)
    }
    setLoading(false)
  }

  const handleSearch = () => loadProducts()

  return (
    <>
      <div className="bg-lepra-hero py-5 mb-4 rounded-bottom-3" style={{ backgroundImage: `url(${CHEESE_HERO})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="bg-dark bg-opacity-50 py-5 rounded-bottom-3">
          <Container>
            <h1 className="text-white display-5 fw-bold mb-2">Catálogo Lepra</h1>
            <p className="text-white-50 mb-4">Quesos y lácteos de calidad</p>
            <Form className="d-flex gap-2" onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
              <Form.Control
                placeholder="Buscar productos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0"
              />
              <button type="submit" className="btn btn-lepra">Buscar</button>
            </Form>
          </Container>
        </div>
      </div>

      <Container>
        {loading && products.length === 0 ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
          </div>
        ) : (
          <Row xs={1} sm={2} md={3} lg={4} className="g-4">
            {products.map((p) => (
              <Col key={p.id}>
                <Card className="card-lepra h-100 overflow-hidden">
                  <div
                    className="bg-dark"
                    style={{ height: 160, backgroundImage: p.img ? `url(${getImageUrl(p.img)})` : `url(https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&q=80)`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                  />
                  <Card.Body>
                    <Card.Title className="text-truncate">{p.name}</Card.Title>
                    {p.brand && <Card.Text className="small text-muted">{p.brand}</Card.Text>}
                    <div className="d-flex justify-content-between align-items-center gap-2 mt-2 flex-wrap">
                      <span className="fw-bold text-dark">${p.price.toFixed(2)}</span>
                      <div className="d-flex gap-1">
                        <Link to={`/producto/${p.id}`} className="btn btn-sm btn-outline-dark">
                          Ver
                        </Link>
                        <button
                          type="button"
                          className="btn btn-sm btn-lepra"
                          onClick={() => addItem(p)}
                        >
                          <Plus size={14} className="me-1" /> Agregar
                        </button>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        )}
        {nextCursor && (
          <div className="text-center mt-4">
            <button className="btn btn-outline-dark" onClick={() => loadProducts(nextCursor)} disabled={loading}>
              {loading ? 'Cargando...' : 'Cargar más'}
            </button>
          </div>
        )}
      </Container>
    </>
  )
}
