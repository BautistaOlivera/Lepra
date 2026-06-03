export type ContactConfig = {
  label: string
  tagline?: string
  ownerName: string
  email?: string
  phone?: string
  whatsapp?: string
  developerName: string
  developerUrl: string
}

function trimEnv(value: unknown): string | undefined {
  const s = typeof value === 'string' ? value.trim() : ''
  return s || undefined
}

/** Teléfono para enlace wa.me (solo dígitos, con código de país). */
export function whatsappHref(digits: string): string {
  const n = digits.replace(/\D/g, '')
  return n ? `https://wa.me/${n}` : ''
}

export function telHref(phone: string): string {
  const n = phone.replace(/[^\d+]/g, '')
  return n ? `tel:${n}` : ''
}

export function getContactConfig(): ContactConfig {
  const email = trimEnv(import.meta.env.VITE_CONTACT_EMAIL)
  const phone = trimEnv(import.meta.env.VITE_CONTACT_PHONE)
  const whatsapp = trimEnv(import.meta.env.VITE_CONTACT_WHATSAPP)
  const label = trimEnv(import.meta.env.VITE_CONTACT_LABEL) ?? 'El Lepra'
  const tagline =
    trimEnv(import.meta.env.VITE_CONTACT_TAGLINE) ?? 'Quesos y lácteos de calidad'
  const ownerName = trimEnv(import.meta.env.VITE_OWNER_NAME) ?? 'Maxi Laraburru'
  const developerName = trimEnv(import.meta.env.VITE_DEVELOPER_NAME) ?? 'Olivera.co'
  const developerUrl = trimEnv(import.meta.env.VITE_DEVELOPER_URL) ?? 'https://olivera.co'
  return {
    label,
    tagline,
    ownerName,
    email,
    phone,
    whatsapp,
    developerName,
    developerUrl,
  }
}
