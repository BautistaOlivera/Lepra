import { forwardRef, useMemo } from 'react'
import { Form, type FormControlProps } from 'react-bootstrap'
import { isLegacyClient } from '@/lib/legacyBrowser'
import { parseWeightInput } from '@/lib/formatWeight'
import { parseUnitPriceInput } from '@/lib/productTiers'

export type DecimalKind = 'weight' | 'price' | 'decimal'

type DecimalInputProps = FormControlProps & {
  /** Tipo de validación visual. Default: decimal genérico. */
  kind?: DecimalKind
  /** Vacío permitido (peso opcional). Default: true para weight, false para price. */
  allowEmpty?: boolean
  /** Mostrar texto de error debajo. Default: true si el diseño lo permite. */
  showFeedback?: boolean
}

function validateDraft(
  raw: string,
  kind: DecimalKind,
  allowEmpty: boolean,
): { valid: boolean; message?: string } {
  const trimmed = raw.trim()
  if (!trimmed) {
    if (allowEmpty) return { valid: true }
    return { valid: false, message: 'Completá este campo' }
  }

  if (kind === 'weight') {
    const r = parseWeightInput(raw)
    if (!r.ok) return { valid: false, message: r.message }
    return { valid: true }
  }

  if (kind === 'price') {
    const r = parseUnitPriceInput(raw)
    if (!r.ok) return { valid: false, message: r.message }
    return { valid: true }
  }

  // decimal genérico: dígitos + opcional . o ,
  const normalized = trimmed.replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return { valid: false, message: 'Solo números (podés usar . o ,)' }
  }
  const value = parseFloat(normalized)
  if (!Number.isFinite(value) || value < 0) {
    return { valid: false, message: 'Valor inválido' }
  }
  return { valid: true }
}

/**
 * Input decimal.
 * - Legacy (Chrome ≤81 / Android 4.4): sin `inputMode` → teclado libre (en tabE el pad deja "." desactivado).
 * - Moderno: `inputMode="decimal"`.
 * - Si el valor no es numérico válido, borde rojo + mensaje (letras, formato, etc.).
 */
export const DecimalInput = forwardRef<HTMLInputElement, DecimalInputProps>(
  function DecimalInput(
    {
      type: _type,
      inputMode,
      autoComplete,
      kind = 'decimal',
      allowEmpty,
      showFeedback = true,
      value,
      onChange,
      isInvalid: isInvalidProp,
      className,
      ...props
    },
    ref,
  ) {
    const legacy = isLegacyClient()
    const emptyOk = allowEmpty ?? kind === 'weight'
    const raw = String(value ?? '')

    const check = useMemo(
      () => validateDraft(raw, kind, emptyOk),
      [raw, kind, emptyOk],
    )

    // Solo marcar si hay texto y es inválido (no molestar el vacío opcional).
    // Precio required vacío: no forzar rojo hasta que tipeen basura; el submit ya bloquea.
    const showInvalid =
      isInvalidProp ??
      (raw.trim() !== '' && !check.valid)

    return (
      <>
        <Form.Control
          ref={ref}
          type="text"
          inputMode={legacy ? undefined : (inputMode ?? 'decimal')}
          autoComplete={autoComplete ?? 'off'}
          value={value}
          onChange={onChange}
          isInvalid={showInvalid}
          className={className}
          aria-invalid={showInvalid || undefined}
          {...props}
        />
        {showFeedback && showInvalid && check.message ? (
          <Form.Control.Feedback type="invalid" className="d-block">
            {check.message}
          </Form.Control.Feedback>
        ) : null}
      </>
    )
  },
)
