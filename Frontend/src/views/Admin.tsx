import { useState, useEffect } from 'react'
import { Row, Col, Card, Badge, Spinner } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { Package, ShoppingCart, TrendingUp } from 'lucide-react'
import { getProductsPaginated } from '@/api/product'
import { getOrdersPaginated } from '@/api/order'

const CHEESE_CARD = 'https://images.unsplash.com/photo-1452195100486-9cc805987862?w=600&q=80'

export function Admin() {
  const [stats, setStats] = useState({ products: 0, pendingOrders: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [prodRes, ordRes] = await Promise.all([
        getProductsPaginated({ limit: 100, filters: {} }),
        getOrdersPaginated({ limit: 100, filters: { status: 'PENDING' } }),
      ])
      if (prodRes.data) setStats((s) => ({ ...s, products: prodRes.data!.items.length }))
      if (ordRes.data) setStats((s) => ({ ...s, pendingOrders: ordRes.data!.items.length }))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    )
  }

  return (
    <>
      <div className="mb-4">
        <h2 className="text-dark">Dashboard</h2>
        <p className="text-muted">Resumen de tu negocio</p>
      </div>

      <div
        className="rounded-3 mb-4 p-4 text-white"
        style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}
      >
        <Row>
          <Col md={6} className="d-flex align-items-center">
            <div>
              <h4 className="mb-1">Bienvenido a Lepra</h4>
              <p className="mb-0 text-white-50">Panel de administración</p>
            </div>
          </Col>
          <Col md={6}>
            <div
              className="rounded-3 mt-3 mt-md-0"
              style={{ height: 120, backgroundImage: `url(${CHEESE_CARD})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
          </Col>
        </Row>
      </div>

      <Row className="g-4">
        <Col md={4}>
          <Card className="card-lepra h-100 border-0 shadow-sm">
            <Card.Body className="d-flex align-items-center">
              <div className="rounded-3 bg-warning bg-opacity-25 p-3 me-3">
                <Package size={32} className="text-dark" />
              </div>
              <div>
                <Card.Text className="text-muted mb-0 small">Productos</Card.Text>
                <Card.Title className="mb-0">{stats.products}</Card.Title>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="card-lepra h-100 border-0 shadow-sm">
            <Card.Body className="d-flex align-items-center">
              <div className="rounded-3 bg-warning bg-opacity-25 p-3 me-3">
                <ShoppingCart size={32} className="text-dark" />
              </div>
              <div>
                <Card.Text className="text-muted mb-0 small">Pedidos pendientes</Card.Text>
                <Card.Title className="mb-0">
                  {stats.pendingOrders}
                  {stats.pendingOrders > 0 && (
                    <Badge bg="warning" className="ms-2">¡Revisar!</Badge>
                  )}
                </Card.Title>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="card-lepra h-100 border-0 shadow-sm">
            <Card.Body className="d-flex align-items-center">
              <div className="rounded-3 bg-warning bg-opacity-25 p-3 me-3">
                <TrendingUp size={32} className="text-dark" />
              </div>
              <div>
                <Card.Text className="text-muted mb-0 small">Acciones rápidas</Card.Text>
                <Card.Title className="mb-0 small fw-normal">
                  <Link to="/admin/pedidos" className="text-dark text-decoration-none">Ir a Pedidos →</Link>
                </Card.Title>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  )
}
