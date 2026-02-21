import { Outlet } from 'react-router-dom'
import { Container, Navbar, Nav } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { LogIn } from 'lucide-react'

export function CatalogLayout() {
  return (
    <>
      <Navbar expand="lg" className="navbar-lepra">
        <Container>
          <Navbar.Brand as={Link} to="/">Lepra</Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav">
            <Nav className="ms-auto">
              <Nav.Link as={Link} to="/login">
                <LogIn size={18} className="me-1" /> Iniciar sesión
              </Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Outlet />
    </>
  )
}
