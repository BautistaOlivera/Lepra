import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Container, Navbar, Nav } from 'react-bootstrap'
import { LayoutDashboard } from 'lucide-react'

type LepraNavbarProps = {
  collapseId: string
  showAdminLink?: boolean
  toolbarActions?: ReactNode
  endNav: (closeNav: () => void) => ReactNode
}

export function LepraNavbar({
  collapseId,
  showAdminLink = false,
  toolbarActions,
  endNav,
}: LepraNavbarProps) {
  const [expanded, setExpanded] = useState(false)
  const closeNav = () => setExpanded(false)

  return (
    <Navbar
      expand="lg"
      expanded={expanded}
      onToggle={setExpanded}
      className="navbar-lepra sticky-top"
    >
      <Container fluid="sm" className="px-3 px-sm-4 lepra-navbar-container">
        <Navbar.Brand
          as={Link}
          to="/"
          className="fw-bold lepra-navbar-brand lepra-navbar-brand-slot"
          onPointerUp={(e) => window.setTimeout(() => e.currentTarget.blur(), 0)}
        >
          El Lepra
        </Navbar.Brand>

        <div className="lepra-navbar-actions d-flex align-items-center gap-1">
          {toolbarActions}
          <Navbar.Toggle
            aria-controls={collapseId}
            aria-label="Abrir menú"
            className="lepra-navbar-toggler d-lg-none"
          />
        </div>

        <Navbar.Collapse id={collapseId} className="lepra-navbar-collapse flex-lg-grow-1">
          {showAdminLink && (
            <div className="navbar-nav lepra-navbar-primary me-auto">
              <Nav.Link as={Link} to="/admin" onClick={closeNav}>
                <LayoutDashboard size={18} className="me-1" /> Admin
              </Nav.Link>
            </div>
          )}
          <div className="navbar-nav lepra-navbar-nav ms-lg-auto align-items-lg-center gap-lg-2">
            {endNav(closeNav)}
          </div>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  )
}
