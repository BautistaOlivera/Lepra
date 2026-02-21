import { Outlet, Link, useNavigate } from 'react-router-dom'
import { Container, Navbar, Nav, Button } from 'react-bootstrap'
import { LogIn, LogOut, ShoppingCart, LayoutDashboard } from 'lucide-react'
import { useCart } from '@/context/CartContext'

function getStoredUser() {
  try {
    const s = localStorage.getItem('lepra_user')
    return s ? JSON.parse(s) : null
  } catch {
    return null
  }
}

export function CatalogLayout() {
  const navigate = useNavigate()
  const { itemCount } = useCart()
  const token = localStorage.getItem('lepra_token')
  const user = token ? getStoredUser() : null

  const handleLogout = () => {
    localStorage.removeItem('lepra_token')
    localStorage.removeItem('lepra_user')
    navigate('/')
  }

  return (
    <>
      <Navbar expand="lg" className="navbar-lepra">
        <Container>
          <Navbar.Brand as={Link} to="/">Lepra</Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav">
            <Nav className="ms-auto align-items-center gap-2">
              {(user || itemCount > 0) && (
                <Nav.Link as={Link} to="/carrito" className="d-flex align-items-center">
                  <ShoppingCart size={20} className="me-1" />
                  Carrito {itemCount > 0 && <span className="badge bg-warning text-dark ms-1">{itemCount}</span>}
                </Nav.Link>
              )}
              {user ? (
                <>
                  <span className="text-white-50 small d-none d-md-inline">
                    Bienvenido, {user.name || user.email}
                  </span>
                  {user?.rol === 'ADMIN' && (
                    <Nav.Link as={Link} to="/admin">
                      <LayoutDashboard size={18} className="me-1" /> Admin
                    </Nav.Link>
                  )}
                  <Button variant="outline-light" size="sm" onClick={handleLogout}>
                    <LogOut size={16} className="me-1" /> Cerrar sesión
                  </Button>
                </>
              ) : (
                <Nav.Link as={Link} to="/login">
                  <LogIn size={18} className="me-1" /> Iniciar sesión
                </Nav.Link>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Outlet />
    </>
  )
}
