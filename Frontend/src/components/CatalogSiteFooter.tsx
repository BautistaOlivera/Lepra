import { Link } from 'react-router-dom'
import { Mail, MessageCircle, Phone } from 'lucide-react'
import { getContactConfig, telHref, whatsappHref } from '@/lib/contactConfig'

export function CatalogSiteFooter() {
  const { label, tagline, ownerName, email, phone, whatsapp, developerName, developerUrl } =
    getContactConfig()

  const contactLinks: { key: string; href: string; label: string; icon: typeof Mail }[] = []
  if (email) {
    contactLinks.push({ key: 'email', href: `mailto:${email}`, label: email, icon: Mail })
  }
  if (phone) {
    const href = telHref(phone)
    if (href) contactLinks.push({ key: 'phone', href, label: phone, icon: Phone })
  }
  if (whatsapp) {
    const href = whatsappHref(whatsapp)
    if (href) contactLinks.push({ key: 'wa', href, label: 'WhatsApp', icon: MessageCircle })
  }

  return (
    <footer className="catalog-site-footer border-top mt-auto">
      <div className="container-fluid container-sm px-3 px-sm-4 py-4 py-md-5">
        <div className="row g-4 g-md-5">
          <div className="col-12 col-md-6">
            <h2 className="catalog-footer-heading h6 text-uppercase text-muted mb-2">
              {label}
            </h2>
            {tagline ? <p className="catalog-footer-tagline mb-2">{tagline}</p> : null}
            <p className="catalog-footer-hint small text-muted mb-0">
              <span className="catalog-footer-hint-label">Pedidos:</span>{' '}
              <Link to="/login" className="catalog-footer-link">
                catálogo con cuenta
              </Link>
            </p>
          </div>
          <div className="col-12 col-md-6 text-md-end">
            <h2 className="catalog-footer-heading h6 text-uppercase text-muted mb-2">Dueño</h2>
            <p className="catalog-footer-owner-name fw-semibold mb-1">{ownerName}</p>
            <p className="catalog-footer-hint small text-muted mb-2">
              <span className="catalog-footer-hint-label">Consultas:</span> información personal
            </p>
            {contactLinks.length > 0 ? (
              <ul className="list-unstyled catalog-footer-contact mb-0">
                {contactLinks.map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.key} className="mb-2">
                      <a
                        href={item.href}
                        className="catalog-footer-link d-inline-flex align-items-center gap-2 justify-content-md-end"
                        target={item.key === 'email' ? undefined : '_blank'}
                        rel={item.key === 'email' ? undefined : 'noopener noreferrer'}
                      >
                        <Icon size={16} aria-hidden />
                        {item.label}
                      </a>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        </div>
        <div className="catalog-footer-bottom small text-muted text-center pt-4 mt-2 border-top">
          © {new Date().getFullYear()} {label}
          {' · '}
          Desarrollo{' '}
          <a
            href={developerUrl}
            className="catalog-footer-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            {developerName}
          </a>
        </div>
      </div>
    </footer>
  )
}
