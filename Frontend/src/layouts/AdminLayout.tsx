import { Outlet, Link, useNavigate } from 'react-router-dom'
import { Container, Navbar, Nav, Button } from 'react-bootstrap'
import { LayoutDashboard, Users, Package, ShoppingCart, LogOut } from 'lucide-react'

export function AdminLayout() {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('lepra_token')
    localStorage.removeItem('lepra_user')
    navigate('/')
  }

  return (
    <>
      <Navbar expand="lg" className="navbar-lepra">
        <Container>
          <Navbar.Brand as={Link} to="/admin">Lepra</Navbar.Brand>
          <Navbar.Toggle aria-controls="admin-nav" />
          <Navbar.Collapse id="admin-nav">
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/admin">
                <LayoutDashboard size={18} className="me-1" /> Dashboard
              </Nav.Link>
              <Nav.Link as={Link} to="/admin/clientes">
                <Users size={18} className="me-1" /> Clientes
              </Nav.Link>
              <Nav.Link as={Link} to="/admin/productos">
                <Package size={18} className="me-1" /> Productos
              </Nav.Link>
              <Nav.Link as={Link} to="/admin/pedidos">
                <ShoppingCart size={18} className="me-1" /> Pedidos
              </Nav.Link>
            </Nav>
            <Button variant="outline-light" size="sm" onClick={handleLogout}>
              <LogOut size={16} className="me-1" /> Salir
            </Button>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Container className="py-4">
        <Outlet />
      </Container>
    </>
  )
}
