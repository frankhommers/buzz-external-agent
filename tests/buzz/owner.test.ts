import { describe, expect, spyOn, test } from 'bun:test'
import { ed25519 } from '@noble/curves/ed25519.js'
import { applyOperatorBlocks, buildOwnerView, createOwner } from '../../src/buzz/owner'
import type { BlockMessage, Relay } from '../../src/buzz/relay'
import type { AgentSummary, AgentsSnapshot } from '../../src/buzz/types'
import { RUNTIME } from '../../src/constants'
import type { SignedEvent } from '../../src/core/events'
import { encodeNpub } from '../../src/core/keys'
import type { Block, SlotOffer } from '../../src/core/messages'
import { createStore, type PendingSetup, type Store } from '../../src/core/store'
import { agentSummary } from '../helpers/fake-session'
import { MemoryStorage } from '../helpers/memory-storage'

const ORIGIN = 'https://relay.example.com'
const COMMUNITY = 'wss://relay.example.com'
const OTHER_COMMUNITY = 'wss://other.example.com'
const hex = (c: string): string => c.repeat(64)
const viewer = hex('a')
const operator = hex('b')
const stranger = hex('c')
const agentA = hex('d')
const agentB = hex('e')

const hostKeyLine = (seed: number): string => {
  const part = (b: Uint8Array): Uint8Array => {
    const out = new Uint8Array(4 + b.length)
    new DataView(out.buffer).setUint32(0, b.length)
    out.set(b, 4)
    return out
  }
  const blob = new Uint8Array([
    ...part(new TextEncoder().encode('ssh-ed25519')),
    ...part(ed25519.getPublicKey(new Uint8Array(32).fill(seed))),
  ])
  return `ssh-ed25519 ${Buffer.from(blob).toString('base64')}`
}

const offer = (slot: string, community = COMMUNITY): SlotOffer => ({
  v: 1,
  type: 'slot-offer',
  slot,
  label: `Server ${slot}`,
  hostKey: hostKeyLine(7),
  community,
})

const pendingFor = (slot: string, pubkey: string): PendingSetup => ({
  slot,
  community: COMMUNITY,
  owner: viewer,
  hostFingerprint: 'SHA256:x',
  pubkey,
  sealed: '-----BEGIN AGE ENCRYPTED FILE-----',
  profile: {} as SignedEvent,
  name: 'Robo',
})

const from = (sender: string, block: Block): BlockMessage => ({ sender, block })
const installed = (pubkey: string): Block => ({ v: 1, type: 'installed', slot: 'vps-1', pubkey })
const retired = (pubkey: string): Block => ({ v: 1, type: 'retired', slot: 'vps-1', pubkey })

const newStore = (): Store => createStore(new MemoryStorage(), { origin: ORIGIN, viewer })
const context = { operator, viewer, community: COMMUNITY }

describe('applyOperatorBlocks', () => {
  test('adds offers from the operator for this community only', () => {
    const store = newStore()
    applyOperatorBlocks(
      store,
      [
        from(operator, offer('vps-1')),
        from(operator, offer('vps-2', OTHER_COMMUNITY)),
        from(stranger, offer('vps-3')),
        from(viewer, offer('vps-4')),
      ],
      context,
    )
    expect(store.offers().map((o) => o.slot)).toEqual(['vps-1'])
  })

  test('marks installed and retired agents', () => {
    const store = newStore()
    applyOperatorBlocks(
      store,
      [from(operator, installed(agentA)), from(operator, retired(agentB))],
      context,
    )
    expect(store.statusOf(agentA)).toBe('installed')
    expect(store.statusOf(agentB)).toBe('retired')
  })

  test('ignores status blocks not sent by the operator', () => {
    const store = newStore()
    applyOperatorBlocks(
      store,
      [from(stranger, installed(agentA)), from(viewer, retired(agentB))],
      context,
    )
    expect(store.statusOf(agentA)).toBeUndefined()
    expect(store.statusOf(agentB)).toBeUndefined()
  })

  test('a late installed never downgrades retire-requested or retired', () => {
    const store = newStore()
    store.setStatus(agentA, 'retire-requested')
    applyOperatorBlocks(
      store,
      [from(operator, retired(agentB)), from(operator, installed(agentB))],
      context,
    )
    applyOperatorBlocks(store, [from(operator, installed(agentA))], context)
    expect(store.statusOf(agentA)).toBe('retire-requested')
    expect(store.statusOf(agentB)).toBe('retired')
  })

  test('retired wins over retire-requested', () => {
    const store = newStore()
    store.setStatus(agentA, 'retire-requested')
    applyOperatorBlocks(store, [from(operator, retired(agentA))], context)
    expect(store.statusOf(agentA)).toBe('retired')
  })

  test('ignores requests addressed to an operator', () => {
    const store = newStore()
    applyOperatorBlocks(
      store,
      [from(operator, { v: 1, type: 'retire-request', slot: 'vps-1', pubkey: agentA })],
      context,
    )
    expect(store.statusOf(agentA)).toBeUndefined()
  })
})

describe('buildOwnerView', () => {
  test('lists unused offers for this community and our hosted agents', () => {
    const store = newStore()
    store.setSettings({ operator: encodeNpub(operator) })
    store.addOffer(offer('vps-1'))
    store.addOffer(offer('vps-2'))
    store.addOffer(offer('vps-3', OTHER_COMMUNITY))
    store.putPending(pendingFor('vps-2', agentA))
    store.setStatus(agentA, 'installed')
    store.setStatus(agentB, 'retired')
    const agents: AgentSummary[] = [
      agentSummary(agentA, 'hosted', { name: 'Robo', type: RUNTIME }),
      agentSummary(agentB, 'hosted', { name: 'Old', type: RUNTIME }),
      agentSummary(stranger, 'here', { name: 'Local' }),
    ]
    expect(buildOwnerView(store, agents, COMMUNITY)).toEqual({
      operator: encodeNpub(operator),
      offers: [{ slot: 'vps-1', label: 'Server vps-1' }],
      agents: [
        { pubkey: agentA, name: 'Robo', status: 'Installed by the operator', canRetire: true },
        {
          pubkey: agentB,
          name: 'Old',
          status: 'Stopped by the operator — you can delete it now',
          canRetire: false,
        },
      ],
    })
  })

  test('status lines and retire availability per status', () => {
    const store = newStore()
    const agents = [agentSummary(agentA, 'hosted', { type: RUNTIME })]
    const row = () => buildOwnerView(store, agents, COMMUNITY).agents[0]
    expect(row()).toMatchObject({ status: 'Hosted on your server', canRetire: true })
    store.setStatus(agentA, 'awaiting-install')
    expect(row()).toMatchObject({ status: 'Waiting for installation', canRetire: true })
    store.setStatus(agentA, 'retire-requested')
    expect(row()).toMatchObject({ status: 'Waiting for the operator', canRetire: false })
  })
})

interface Fake {
  relayReady?: boolean
  readError?: Error
  messages?: BlockMessage[]
  agentsSnapshot?: AgentsSnapshot
}

const setup = (options: Fake = {}) => {
  const storage = new MemoryStorage()
  const store = createStore(storage, { origin: ORIGIN, viewer })
  const sentBlocks: { to: string; block: Block }[] = []
  const readsFrom: string[] = []
  const relay: Relay = {
    ready: async () => {
      if (options.relayReady === false) throw new Error('Not connected to a community yet')
      return { origin: ORIGIN, viewer, community: COMMUNITY }
    },
    readOwnRecords: async () => ({ ok: true, records: new Map() }),
    readProfile: async () => undefined,
    publishRecord: async () => {},
    publishSigned: async () => {},
    sendBlock: async (to, block) => {
      sentBlocks.push({ to, block })
    },
    readBlocks: async (withPubkey) => {
      readsFrom.push(withPubkey)
      if (options.readError) throw options.readError
      return options.messages ?? []
    },
    isLocalIdentity: () => false,
  }
  const owner = createOwner({
    relay,
    storeFor: (scope) => createStore(storage, scope),
    agents: {
      snapshot: () =>
        options.agentsSnapshot ?? {
          status: 'ready',
          agents: [agentSummary(agentA, 'hosted', { name: 'Robo', type: RUNTIME })],
          running: [],
        },
    },
  })
  return { owner, store, sentBlocks, readsFrom }
}

describe('createOwner', () => {
  test.each([
    [undefined, 'Unknown — set up outside this device', true],
    ['awaiting-install', 'Waiting for installation', true],
    ['installed', 'Installed', true],
    ['retire-requested', 'Retirement requested — waiting for the operator', false],
    ['retired', 'Stopped by the operator — you can delete it now', false],
  ] as const)('agentStatus of %p reads %p', async (status, text, canRetire) => {
    const fake = setup()
    if (status !== undefined) fake.store.setStatus(agentA, status)
    expect(await fake.owner.agentStatus(agentA)).toEqual({ text, canRetire })
  })

  test('poll reads only the DM with the operator and applies its blocks', async () => {
    const fake = setup({ messages: [from(operator, offer('vps-1'))] })
    fake.store.setSettings({ operator: encodeNpub(operator) })
    let notified = 0
    fake.owner.subscribe(() => notified++)
    await fake.owner.poll()
    expect(fake.readsFrom).toEqual([operator])
    expect(fake.store.offers().map((o) => o.slot)).toEqual(['vps-1'])
    expect(notified).toBe(1)
  })

  test('overlapping polls share one read', async () => {
    const fake = setup()
    fake.store.setSettings({ operator: encodeNpub(operator) })
    await Promise.all([fake.owner.poll(), fake.owner.poll()])
    expect(fake.readsFrom).toEqual([operator])
    await fake.owner.poll()
    expect(fake.readsFrom).toEqual([operator, operator])
  })

  test('poll does nothing without an operator or a connection', async () => {
    const noOperator = setup()
    await noOperator.owner.poll()
    expect(noOperator.readsFrom).toHaveLength(0)
    const offline = setup({ relayReady: false })
    await offline.owner.poll()
    expect(offline.readsFrom).toHaveLength(0)
  })

  test('pollSafely logs a failure without secrets and does not throw', async () => {
    const fake = setup({ readError: new Error('relay timeout') })
    fake.store.setSettings({ operator: encodeNpub(operator) })
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await fake.owner.pollSafely()
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0])).toContain('relay timeout')
    } finally {
      warn.mockRestore()
    }
  })

  test('saveOperator accepts an npub and rejects anything else', async () => {
    const fake = setup()
    await expect(fake.owner.saveOperator('not-an-npub')).rejects.toThrow(/npub/)
    await expect(fake.owner.saveOperator(operator)).rejects.toThrow(/npub/)
    expect(fake.store.settings().operator).toBeUndefined()
    await fake.owner.saveOperator(`  ${encodeNpub(operator)} `)
    expect(fake.store.settings().operator).toBe(encodeNpub(operator))
  })

  test('saveOperator keeps the operator template', async () => {
    const fake = setup()
    fake.store.setSettings({ template: 'deploy {name}' })
    await fake.owner.saveOperator(encodeNpub(operator))
    expect(fake.store.settings()).toEqual({
      operator: encodeNpub(operator),
      template: 'deploy {name}',
    })
  })

  test('retire sends retire-request with the setup slot and marks the agent', async () => {
    const fake = setup()
    fake.store.setSettings({ operator: encodeNpub(operator) })
    fake.store.putPending(pendingFor('vps-2', agentA))
    fake.store.setStatus(agentA, 'installed')
    await fake.owner.retire(agentA)
    expect(fake.sentBlocks).toEqual([
      { to: operator, block: { v: 1, type: 'retire-request', slot: 'vps-2', pubkey: agentA } },
    ])
    expect(fake.store.statusOf(agentA)).toBe('retire-requested')
  })

  test('retire of an adopted agent uses slot adopted', async () => {
    const fake = setup()
    fake.store.setSettings({ operator: encodeNpub(operator) })
    await fake.owner.retire(agentA)
    expect(fake.sentBlocks[0]?.block).toEqual({
      v: 1,
      type: 'retire-request',
      slot: 'adopted',
      pubkey: agentA,
    })
  })

  test('retire refuses without operator, when already retiring, or for other agents', async () => {
    const noOperator = setup()
    await expect(noOperator.owner.retire(agentA)).rejects.toThrow(/operator/)
    const retiring = setup()
    retiring.store.setSettings({ operator: encodeNpub(operator) })
    retiring.store.setStatus(agentA, 'retire-requested')
    await expect(retiring.owner.retire(agentA)).rejects.toThrow()
    await expect(retiring.owner.retire(agentB)).rejects.toThrow()
    expect([...noOperator.sentBlocks, ...retiring.sentBlocks]).toHaveLength(0)
    expect(retiring.store.statusOf(agentA)).toBe('retire-requested')
  })

  test('a failed send leaves the status unchanged', async () => {
    const fake = setup()
    fake.store.setSettings({ operator: encodeNpub(operator) })
    fake.store.setStatus(agentA, 'installed')
    const failing = createOwner({
      relay: {
        ...({} as Relay),
        ready: async () => ({ origin: ORIGIN, viewer, community: COMMUNITY }),
        sendBlock: async () => {
          throw new Error('not sent')
        },
      },
      storeFor: () => fake.store,
      agents: {
        snapshot: () => ({
          status: 'ready',
          agents: [agentSummary(agentA, 'hosted', { type: RUNTIME })],
          running: [],
        }),
      },
    })
    await expect(failing.retire(agentA)).rejects.toThrow('not sent')
    expect(fake.store.statusOf(agentA)).toBe('installed')
  })

  test('view combines the store with the agents snapshot', async () => {
    const fake = setup()
    expect(await fake.owner.view()).toEqual({
      operator: '',
      offers: [],
      agents: [{ pubkey: agentA, name: 'Robo', status: 'Hosted on your server', canRetire: true }],
    })
  })
})
