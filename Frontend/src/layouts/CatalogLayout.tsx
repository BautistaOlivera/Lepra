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
      <Navbar expand="lg" className="navbar-lepra sticky-top">
        <Container fluid="sm" className="px-3 px-sm-4 catalog-navbar-container">
          <Navbar.Brand as={Link} to="/" className="fw-bold">El Lepra</Navbar.Brand>

          <Navbar.Collapse id="main-nav" className="catalog-navbar-collapse order-3 order-lg-2 flex-lg-grow-1">
            <Nav className="ms-lg-auto align-items-lg-center gap-lg-2">
              {user ? (
                <>
                  <span className="text-white-50 small catalog-nav-welcome d-none d-lg-inline">
                    Bienvenido, {user.name || user.email}
                  </span>
                  <span className="text-white-50 small catalog-nav-welcome d-lg-none">
                    {user.name || user.email}
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

          <div className="catalog-navbar-actions order-2 order-lg-3 d-flex align-items-center gap-1 ms-auto">
            <Nav.Link
              as={Link}
              to="/carrito"
              className="catalog-nav-cart d-flex align-items-center py-2"
              aria-label={itemCount > 0 ? `Carrito, ${itemCount} productos` : 'Carrito'}
            >
              <ShoppingCart size={22} aria-hidden />
              <span className="d-none d-sm-inline ms-1">Carrito</span>
              {itemCount > 0 && (
                <span className="badge bg-warning text-dark ms-1">{itemCount}</span>
              )}
            </Nav.Link>
            <Navbar.Toggle
              aria-controls="main-nav"
              aria-label="Abrir menú"
              className="catalog-navbar-toggler d-lg-none"
            />
          </div>
        </Container>
      </Navbar>
      <Outlet />
    </>
  )
}
