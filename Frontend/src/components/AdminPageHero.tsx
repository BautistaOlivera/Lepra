import type { ReactNode } from 'react'
import { LEPRA_ADMIN_HERO_IMG } from '@/lib/brandingAssets'

type AdminPageHeroProps = {
  children: ReactNode
  className?: string
  /** Texto auxiliar debajo del título (opcional). */
  subtitle?: ReactNode
  end?: ReactNode
}

/** Título de página admin con foto de fondo y overlay oscuro (solo altura del título). */
export function AdminPageHero({ children, className = '', subtitle, end }: AdminPageHeroProps) {
  return (
    <div
      className={`admin-page-hero mb-3 ${className}`.trim()}
      style={{ backgroundImage: `url(${LEPRA_ADMIN_HERO_IMG})` }}
    >
      <div className="admin-page-hero-overlay">
        <div className="admin-page-hero-row">
          <div className="admin-page-hero-copy min-w-0">
            <h1 className="admin-list-title admin-page-hero-title h3 mb-0">{children}</h1>
            {subtitle ? <div className="admin-page-hero-subtitle">{subtitle}</div> : null}
          </div>
          {end ? <div className="admin-page-hero-end flex-shrink-0">{end}</div> : null}
        </div>
      </div>
    </div>
  )
}
