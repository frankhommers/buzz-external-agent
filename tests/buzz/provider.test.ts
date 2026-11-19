import { describe, expect, test } from 'bun:test'
import { ed25519 } from '@noble/curves/ed25519.js'
import { agentType, createProvider, type ProviderDeps } from '../../src/buzz/provider'
import type { BlockMessage, Relay } from '../../src/buzz/relay'
import { TYPE_ID } from '../../src/constants'
import { profileOwner, type SignedEvent, verifyEvent } from '../../src/core/events'
import { encodeNpub, generateSecretKey, publicKeyHex } from '../../src/core/keys'
import type { Block, SlotOffer } from '../../src/core/messages'
import type { NipOaTag } from '../../src/core/nipoa'
import { parseHostKey } from '../../src/core/seal'
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
  readError?: Error
  sendError?: Error
  /** The viewer is also the configured operator, with vps-1 offered to self. */
  operatorIsViewer?: boolean
}

const setup = (options: Options = {}) => {
  const ownerSecret = options.ownerSecret ?? generateSecretKey()
  const viewer = publicKeyHex(ownerSecret)
  const operatorHex = publicKeyHex(generateSecretKey())
  const storage = new MemoryStorage()
  const scope = { origin: ORIGIN, viewer }
  const store = createStore(storage, scope)
  const operator = options.operatorIsViewer
    ? encodeNpub(viewer)
    : 'operator' in options
      ? options.operator
      : encodeNpub(operatorHex)
  if (operator !== undefined) store.setSettings({ operator })
  store.addOffer(offerFor('vps-1'))
  if (options.operatorIsViewer)
    store.putSlot({
      slot: 'vps-1',
      label: 'My VPS',
      host: parseHostKey(hostKeyLine(7)),
      owner: viewer,
      state: 'offered',
    })

  const published: SignedEvent[] = []
  /** Whether the agent's pending setup was already stored when its profile was published. */
  const storedAtPublish: boolean[] = []
  /** Each publishAsAgent call: its relay and owner proof, and the secret it was given. */
  const agentPublishes: {
    relay: string
    auth: NipOaTag
    secret: Uint8Array
    secretWasSet: boolean
    signal: AbortSignal | undefined
  }[] = []
  const blocks: { to: string; block: Block }[] = []
  const authCalls: string[] = []
  const relay: Relay = {
    ready: async () => ({ origin: ORIGIN, viewer, community: COMMUNITY }),
    readOwnRecords: async () => ({ ok: true, records: new Map() }),
    readProfile: async (pubkey) => {
      if (options.readError) throw options.readError
      return published.find((event) => event.pubkey === pubkey)
    },
    publishRecord: async () => {},
    sendBlock: async (to, block) => {
      if (options.sendError) throw options.sendError
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
    publishAsAgent: async ({ relay: url, secret, auth, event, signal: given }) => {
      agentPublishes.push({
        relay: url,
        auth,
        secret,
        secretWasSet: secret.some((byte) => byte !== 0),
        signal: given,
      })
      storedAtPublish.push(store.pending().some((p) => p.pubkey === event.pubkey))
      if (options.publishError) throw options.publishError
      published.push(event)
    },
  }
  return {
    provider: createProvider(deps),
    deps,
    store,
    storage,
    viewer,
    operatorHex,
    published,
    storedAtPublish,
    agentPublishes,
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

  test('publishes as the agent on the community relay, then zeroes the secret', async () => {
    const { provider, agentPublishes, viewer } = setup()
    const input = provisionInput()
    await provider.provision(input)
    expect(agentPublishes).toHaveLength(1)
    const call = agentPublishes[0]
    expect(call?.relay).toBe(COMMUNITY)
    expect(call?.auth[1]).toBe(viewer)
    expect(call?.signal).toBe(input.signal)
    expect(call?.secretWasSet).toBe(true)
    expect(call?.secret.every((byte) => byte === 0)).toBe(true)
  })

  test('zeroes the secret when publishing fails', async () => {
    const { provider, agentPublishes } = setup({ publishError: new Error('relay refused') })
    await expect(provider.provision(provisionInput())).rejects.toThrow('relay refused')
    expect(agentPublishes[0]?.secretWasSet).toBe(true)
    expect(agentPublishes[0]?.secret.every((byte) => byte === 0)).toBe(true)
  })

  test('stores the sealed setup before publishing the profile', async () => {
    const { provider, storedAtPublish } = setup()
    await provider.provision(provisionInput())
    expect(storedAtPublish).toEqual([true])
  })

  test('retry with the same slot returns the published agent without a new key', async () => {
    const { provider, published, authCalls, agentPublishes } = setup()
    const first = await provider.provision(provisionInput())
    const second = await provider.provision(
      provisionInput({ picture: 'https://example.com/b.png' }),
    )

    expect(second).toEqual(first)
    expect(authCalls).toHaveLength(1)
    expect(agentPublishes).toHaveLength(1)
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

  test('keeps the sealed setup when publishing fails', async () => {
    const { provider, store, published } = setup({ publishError: new Error('relay refused') })
    await expect(provider.provision(provisionInput())).rejects.toThrow('relay refused')
    const pending = store.pendingFor('vps-1')
    expect(pending?.sealed.startsWith('-----BEGIN AGE ENCRYPTED FILE-----')).toBe(true)
    expect(published).toHaveLength(0)
  })

  test('a retry of an unsent setup whose profile is absent starts over with a new key', async () => {
    const options: Options = { publishError: new Error('relay refused') }
    const { provider, store, published, authCalls, agentPublishes } = setup(options)
    await expect(provider.provision(provisionInput())).rejects.toThrow('relay refused')
    const old = store.pendingFor('vps-1')
    if (old === undefined) throw new Error('missing pending setup')

    delete options.publishError
    const result = await provider.provision(provisionInput())
    expect(result.pubkey).not.toBe(old.pubkey)
    expect(authCalls).toEqual([old.pubkey, result.pubkey])
    expect(agentPublishes).toHaveLength(2)
    expect(published.map((event) => event.pubkey)).toEqual([result.pubkey])
    expect(store.pending().map((p) => p.pubkey)).toEqual([result.pubkey])
  })

  test('a retry of an unsent setup whose relay profile does not verify starts over', async () => {
    const options: Options = { publishError: new Error('relay refused') }
    const { provider, store, published } = setup(options)
    await expect(provider.provision(provisionInput())).rejects.toThrow('relay refused')
    const old = store.pendingFor('vps-1')
    if (old === undefined) throw new Error('missing pending setup')
    published.push({ ...old.profile, content: '{"name":"Forged"}' })

    delete options.publishError
    const result = await provider.provision(provisionInput())
    expect(result.pubkey).not.toBe(old.pubkey)
    expect(store.pending().map((p) => p.pubkey)).toEqual([result.pubkey])
  })

  test('a retry of a sent setup whose profile is absent throws without a new key', async () => {
    const options: Options = { publishError: new Error('relay refused') }
    const { provider, store, authCalls, agentPublishes } = setup(options)
    await expect(provider.provision(provisionInput())).rejects.toThrow('relay refused')
    const pending = store.pendingFor('vps-1')
    if (pending === undefined) throw new Error('missing pending setup')
    store.setStatus(pending.pubkey, 'awaiting-install')

    delete options.publishError
    await expect(provider.provision(provisionInput())).rejects.toThrow(
      'The agent profile could not be published; remove this unfinished agent and try again',
    )
    expect(authCalls).toHaveLength(1)
    expect(agentPublishes).toHaveLength(1)
    expect(store.pendingFor('vps-1')).toEqual(pending)
  })

  test('a retry whose profile read fails throws and keeps the pending setup', async () => {
    const options: Options = { publishError: new Error('relay refused') }
    const { provider, store, authCalls } = setup(options)
    await expect(provider.provision(provisionInput())).rejects.toThrow('relay refused')
    const pending = store.pendingFor('vps-1')

    delete options.publishError
    options.readError = new Error('Not connected to a community yet')
    await expect(provider.provision(provisionInput())).rejects.toThrow(
      'Not connected to a community yet',
    )
    expect(authCalls).toHaveLength(1)
    expect(store.pendingFor('vps-1')).toEqual(pending)
  })

  test('a retry after a failed publish succeeds when the profile reached the relay', async () => {
    const options: Options = { publishError: new Error('no answer in time') }
    const { provider, store, published, authCalls, agentPublishes } = setup(options)
    await expect(provider.provision(provisionInput())).rejects.toThrow('no answer in time')
    const pending = store.pendingFor('vps-1')
    if (pending === undefined) throw new Error('missing pending setup')
    published.push(pending.profile) // The relay stored it after all.

    const result = await provider.provision(provisionInput())
    expect(result.pubkey).toBe(pending.pubkey)
    expect(authCalls).toHaveLength(1)
    expect(agentPublishes).toHaveLength(1)
  })

  test('publishes nothing when the setup cannot be stored', async () => {
    const { provider, storage, published } = setup()
    const setItem = storage.setItem.bind(storage)
    storage.setItem = (key, value) => {
      if (key.endsWith(':pending')) throw new Error('quota exceeded')
      setItem(key, value)
    }
    await expect(provider.provision(provisionInput())).rejects.toThrow('quota exceeded')
    expect(published).toHaveLength(0)
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

  test('when the viewer is the operator, the request is listed locally without a DM', async () => {
    const { provider, store, blocks } = setup({ operatorIsViewer: true })
    const { pubkey } = await provider.provision(provisionInput())
    const auth = signNipOaForTests(generateSecretKey(), pubkey)
    await provider.activate({
      pubkey,
      name: 'Helper',
      community: COMMUNITY,
      auth,
      signal: signal(),
    })
    expect(blocks).toHaveLength(0)
    expect(store.requests()).toMatchObject([{ type: 'install-request', slot: 'vps-1', pubkey }])
    expect(store.slots()[0]?.state).toBe('requested')
    expect(store.statusOf(pubkey)).toBe('awaiting-install')
  })

  test('when the viewer is the operator, the agent profile must be visible and name self', async () => {
    const { provider, store, blocks, published } = setup({ operatorIsViewer: true })
    const { pubkey } = await provider.provision(provisionInput())
    published.length = 0
    const auth = signNipOaForTests(generateSecretKey(), pubkey)
    const input = { pubkey, name: 'Helper', community: COMMUNITY, auth, signal: signal() }
    await expect(provider.activate(input)).rejects.toThrow('agent profile missing or unverified')
    expect(blocks).toHaveLength(0)
    expect(store.requests()).toEqual([])
    expect(store.statusOf(pubkey)).toBeUndefined()
  })

  test('when the viewer is the operator, the local request passes the same gates', async () => {
    const { provider, store, blocks } = setup({ operatorIsViewer: true })
    const { pubkey } = await provider.provision(provisionInput())
    const slot = store.slots()[0]
    if (slot === undefined) throw new Error('missing slot')
    store.putSlot({ ...slot, state: 'installed' })
    const auth = signNipOaForTests(generateSecretKey(), pubkey)
    await expect(
      provider.activate({ pubkey, name: 'Helper', community: COMMUNITY, auth, signal: signal() }),
    ).rejects.toThrow('not a server offered to this owner')
    expect(blocks).toHaveLength(0)
    expect(store.requests()).toEqual([])
    expect(store.statusOf(pubkey)).toBeUndefined()
  })

  test('refuses an agent that is being retired or was retired', async () => {
    const { provider, store, blocks } = setup()
    const { pubkey } = await provider.provision(provisionInput())
    const auth = signNipOaForTests(generateSecretKey(), pubkey)
    const input = { pubkey, name: 'Helper', community: COMMUNITY, auth, signal: signal() }
    for (const status of ['retire-requested', 'retired'] as const) {
      store.setStatus(pubkey, status)
      await expect(provider.activate(input)).rejects.toThrow(
        'This agent is retired or being retired; it cannot be installed again',
      )
      expect(store.statusOf(pubkey)).toBe(status)
    }
    expect(blocks).toHaveLength(0)
  })

  test("refuses when the agent's community is not the selected one", async () => {
    const { provider, store, blocks } = setup()
    const { pubkey } = await provider.provision(provisionInput())
    const auth = signNipOaForTests(generateSecretKey(), pubkey)
    await expect(
      provider.activate({
        pubkey,
        name: 'Helper',
        community: OTHER_COMMUNITY,
        auth,
        signal: signal(),
      }),
    ).rejects.toThrow("Switch to this agent's community in Buzz, then try again")
    expect(blocks).toHaveLength(0)
    expect(store.statusOf(pubkey)).toBeUndefined()
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

  test('an agent without a setup on this device must be retired first', async () => {
    const { provider, store } = setup()
    const adopted = publicKeyHex(generateSecretKey())
    const input = { pubkey: adopted, community: COMMUNITY, signal: signal() }
    await expect(provider.remove(input)).rejects.toThrow(
      'Retire this agent first, then delete it again',
    )
    store.markRetired(adopted)
    await expect(provider.remove(input)).resolves.toBeUndefined()
  })

  test('a setup whose install-request send failed or is unconfirmed must be retired', async () => {
    for (const error of ['The message was not sent. Retry.', 'Delivery unknown']) {
      const { provider, store } = setup({ sendError: new Error(error) })
      const { pubkey } = await provider.provision(provisionInput())
      const auth = signNipOaForTests(generateSecretKey(), pubkey)
      await expect(
        provider.activate({ pubkey, name: 'Helper', community: COMMUNITY, auth, signal: signal() }),
      ).rejects.toThrow(error)

      await expect(
        provider.remove({ pubkey, community: COMMUNITY, signal: signal() }),
      ).rejects.toThrow('Retire this agent first, then delete it again')
      expect(store.pendingFor('vps-1')?.pubkey).toBe(pubkey)
    }
  })

  test("refuses when the agent's community is not the selected one", async () => {
    const { provider, store } = setup()
    const { pubkey } = await provider.provision(provisionInput())
    await expect(
      provider.remove({ pubkey, community: OTHER_COMMUNITY, signal: signal() }),
    ).rejects.toThrow("Switch to this agent's community in Buzz, then try again")
    expect(store.pendingFor('vps-1')?.pubkey).toBe(pubkey)
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
