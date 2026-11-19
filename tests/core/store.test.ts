import { describe, expect, test } from 'bun:test'
import { STORAGE_PREFIX } from '../../src/constants'
import type { SignedEvent } from '../../src/core/events'
import type { InstallRequest, RetireRequest, SlotOffer } from '../../src/core/messages'
import { createStore, type OperatorSlot, type PendingSetup } from '../../src/core/store'
import { MemoryStorage } from '../helpers/memory-storage'

const scope = { origin: 'wss://relay.example', viewer: 'a'.repeat(64) }
const hex = (c: string): string => c.repeat(64)

const offer = (slot: string): SlotOffer => ({
  v: 1,
  type: 'slot-offer',
  slot,
  label: 'Box',
  hostKey: 'ssh-ed25519 AAAA',
  community: 'wss://relay.example',
})

const request = (pubkey: string): InstallRequest => ({
  v: 1,
  type: 'install-request',
  slot: 'one',
  pubkey,
  name: 'Bot',
  auth: ['auth', hex('1'), '', hex('2')],
  sealed: '-----BEGIN AGE ENCRYPTED FILE-----\nabc',
})

const profile = { id: hex('3'), pubkey: hex('4'), kind: 0 } as unknown as SignedEvent

const pending = (slot: string, pubkey = hex('5')): PendingSetup => ({
  slot,
  community: 'wss://relay.example',
  owner: hex('6'),
  hostFingerprint: 'SHA256:abc',
  pubkey,
  sealed: '-----BEGIN AGE ENCRYPTED FILE-----\nabc',
  profile,
  name: 'Bot',
})

const slot = (id: string): OperatorSlot => ({
  slot: id,
  label: 'Box',
  host: { line: 'ssh-ed25519 AAAA', fingerprint: 'SHA256:abc' },
  state: 'open',
})

describe('createStore', () => {
  test('keys are prefixed and differ per scope', () => {
    const storage = new MemoryStorage()
    createStore(storage, scope).setSettings({ operator: hex('7') })
    createStore(storage, { ...scope, viewer: hex('b') }).setSettings({ operator: hex('8') })
    createStore(storage, { ...scope, origin: 'wss://other.example' }).addOffer(offer('x'))
    const keys = storage.keys()
    expect(keys.length).toBe(3)
    expect(keys.every((k) => k.startsWith(STORAGE_PREFIX))).toBe(true)
    expect(keys.some((k) => k.includes(encodeURIComponent(scope.origin)))).toBe(true)
    expect(createStore(storage, scope).settings().operator).toBe(hex('7'))
    expect(createStore(storage, { ...scope, viewer: hex('b') }).settings().operator).toBe(hex('8'))
    expect(createStore(storage, scope).offers()).toEqual([])
  })

  test('settings round-trip', () => {
    const store = createStore(new MemoryStorage(), scope)
    expect(store.settings()).toEqual({})
    store.setSettings({ operator: hex('7'), template: 'ssh {host}' })
    expect(store.settings()).toEqual({ operator: hex('7'), template: 'ssh {host}' })
  })

  test('offers and pending', () => {
    const store = createStore(new MemoryStorage(), scope)
    store.addOffer(offer('one'))
    store.addOffer(offer('two'))
    store.addOffer(offer('one'))
    expect(store.offers().map((o) => o.slot)).toEqual(['one', 'two'])
    expect(store.pendingFor('one')).toBeUndefined()
    store.putPending(pending('one'))
    store.putPending(pending('one'))
    expect(store.pending().length).toBe(1)
    expect(store.pendingFor('one')?.name).toBe('Bot')
  })

  test('status lifecycle', () => {
    const store = createStore(new MemoryStorage(), scope)
    expect(store.statusOf(hex('5'))).toBeUndefined()
    expect(store.isRetired(hex('5'))).toBe(false)
    store.setStatus(hex('5'), 'awaiting-install')
    expect(store.statusOf(hex('5'))).toBe('awaiting-install')
    store.markInstalled(hex('5'))
    expect(store.statusOf(hex('5'))).toBe('installed')
    store.setStatus(hex('5'), 'retire-requested')
    expect(store.isRetired(hex('5'))).toBe(false)
    store.markRetired(hex('5'))
    expect(store.statusOf(hex('5'))).toBe('retired')
    expect(store.isRetired(hex('5'))).toBe(true)
  })

  test('operator slots and requests dedupe', () => {
    const store = createStore(new MemoryStorage(), scope)
    store.putSlot(slot('one'))
    store.putSlot({ ...slot('one'), state: 'requested' })
    store.putSlot(slot('two'))
    expect(store.slots().length).toBe(2)
    expect(store.slots().find((s) => s.slot === 'one')?.state).toBe('requested')
    store.addRequest(request(hex('9')))
    store.addRequest(request(hex('9')))
    store.addRequest(request(hex('a')))
    expect(store.requests().map((r) => r.pubkey)).toEqual([hex('9'), hex('a')])
  })

  test('retire requests dedupe by pubkey', () => {
    const store = createStore(new MemoryStorage(), scope)
    const r = (pubkey: string): RetireRequest => ({
      v: 1,
      type: 'retire-request',
      slot: 'one',
      pubkey,
    })
    store.addRetireRequest(r(hex('9')))
    store.addRetireRequest(r(hex('9')))
    store.addRetireRequest(r(hex('a')))
    expect(store.retireRequests().length).toBe(2)
  })

  test('refuses secret material, including uppercase', () => {
    const store = createStore(new MemoryStorage(), scope)
    const nsec = `nsec1${'q'.repeat(58)}`
    expect(() => store.setSettings({ template: nsec })).toThrow('Refusing to store secret material')
    expect(() => store.setSettings({ template: nsec.toUpperCase() })).toThrow(
      'Refusing to store secret material',
    )
    expect(store.settings()).toEqual({})
  })

  test('corrupt JSON or wrong shape reads as empty', () => {
    const storage = new MemoryStorage()
    const store = createStore(storage, scope)
    store.setSettings({ operator: hex('7') })
    store.addOffer(offer('one'))
    store.setStatus(hex('5'), 'installed')
    for (const key of storage.keys()) {
      storage.setItem(key, '{not json')
    }
    expect(store.settings()).toEqual({})
    expect(store.offers()).toEqual([])
    expect(store.statusOf(hex('5'))).toBeUndefined()
    for (const key of storage.keys()) {
      storage.setItem(key, '42')
    }
    expect(store.settings()).toEqual({})
    expect(store.offers()).toEqual([])
    expect(store.pending()).toEqual([])
    expect(store.slots()).toEqual([])
    expect(store.statusOf(hex('5'))).toBeUndefined()
  })

  test('storage write failure propagates', () => {
    const storage = new MemoryStorage()
    storage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    expect(() => createStore(storage, scope).addOffer(offer('one'))).toThrow('QuotaExceededError')
  })
})
