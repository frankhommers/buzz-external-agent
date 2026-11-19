import { describe, expect, test } from 'bun:test'
import { isOperatorViewer, operatorCardVisibility } from '../../src/buzz/operator-visibility'
import type { RelaySnapshot } from '../../src/buzz/types'
import { encodeNpub } from '../../src/core/keys'
import { createStore, type Store } from '../../src/core/store'
import { MemoryStorage } from '../helpers/memory-storage'

const viewer = 'a'.repeat(64)
const other = 'b'.repeat(64)
const origin = 'https://relay.example.com'

const snapshot = (overrides: Partial<RelaySnapshot> = {}): RelaySnapshot => ({
  status: 'ready',
  origin,
  viewer,
  session: {} as RelaySnapshot['session'],
  ...overrides,
})

const storesWith = (operator: string | undefined) => {
  const storage = new MemoryStorage()
  const storeFor = (scope: { origin: string; viewer: string }): Store => createStore(storage, scope)
  if (operator !== undefined) storeFor({ origin, viewer }).setSettings({ operator })
  return storeFor
}

describe('isOperatorViewer', () => {
  test('true when the viewer is the configured operator', () => {
    expect(isOperatorViewer(snapshot(), storesWith(encodeNpub(viewer)))).toBe(true)
  })

  test('false when another account is the operator', () => {
    expect(isOperatorViewer(snapshot(), storesWith(encodeNpub(other)))).toBe(false)
  })

  test('false when no operator is set or it is not a valid key', () => {
    expect(isOperatorViewer(snapshot(), storesWith(undefined))).toBe(false)
    expect(isOperatorViewer(snapshot(), storesWith('npub1nonsense'))).toBe(false)
  })

  test('false without a viewer or community', () => {
    const storeFor = storesWith(encodeNpub(viewer))
    expect(isOperatorViewer(snapshot({ viewer: undefined }), storeFor)).toBe(false)
    expect(isOperatorViewer(snapshot({ origin: undefined }), storeFor)).toBe(false)
  })

  test('reads the settings of the current community and viewer only', () => {
    const storeFor = storesWith(encodeNpub(viewer))
    expect(isOperatorViewer(snapshot({ origin: 'https://other.example.com' }), storeFor)).toBe(
      false,
    )
    expect(isOperatorViewer(snapshot({ viewer: other }), storeFor)).toBe(false)
  })

  test('keeps the answer while Buzz reconnects with the same community and viewer', () => {
    const storeFor = storesWith(encodeNpub(viewer))
    expect(isOperatorViewer(snapshot({ status: 'connecting', cached: true }), storeFor)).toBe(true)
  })
})

describe('operatorCardVisibility', () => {
  const setup = (operator: string | undefined) => {
    const storeFor = storesWith(operator)
    let current = snapshot()
    const relayListeners = new Set<() => void>()
    const ownerListeners = new Set<() => void>()
    const listen = (set: Set<() => void>) => (listener: () => void) => {
      set.add(listener)
      return () => void set.delete(listener)
    }
    const visibility = operatorCardVisibility({
      relay: { snapshot: () => current, subscribe: listen(relayListeners) },
      owner: { subscribe: listen(ownerListeners) },
      storeFor,
    })
    const fire = (set: Set<() => void>) => {
      for (const listener of [...set]) listener()
    }
    return {
      visibility,
      relayListeners,
      ownerListeners,
      setSnapshot: (next: RelaySnapshot) => {
        current = next
        fire(relayListeners)
      },
      saveOperator: (value: string) => {
        storeFor({ origin, viewer }).setSettings({ operator: value })
        fire(ownerListeners)
      },
    }
  }

  test('shown for the operator, hidden for anyone else', () => {
    expect(setup(encodeNpub(viewer)).visibility.snapshot()).toBe(true)
    expect(setup(encodeNpub(other)).visibility.snapshot()).toBe(false)
    expect(setup(undefined).visibility.snapshot()).toBe(false)
  })

  test('follows the operator setting as the owner saves it, notifying each time', () => {
    const { visibility, saveOperator } = setup(undefined)
    const seen: boolean[] = []
    visibility.subscribe(() => seen.push(visibility.snapshot() === true))
    saveOperator(encodeNpub(viewer))
    saveOperator(encodeNpub(other))
    saveOperator(encodeNpub(viewer))
    expect(seen).toEqual([true, false, true])
  })

  test('follows the relay session to another community or account', () => {
    const { visibility, setSnapshot } = setup(encodeNpub(viewer))
    const seen: boolean[] = []
    visibility.subscribe(() => seen.push(visibility.snapshot() === true))
    setSnapshot(snapshot({ origin: 'https://other.example.com' }))
    setSnapshot(snapshot({ viewer: other }))
    setSnapshot(snapshot())
    expect(seen).toEqual([false, false, true])
  })

  test('unsubscribing stops both the relay and the owner listener', () => {
    const { visibility, relayListeners, ownerListeners } = setup(encodeNpub(viewer))
    const stop = visibility.subscribe(() => {})
    expect(relayListeners.size).toBe(1)
    expect(ownerListeners.size).toBe(1)
    stop()
    expect(relayListeners.size).toBe(0)
    expect(ownerListeners.size).toBe(0)
  })

  test('ensure has nothing to load and returns a release', () => {
    const release = setup(undefined).visibility.ensure()
    expect(typeof release).toBe('function')
    release()
  })
})
