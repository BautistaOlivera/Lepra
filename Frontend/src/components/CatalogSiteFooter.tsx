import { Link } from 'react-router-dom'
import { Mail, MessageCircle, Phone } from 'lucide-react'
import { getContactConfig, telHref, whatsappHref } from '@/lib/contactConfig'

export function CatalogSiteFooter() {
  const { label, tagline, ownerName, email, phone, whatsapp, developerName, developerUrl } =
    getContactConfig()

  const phoneHref = phone ? telHref(phone) : ''
  const waHref = whatsapp ? whatsappHref(whatsapp) : ''
  const phoneLabel = (phone || '').trim()
  const hasConsultas = Boolean(phoneHref || waHref || email)

  return (
    <footer className="catalog-site-footer border-top mt-auto">
      <div className="container-fluid container-sm px-3 px-sm-4 py-4 py-md-5">
        <div className="row g-4 g-lg-5 catalog-footer-grid">
          <div className="col-12 col-md-4 catalog-footer-col">
            <h2 className="catalog-footer-heading h6 text-uppercase text-muted mb-3">
              {label}
            </h2>
            {tagline ? <p className="catalog-footer-tagline mb-3">{tagline}</p> : null}
            <p className="catalog-footer-hint small text-muted mb-0">
              <span className="catalog-footer-hint-label">Pedidos:</span>{' '}
              <Link to="/login" className="catalog-footer-link">
                catálogo con cuenta
              </Link>
            </p>
          </div>

          <div className="col-12 col-md-4 catalog-footer-col catalog-footer-col--owner">
            <h2 className="catalog-footer-heading h6 text-uppercase text-muted mb-3">Dueño</h2>
            <p className="catalog-footer-owner-name fw-semibold mb-0">{ownerName}</p>
          </div>

          <div className="col-12 col-md-4 catalog-footer-col catalog-footer-col--consultas">
            <h2 className="catalog-footer-heading h6 text-uppercase text-muted mb-3">Consultas</h2>
            {hasConsultas ? (
              <ul className="list-unstyled catalog-footer-contact mb-0">
                {phoneHref && phoneLabel ? (
                  <li className="mb-2">
                    <a
                      href={phoneHref}
                      className="catalog-footer-link d-inline-flex align-items-center gap-2"
                    >
                      <Phone size={16} aria-hidden />
                      <span>{phoneLabel}</span>
                    </a>
                  </li>
                ) : null}
                {waHref ? (
                  <li className="mb-2">
                    <a
                      href={waHref}
                      className="catalog-footer-link d-inline-flex align-items-center gap-2"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle size={16} aria-hidden />
                      <span>WhatsApp</span>
                    </a>
                  </li>
                ) : null}
                {email ? (
                  <li className="mb-2">
                    <a
                      href={`mailto:${email}`}
                      className="catalog-footer-link d-inline-flex align-items-center gap-2"
                    >
                      <Mail size={16} aria-hidden />
                      <span>{email}</span>
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="small text-muted mb-0">Sin datos de contacto</p>
            )}
          </div>
        </div>

        <div className="catalog-footer-bottom small text-muted text-center pt-4 mt-4 border-top">
          © {new Date().getFullYear()} {label}
          {' · '}
          Desarrollado por{' '}
          {developerUrl ? (
            <a
              href={developerUrl}
              className="catalog-footer-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              {developerName}
            </a>
          ) : (
            <span className="catalog-footer-developer">{developerName}</span>
          )}
        </div>
      </div>
    </footer>
  )
}
