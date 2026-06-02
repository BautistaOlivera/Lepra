import { useState, type ReactNode } from 'react'
import { NavLink, useMatch } from 'react-router-dom'
import { Container, Navbar } from 'react-bootstrap'
import { LayoutDashboard, Users, Package, ShoppingCart } from 'lucide-react'

function AdminNavItem({
  to,
  end,
  onNavigate,
  children,
}: {
  to: string
  end?: boolean
  onNavigate: () => void
  children: ReactNode
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
    >
      {children}
    </NavLink>
  )
}

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
  const isCatalogHome = !!useMatch({ path: '/', end: true })

  return (
    <Navbar
      expand="lg"
      expanded={expanded}
      onToggle={setExpanded}
      className="navbar-lepra sticky-top"
    >
      <Container fluid="sm" className="px-3 px-sm-4 lepra-navbar-container">
        <NavLink
          to="/"
          end
          className={`navbar-brand fw-bold lepra-navbar-brand lepra-navbar-brand-slot${isCatalogHome ? ' active' : ''}`}
          onPointerUp={(e) => window.setTimeout(() => e.currentTarget.blur(), 0)}
        >
          El Lepra
        </NavLink>

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
            <div className="navbar-nav lepra-navbar-primary me-auto flex-wrap">
              <AdminNavItem to="/admin" end onNavigate={closeNav}>
                <LayoutDashboard size={18} className="me-1" aria-hidden /> Admin
              </AdminNavItem>
              <AdminNavItem to="/admin/clientes" onNavigate={closeNav}>
                <Users size={18} className="me-1" aria-hidden /> Clientes
              </AdminNavItem>
              <AdminNavItem to="/admin/productos" onNavigate={closeNav}>
                <Package size={18} className="me-1" aria-hidden /> Productos
              </AdminNavItem>
              <AdminNavItem to="/admin/pedidos" onNavigate={closeNav}>
                <ShoppingCart size={18} className="me-1" aria-hidden /> Pedidos
              </AdminNavItem>
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
