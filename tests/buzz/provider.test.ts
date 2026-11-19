import { describe, expect, test } from 'bun:test'
import { ed25519 } from '@noble/curves/ed25519.js'
import { agentType, createProvider, type ProviderDeps } from '../../src/buzz/provider'
import type { BlockMessage, Relay } from '../../src/buzz/relay'
import { TYPE_ID } from '../../src/constants'
import { profileOwner, type SignedEvent, verifyEvent } from '../../src/core/events'
import { encodeNpub, generateSecretKey, publicKeyHex } from '../../src/core/keys'
import type { Block, SlotOffer } from '../../src/core/messages'
import type { NipOaTag } from '../../src/core/nipoa'
import { createStore } from '../../src/core/store'
import { MemoryStorage } from '../helpers/memory-storage'
import { signNipOaForTests } from '../helpers/nipoa'

const ORIGIN = 'https://relay.example.com'
const COMMUNITY = 'wss://relay.example.com'
const OTHER_COMMUNITY = 'wss://other.example.com'
const NOW_MS = 1_800_000_000_000

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

const offerFor = (slot: string, overrides: Partial<SlotOffer> = {}): SlotOffer => ({
  v: 1,
  type: 'slot-offer',
  slot,
  label: 'My VPS',
  hostKey: hostKeyLine(7),
  community: COMMUNITY,
  ...overrides,
})

interface Options {
  operator?: string | undefined
  ownerSecret?: Uint8Array
  hostOwnerSecret?: Uint8Array
  publishError?: Error
}

const setup = (options: Options = {}) => {
  const ownerSecret = options.ownerSecret ?? generateSecretKey()
  const viewer = publicKeyHex(ownerSecret)
  const operatorHex = publicKeyHex(generateSecretKey())
  const storage = new MemoryStorage()
  const scope = { origin: ORIGIN, viewer }
  const store = createStore(storage, scope)
  const operator = 'operator' in options ? options.operator : encodeNpub(operatorHex)
  if (operator !== undefined) store.setSettings({ operator })
  store.addOffer(offerFor('vps-1'))

  const published: SignedEvent[] = []
  const blocks: { to: string; block: Block }[] = []
  const authCalls: string[] = []
  const relay: Relay = {
    ready: async () => ({ origin: ORIGIN, viewer, community: COMMUNITY }),
    readOwnRecords: async () => ({ ok: true, records: new Map() }),
    readProfile: async () => undefined,
    publishRecord: async () => {},
    publishSigned: async (event) => {
      if (options.publishError) throw options.publishError
      published.push(event)
    },
    sendBlock: async (to, block) => {
      blocks.push({ to, block })
    },
    readBlocks: async (): Promise<BlockMessage[]> => [],
    isLocalIdentity: () => false,
  }
  const deps: ProviderDeps = {
    relay,
    storeFor: (s) => createStore(storage, s),
    host: {
      prepareRemoteAgentAuthorization: async (pubkey): Promise<NipOaTag> => {
        authCalls.push(pubkey)
        return signNipOaForTests(options.hostOwnerSecret ?? ownerSecret, pubkey)
      },
    },
    now: () => NOW_MS,
  }
  return {
    provider: createProvider(deps),
    deps,
    store,
    storage,
    viewer,
    operatorHex,
    published,
    blocks,
    authCalls,
  }
}

const signal = (): AbortSignal => new AbortController().signal

const provisionInput = (overrides: Record<string, unknown> = {}) => ({
  name: 'Helper',
  picture: 'https://example.com/a.png',
  community: COMMUNITY,
  config: { slot: 'vps-1' },
  signal: signal(),
  ...overrides,
})

const allStored = (storage: MemoryStorage): string =>
  storage
    .keys()
    .map((key) => storage.getItem(key) ?? '')
    .join('\n')

describe('provision', () => {
  test('authorizes, publishes a verified profile owned by the viewer and seals the key', async () => {
    const { provider, store, storage, viewer, published, authCalls } = setup()
    const result = await provider.provision(provisionInput())

    expect(result.pubkey).toMatch(/^[0-9a-f]{64}$/)
    expect(result.picture).toBe('https://example.com/a.png')
    expect(authCalls).toEqual([result.pubkey])

    expect(published).toHaveLength(1)
    const profile = published[0] as SignedEvent
    expect(profile.pubkey).toBe(result.pubkey)
    expect(profile.created_at).toBe(NOW_MS / 1000)
    expect(verifyEvent(profile)).toBe(true)
    expect(profileOwner(profile)).toBe(viewer)
    expect(JSON.parse(profile.content)).toMatchObject({ name: 'Helper', bot: true })

    const pending = store.pendingFor('vps-1')
    expect(pending?.pubkey).toBe(result.pubkey)
    expect(pending?.community).toBe(COMMUNITY)
    expect(pending?.owner).toBe(viewer)
    expect(pending?.name).toBe('Helper')
    expect(pending?.sealed.startsWith('-----BEGIN AGE ENCRYPTED FILE-----')).toBe(true)
    expect(pending?.profile).toEqual(profile)
    expect(allStored(storage)).not.toMatch(/nsec1/i)
  })

  test('retry with the same slot returns the same pubkey without a new key', async () => {
    const { provider, published, authCalls } = setup()
    const first = await provider.provision(provisionInput())
    const second = await provider.provision(
      provisionInput({ picture: 'https://example.com/b.png' }),
    )

    expect(second).toEqual(first)
    expect(authCalls).toHaveLength(1)
    expect(published).toHaveLength(1)
  })

  test('retry for the same slot in another community throws', async () => {
    const { provider, store } = setup()
    await provider.provision(provisionInput())
    store.addOffer(offerFor('vps-1', { community: OTHER_COMMUNITY }))

    await expect(
      provider.provision(provisionInput({ community: OTHER_COMMUNITY })),
    ).rejects.toThrow('This server is already being set up for another agent')
  })

  test('retry after the slot host key changed throws', async () => {
    const { provider, store } = setup()
    await provider.provision(provisionInput())
    store.addOffer(offerFor('vps-1', { hostKey: hostKeyLine(9) }))

    await expect(provider.provision(provisionInput())).rejects.toThrow(
      'This server is already being set up for another agent',
    )
  })

  test('refuses a slot whose agent was already installed', async () => {
    const { provider, store, authCalls } = setup()
    const { pubkey } = await provider.provision(provisionInput())
    store.markInstalled(pubkey)

    await expect(provider.provision(provisionInput())).rejects.toThrow(
      'This server already runs an agent',
    )
    expect(authCalls).toHaveLength(1)
  })

  test('refuses a name the operator would not accept', async () => {
    const { provider, authCalls } = setup()
    for (const name of ['', 'x'.repeat(81), 'a\nb']) {
      await expect(provider.provision(provisionInput({ name }))).rejects.toThrow(
        'Use a name of 1 to 80 characters',
      )
    }
    expect(authCalls).toHaveLength(0)
  })

  test('requires a configured operator', async () => {
    const { provider, authCalls } = setup({ operator: undefined })
    await expect(provider.provision(provisionInput())).rejects.toThrow(
      'Set the operator in Settings → Self-hosted agents first',
    )
    expect(authCalls).toHaveLength(0)
  })

  test('requires a slot offered for this community', async () => {
    const { provider, authCalls } = setup()
    const noSlot = 'Choose a server offered to you for this community'
    for (const overrides of [
      { config: { slot: '' } },
      { config: { slot: 'nope' } },
      { config: undefined },
      { community: OTHER_COMMUNITY },
    ]) {
      await expect(provider.provision(provisionInput(overrides))).rejects.toThrow(noSlot)
    }
    expect(authCalls).toHaveLength(0)
  })

  test('rejects an authorization from someone other than the viewer', async () => {
    const { provider, store, published } = setup({ hostOwnerSecret: generateSecretKey() })
    await expect(provider.provision(provisionInput())).rejects.toThrow(
      'Buzz did not return a valid owner proof for this agent',
    )
    expect(published).toHaveLength(0)
    expect(store.pending()).toHaveLength(0)
  })

  test('does not persist a pending setup when publishing the profile fails', async () => {
    const { provider, store } = setup({ publishError: new Error('relay refused') })
    await expect(provider.provision(provisionInput())).rejects.toThrow('relay refused')
    expect(store.pending()).toHaveLength(0)
  })

  test('honours an aborted signal before doing anything', async () => {
    const { provider, authCalls, store } = setup()
    const controller = new AbortController()
    controller.abort()
    await expect(
      provider.provision(provisionInput({ signal: controller.signal })),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(authCalls).toHaveLength(0)
    expect(store.pending()).toHaveLength(0)
  })
})

describe('activate', () => {
  test('sends exactly one install-request to the operator and awaits installation', async () => {
    const { provider, store, blocks, operatorHex } = setup()
    const { pubkey } = await provider.provision(provisionInput())
    const pending = store.pendingFor('vps-1')
    const auth = pending?.profile.tags.find((tag) => tag[0] === 'auth')

    await provider.activate({
      pubkey,
      name: 'Helper',
      community: COMMUNITY,
      auth: auth as unknown as NipOaTag,
      signal: signal(),
    })

    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.to).toBe(operatorHex)
    expect(blocks[0]?.block).toEqual({
      v: 1,
      type: 'install-request',
      slot: 'vps-1',
      pubkey,
      name: 'Helper',
      auth: auth as unknown as NipOaTag,
      sealed: pending?.sealed ?? '',
    })
    expect(store.statusOf(pubkey)).toBe('awaiting-install')
  })

  test('unknown pubkey throws', async () => {
    const { provider, blocks } = setup()
    const auth = signNipOaForTests(generateSecretKey(), 'a'.repeat(64))
    await expect(
      provider.activate({
        pubkey: 'a'.repeat(64),
        name: 'x',
        community: COMMUNITY,
        auth,
        signal: signal(),
      }),
    ).rejects.toThrow('Unknown agent setup')
    expect(blocks).toHaveLength(0)
  })
})

describe('profile', () => {
  test('throws because the key is not held in Buzz', async () => {
    const { provider } = setup()
    await expect(
      provider.profile({
        pubkey: 'a'.repeat(64),
        community: COMMUNITY,
        name: 'x',
        signal: signal(),
      }),
    ).rejects.toThrow(
      "Change the name or avatar on the server; this agent's key is not held in Buzz",
    )
  })
})

describe('remove', () => {
  test('an unfinished setup is removed and frees its slot', async () => {
    const { provider, store, blocks } = setup()
    const { pubkey } = await provider.provision(provisionInput())

    await expect(
      provider.remove({ pubkey, community: COMMUNITY, signal: signal() }),
    ).resolves.toBeUndefined()
    expect(store.pendingFor('vps-1')).toBeUndefined()
    expect(blocks).toHaveLength(0)

    const again = await provider.provision(provisionInput())
    expect(again.pubkey).not.toBe(pubkey)
  })

  test('throws while awaiting install, resolves once retired', async () => {
    const { provider, store } = setup()
    const { pubkey } = await provider.provision(provisionInput())
    const auth = signNipOaForTests(generateSecretKey(), pubkey)
    await provider.activate({
      pubkey,
      name: 'Helper',
      community: COMMUNITY,
      auth,
      signal: signal(),
    })
    expect(store.statusOf(pubkey)).toBe('awaiting-install')
    const input = { pubkey, community: COMMUNITY, signal: signal() }

    await expect(provider.remove(input)).rejects.toThrow(
      'Retire this agent first, then delete it again',
    )
    store.markRetired(pubkey)
    await expect(provider.remove(input)).resolves.toBeUndefined()
  })
})

describe('agentType', () => {
  // Mirrors Agents.register in Buzz 1.0.5 (features/agents/service.ts:3042-3065).
  const passesRegistration = (type: Record<string, unknown>): boolean => {
    const remote = type.remote as Record<string, unknown> | undefined
    return (
      /^[a-z0-9][a-z0-9._-]*$/.test(String(type.id ?? '')) &&
      Boolean(type.title) &&
      typeof type.defaults === 'function' &&
      remote !== undefined &&
      type.run === undefined &&
      type.models === undefined &&
      type.timeoutMs === undefined &&
      (['provision', 'activate', 'profile', 'remove'] as const).every(
        (step) => typeof remote[step] === 'function',
      )
    )
  }

  test('is a hosted type that Buzz 1.0.5 accepts', () => {
    const { deps } = setup()
    const type = agentType(deps)
    expect(type.id).toBe(TYPE_ID)
    expect(type.title).toBe('Self-hosted agent')
    expect(type.defaults()).toEqual({ config: { slot: '' } })
    expect(passesRegistration(type as unknown as Record<string, unknown>)).toBe(true)
  })
})
