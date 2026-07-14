import { useState, type ReactNode } from 'react'
import { NavLink, useMatch } from 'react-router-dom'
import { Container, Navbar } from 'react-bootstrap'
import { LayoutDashboard, Users, Package, ShoppingCart, BarChart3 } from 'lucide-react'

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

const ADMIN_QUICK_LINKS = [
  { to: '/admin', end: true, icon: LayoutDashboard, label: 'Admin' },
  { to: '/admin/clientes', end: false, icon: Users, label: 'Clientes' },
  { to: '/admin/productos', end: false, icon: Package, label: 'Productos' },
  { to: '/admin/pedidos', end: false, icon: ShoppingCart, label: 'Pedidos' },
  { to: '/admin/estadisticas', end: false, icon: BarChart3, label: 'Estadísticas' },
] as const

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
          className={`navbar-brand fw-bold lepra-navbar-brand lepra-navbar-brand-slot d-inline-flex${
            isCatalogHome ? ' active' : ''
          }`}
          onPointerUp={(e) => {
            const el = e.currentTarget
            window.setTimeout(() => {
              el?.blur()
            }, 0)
          }}
          aria-label="El Lepra"
        >
          <img
            src="/branding/lepra-logo-icon.png"
            alt=""
            className="lepra-navbar-logo"
            width={36}
            height={36}
            decoding="async"
          />
          <span className="lepra-navbar-brand-text d-none d-lg-inline">El Lepra</span>
        </NavLink>

        {showAdminLink ? (
          <nav
            className="lepra-navbar-mobile-quick d-lg-none"
            aria-label="Acceso rápido admin"
          >
            {ADMIN_QUICK_LINKS.map(({ to, end, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `lepra-navbar-mobile-quick-link${isActive ? ' active' : ''}`
                }
                title={label}
                aria-label={label}
              >
                <Icon size={22} aria-hidden />
              </NavLink>
            ))}
          </nav>
        ) : null}
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
              <AdminNavItem to="/admin/estadisticas" onNavigate={closeNav}>
                <BarChart3 size={18} className="me-1" aria-hidden /> Estadísticas
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
