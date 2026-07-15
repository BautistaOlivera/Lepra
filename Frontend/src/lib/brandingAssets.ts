/** Imágenes de marca usadas en UI (catálogo / admin). */
export const LEPRA_ADMIN_HERO_IMG =
  'https://images.unsplash.com/photo-1452195100486-9cc805987862?w=1200&q=80'

/** Placeholder para productos sin imagen (lácteos / default), servido local. */
export const PLACEHOLDER_LACTEOS_IMG = '/branding/quesos-placeholder.jpg'

/** Placeholder para productos sin imagen (embutidos), servido local. */
export const PLACEHOLDER_EMBUTIDOS_IMG = '/branding/embutidos-placeholder.jpg'

/** Placeholder según categoría del producto. */
export function productPlaceholderImg(category?: string | null): string {
  const key = (category ?? '').trim().toLowerCase()
  if (key.startsWith('embutido')) return PLACEHOLDER_EMBUTIDOS_IMG
  return PLACEHOLDER_LACTEOS_IMG
}
