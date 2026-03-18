import { useState } from 'react'
import { Container, Card, Form, Button } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { login } from '@/api/auth'
import toast from 'react-hot-toast'
import { markOnlineAuth } from '@/offline/authGrace'

const CHEESE_BG = 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=800&q=80'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

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
      toast.success('¡Bienvenido!')
      navigate(data.user.rol === 'ADMIN' ? '/admin' : '/', { replace: true })
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
          <Card.Body className="p-4">
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
                {loading ? 'Ingresando...' : 'Entrar'}
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
