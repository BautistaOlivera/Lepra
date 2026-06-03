/** Restaura body tras un cierre de modal incompleto (no toca nodos .modal: React los controla). */
export function releaseBootstrapModalLock(): void {
  if (document.querySelectorAll('.modal.show').length > 0) return

  const body = document.body
  body.classList.remove('modal-open')
  body.removeAttribute('data-rr-ui-modal-open')
  body.style.removeProperty('overflow')
  body.style.removeProperty('padding-right')
  body.style.removeProperty('padding-left')

  document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove())

  const root = document.getElementById('root')
  root?.removeAttribute('aria-hidden')
  root?.removeAttribute('inert')
}
