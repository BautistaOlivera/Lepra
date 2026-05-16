import { useState, useEffect, useCallback } from 'react'
import { Row, Col, Card, Badge, Spinner, Alert } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { Package, ShoppingCart, Users, TrendingUp } from 'lucide-react'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { getDashboardStatsHybrid } from '@/repositories/dashboardRepo'
import { useOnlineStatus } from '@/offline/network'
import type { DashboardStats } from '@/types/dashboard'

const CHEESE_CARD = 'https://images.unsplash.com/photo-1452195100486-9cc805987862?w=600&q=80'

export function Admin() {
  const online = useOnlineStatus()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await getDashboardStatsHybrid()
    if (res.data) {
      setStats(res.data)
    } else {
      setError(res.error?.message ?? 'No se pudieron cargar las estadísticas')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load, online])

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    )
  }

  if (error || !stats) {
    return <Alert variant="danger">{error ?? 'Error desconocido'}</Alert>
  }

  const { counts } = stats

  return (
    <>
      <div className="mb-4">
        <h2 className="text-dark">Dashboard</h2>
        <p className="text-muted mb-0">Resumen de tu negocio</p>
      </div>

      <div
        className="rounded-3 mb-4 p-4 text-white"
        style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}
      >
        <Row>
          <Col md={6} className="d-flex align-items-center">
            <div>
              <h4 className="mb-1">Bienvenido a El Lepra</h4>
              <p className="mb-0 text-white-50">Panel de administración</p>
            </div>
          </Col>
          <Col md={6}>
            <div
              className="rounded-3 mt-3 mt-md-0"
              style={{
                height: 120,
                backgroundImage: `url(${CHEESE_CARD})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          </Col>
        </Row>
      </div>

      <Row className="g-4 mb-4">
        <Col md={4}>
          <Card className="card-lepra h-100 border-0 shadow-sm">
            <Card.Body className="d-flex align-items-center">
              <div className="rounded-3 bg-warning bg-opacity-25 p-3 me-3">
                <Package size={32} className="text-dark" />
              </div>
              <div>
                <Card.Text className="text-muted mb-0 small">Productos activos</Card.Text>
                <Card.Title className="mb-0">{counts.products_active}</Card.Title>
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
                  {counts.orders_pending}
                  {counts.orders_pending > 0 && (
                    <Badge bg="warning" className="ms-2">
                      ¡Revisar!
                    </Badge>
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
                <Users size={32} className="text-dark" />
              </div>
              <div>
                <Card.Text className="text-muted mb-0 small">Clientes activos</Card.Text>
                <Card.Title className="mb-0">{counts.users_active}</Card.Title>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-4 mb-4">
        <Col xs={12}>
          <Card className="card-lepra border-0 shadow-sm">
            <Card.Body className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div className="d-flex align-items-center">
                <div className="rounded-3 bg-warning bg-opacity-25 p-2 me-3">
                  <TrendingUp size={24} className="text-dark" />
                </div>
                <div>
                  <Card.Text className="text-muted mb-0 small">Acciones rápidas</Card.Text>
                  <Link to="/admin/pedidos" className="text-dark text-decoration-none fw-semibold">
                    Ir a Pedidos →
                  </Link>
                </div>
              </div>
              {!online && stats.source === 'local' && (
                <span className="text-muted small">Sin conexión — mostrando datos sincronizados</span>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <DashboardCharts stats={stats} />
    </>
  )
}
