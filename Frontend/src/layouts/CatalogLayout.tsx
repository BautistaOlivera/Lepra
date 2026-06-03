import { Outlet, Link, useNavigate } from 'react-router-dom'
import { Nav, Button } from 'react-bootstrap'
import { LogIn, LogOut, ShoppingCart } from 'lucide-react'
import { useCart } from '@/context/CartContext'
import { LepraNavbar } from '@/components/LepraNavbar'
import { CatalogSiteFooter } from '@/components/CatalogSiteFooter'

function getStoredUser() {
  try {
    const s = localStorage.getItem('lepra_user')
    return s ? JSON.parse(s) : null
  } catch {
    return null
  }
}

function CartLink() {
  const { itemCount } = useCart()
  return (
    <Nav.Link
      as={Link}
      to="/carrito"
      className="lepra-nav-cart d-flex align-items-center py-2"
      aria-label={itemCount > 0 ? `Carrito, ${itemCount} productos` : 'Carrito'}
    >
      <ShoppingCart size={22} aria-hidden />
      <span className="d-none d-sm-inline ms-1">Carrito</span>
      {itemCount > 0 && (
        <span className="badge bg-warning ms-1">{itemCount}</span>
      )}
    </Nav.Link>
  )
}

export function CatalogLayout() {
  const navigate = useNavigate()
  const token = localStorage.getItem('lepra_token')
  const user = token ? getStoredUser() : null
  const isAdmin = user?.rol === 'ADMIN'

  const handleLogout = () => {
    localStorage.removeItem('lepra_token')
    localStorage.removeItem('lepra_user')
    navigate('/')
  }

  return (
    <div className="catalog-layout d-flex flex-column min-vh-100">
      <LepraNavbar
        collapseId="main-nav"
        showAdminLink={isAdmin}
        toolbarActions={
          <>
            <div className="navbar-nav">
              <CartLink />
            </div>
            {user ? (
              <Button
                variant="outline-light"
                size="sm"
                className="lepra-nav-logout d-none d-lg-inline-flex"
                onClick={handleLogout}
              >
                <LogOut size={16} className="me-1" /> Cerrar sesión
              </Button>
            ) : null}
          </>
        }
        endNav={(closeNav) =>
          user ? (
            <>
              <span
                className={`text-white-50 small lepra-nav-welcome d-none d-lg-inline${isAdmin ? ' lepra-nav-welcome-admin' : ''}`}
              >
                Bienvenido, {user.name || user.email}
              </span>
              <span
                className={`text-white-50 small lepra-nav-welcome d-lg-none${isAdmin ? ' lepra-nav-welcome-admin' : ''}`}
              >
                {user.name || user.email}
              </span>
              <Nav.Link
                as="button"
                type="button"
                className="d-lg-none lepra-nav-logout-link"
                onClick={() => {
                  handleLogout()
                  closeNav()
                }}
              >
                <LogOut size={18} className="me-1" /> Cerrar sesión
              </Nav.Link>
            </>
          ) : (
            <Nav.Link
              as={Link}
              to="/login"
              onClick={closeNav}
              state={{ from: { pathname: '/carrito' } }}
            >
              <LogIn size={18} className="me-1" /> Iniciar sesión
            </Nav.Link>
          )
        }
      />
      <div className="catalog-layout-body flex-grow-1">
        <Outlet />
      </div>
      <CatalogSiteFooter />
    </div>
  )
}
