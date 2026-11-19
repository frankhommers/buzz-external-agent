import { operatorPubkey, type Store } from '../core/store'
import type { CardVisibility, RelayData, RelaySnapshot } from './types'

/**
 * Whether the viewer is the operator configured for the current community. Read from the
 * snapshot's community and viewer, which a cached snapshot keeps while Buzz reconnects.
 */
export const isOperatorViewer = (
  snapshot: RelaySnapshot,
  storeFor: (scope: { origin: string; viewer: string }) => Store,
): boolean => {
  const { origin, viewer } = snapshot
  if (origin === undefined || viewer === undefined) return false
  return operatorPubkey(storeFor({ origin, viewer }).settings()) === viewer
}

export interface OperatorCardVisibilityDeps {
  relay: RelayData
  /** Notifies when the owner settings (the operator) may have changed. */
  owner: { subscribe(listener: () => void): () => void }
  storeFor(scope: { origin: string; viewer: string }): Store
}

/**
 * The operator card's Settings visibility: shown only while the viewer is the current
 * community's operator, re-checked when the relay session or the operator setting changes.
 * Buzz owns the subscription (features/settings/service.ts:126-130).
 */
export const operatorCardVisibility = (deps: OperatorCardVisibilityDeps): CardVisibility => ({
  // Runs inside Buzz's shared Settings publish: a throw would break every plugin's cards.
  snapshot: () => {
    try {
      return isOperatorViewer(deps.relay.snapshot(), deps.storeFor)
    } catch {
      return false
    }
  },
  subscribe: (listener) => {
    const stopRelay = deps.relay.subscribe(listener)
    const stopOwner = deps.owner.subscribe(listener)
    return () => {
      stopRelay()
      stopOwner()
    }
  },
  // Nothing to load: the answer is local.
  ensure: () => () => {},
})
