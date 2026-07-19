import { useState } from 'react'
import { Container, Card, Form, Button } from 'react-bootstrap'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import { useNavigate, useLocation } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { login } from '@/api/auth'
import toast from 'react-hot-toast'
import { markOnlineAuth } from '@/offline/authGrace'
import { retryFailed } from '@/offline/outbox'

const CHEESE_BG = 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=800&q=80'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await login(email, password)
    setLoading(false)
    if (error) {
      toast.error(error.message || 'Error al iniciar sesión')
      return
    }
    if (data) {
      localStorage.setItem('lepra_token', data.access_token)
      localStorage.setItem('lepra_user', JSON.stringify(data.user))
      markOnlineAuth()
      if (data.user.rol === 'ADMIN') {
        // Destraba ítems de la cola que hayan quedado 'failed' (p. ej. por
        // sesión expirada) para que el sync del AdminLayout los reenvíe.
        try {
          await retryFailed()
        } catch {
          // Dexie no disponible — ignorar
        }
      }
      toast.success('¡Bienvenido!')
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
      const isAdmin = data.user.rol === 'ADMIN'
      const target = isAdmin
        ? '/admin'
        : from && from !== '/login'
          ? from
          : '/'
      navigate(target, { replace: true })
    }
  }

  return (
    <Container className="py-5">
      <div className="d-flex justify-content-center">
        <Card className="card-lepra shadow-sm" style={{ maxWidth: 400, width: '100%' }}>
          <div
            className="rounded-top"
            style={{ height: 140, backgroundImage: `url(${CHEESE_BG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
          <Card.Body className="p-4 position-relative">
            {loading ? <LoadingOverlay message="Ingresando..." variant="page" /> : null}
            <h3 className="mb-3 text-dark">Iniciar sesión</h3>
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="tu@email.com"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Contraseña</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Form.Group>
              <Button type="submit" className="btn-lepra w-100" disabled={loading}>
                Entrar
              </Button>
            </Form>
            <p className="mt-3 mb-0 small text-muted text-center">
              <Link to="/" className="text-dark">← Volver al catálogo</Link>
            </p>
          </Card.Body>
        </Card>
      </div>
    </Container>
  )
}
