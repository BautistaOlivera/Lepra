let lastTime = 0
let counter = 0

/**
 * Genera un id temporal negativo y monótono para entidades creadas offline.
 * Garantiza unicidad incluso si se crean varias entidades en el mismo milisegundo
 * (hasta 1000 por ms). Sigue siendo siempre negativo para distinguirlo de ids reales.
 */
export function nextTempId(): number {
  const now = Date.now()
  if (now === lastTime) {
    counter++
  } else {
    lastTime = now
    counter = 0
  }
  return -(now * 1000 + counter)
}
