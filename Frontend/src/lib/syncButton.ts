export type SyncVisualState = 'ok' | 'pending' | 'error'

export function getSyncVisualState(
  pendingOutbox: number,
  outboxFailed: number,
  authRequired: boolean
): SyncVisualState {
  if (authRequired || outboxFailed > 0) return 'error'
  if (pendingOutbox > 0) return 'pending'
  return 'ok'
}

export function stateToButtonVariant(state: SyncVisualState): 'success' | 'warning' | 'danger' {
  switch (state) {
    case 'error':
      return 'danger'
    case 'pending':
      return 'warning'
    default:
      return 'success'
  }
}

export function syncButtonClassName(state: SyncVisualState, extra = ''): string {
  const parts = ['lepra-sync-btn', `lepra-sync-btn--${state}`]
  if (extra) parts.push(extra)
  return parts.join(' ')
}

export function syncButtonProps(state: SyncVisualState, extraClass = '') {
  return {
    variant: stateToButtonVariant(state),
    className: syncButtonClassName(state, extraClass),
  } as const
}
