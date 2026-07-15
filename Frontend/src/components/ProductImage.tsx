import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getImageUrl } from '@/api/product'
import { productPlaceholderImg } from '@/lib/brandingAssets'

type ProductImageVariant = 'card' | 'detail' | 'thumb'

type ProductImageProps = {
  src?: string | null
  alt: string
  /** Categoría del producto: define el placeholder (lácteos / embutidos). */
  category?: string | null
  variant?: ProductImageVariant
  className?: string
  linkTo?: string
}

export function ProductImage({
  src,
  alt,
  category,
  variant = 'card',
  className = '',
  linkTo,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false)
  const placeholder = productPlaceholderImg(category)
  const primary = getImageUrl(src) || placeholder
  const url = failed ? placeholder : primary

  const frame = (
    <div
      className={`product-image-frame product-image-frame--${variant} ${className}`.trim()}
    >
      <img
        src={url}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  )

  if (linkTo) {
    return (
      <Link to={linkTo} className="product-image-link d-block text-decoration-none">
        {frame}
      </Link>
    )
  }

  return frame
}
