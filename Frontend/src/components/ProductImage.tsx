import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getImageUrl } from '@/api/product'

const DEFAULT_IMG =
  'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=800&q=80'

type ProductImageVariant = 'card' | 'detail' | 'thumb'

type ProductImageProps = {
  src?: string | null
  alt: string
  variant?: ProductImageVariant
  className?: string
  linkTo?: string
}

export function ProductImage({
  src,
  alt,
  variant = 'card',
  className = '',
  linkTo,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false)
  const primary = getImageUrl(src) || DEFAULT_IMG
  const url = failed ? DEFAULT_IMG : primary

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
