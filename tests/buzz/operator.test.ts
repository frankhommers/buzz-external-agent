import { describe, expect, spyOn, test } from 'bun:test'
import {
  applyOwnerBlocks,
  buildOperatorView,
  confirm,
  createOperator,
  handoff,
  importSlots,
  offerSlot,
} from '../../src/buzz/operator'
import type { BlockMessage, Relay } from '../../src/buzz/relay'
import { buildAgentProfile, type SignedEvent } from '../../src/core/events'
import { encodeNpub, publicKeyHex } from '../../src/core/keys'
import type { Block, InstallRequest, RetireRequest } from '../../src/core/messages'
import { parseHostKey } from '../../src/core/seal'
import {
  createStore,
  type OperatorRetireRequest,
  type OperatorSlot,
  type Store,
} from '../../src/core/store'
import { hostKeyLine } from '../helpers/host-key'
import { MemoryStorage } from '../helpers/memory-storage'
import { signNipOaForTests } from '../helpers/nipoa'

const ORIGIN = 'https://relay.example.com'
const COMMUNITY = 'wss://relay.example.com'
const secretOf = (byte: number): Uint8Array => new Uint8Array(32).fill(byte)
const operator = publicKeyHex(secretOf(1))
const ownerSecret = secretOf(2)
const owner = publicKeyHex(ownerSecret)
const strangerSecret = secretOf(3)
const stranger = publicKeyHex(strangerSecret)
const agentSecret = secretOf(4)
const agent = publicKeyHex(agentSecret)
const otherAgent = publicKeyHex(secretOf(5))
const SEALED = '-----BEGIN AGE ENCRYPTED FILE-----\nYWdl\n-----END AGE ENCRYPTED FILE-----'
const RSA_KEY = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC7 host'

const newStore = (): Store => createStore(new MemoryStorage(), { origin: ORIGIN, viewer: operator })

const slot = (id: string, overrides: Partial<OperatorSlot> = {}): OperatorSlot => ({
  slot: id,
  label: `Server ${id}`,
  host: parseHostKey(hostKeyLine(7)),
  owner,
  state: 'offered',
  ...overrides,
})

const openSlot = (id: string): OperatorSlot => ({
  slot: id,
  label: `Server ${id}`,
  host: parseHostKey(hostKeyLine(7)),
  state: 'open',
})

const installRequest = (
  overrides: Partial<InstallRequest> = {},
  signer: Uint8Array = ownerSecret,
): InstallRequest => {
  const pubkey = overrides.pubkey ?? agent
  return {
    v: 1,
    type: 'install-request',
    slot: 'vps-1',
    pubkey,
    name: 'Robo',
    auth: signNipOaForTests(signer, pubkey),
    sealed: SEALED,
    ...overrides,
  }
}

const retireRequest = (pubkey = agent, slotId = 'vps-1'): RetireRequest => ({
  v: 1,
  type: 'retire-request',
  slot: slotId,
  pubkey,
})

const from = (sender: string, block: Block): BlockMessage => ({ sender, block })
const noProfile = async (): Promise<SignedEvent | undefined> => undefined
const context = { operator, viewer: operator, owner, readProfile: noProfile }

const agentProfile = (signer: Uint8Array = ownerSecret, auth = true): SignedEvent =>
  buildAgentProfile({
    secret: agentSecret,
    name: 'Old agent',
    auth: auth ? signNipOaForTests(signer, agent) : (['auth', owner, '', '0'.repeat(128)] as const),
    createdAt: 1,
  })

const storedRetire = (pubkey = agent, slotId = 'vps-1', from = owner): OperatorRetireRequest => ({
  ...retireRequest(pubkey, slotId),
  owner: from,
})

interface FakeOptions {
  sendError?: Error
  readError?: Error
  messages?: Record<string, BlockMessage[]>
  viewer?: string
  profiles?: Record<string, SignedEvent>
}

const fakeRelay = (options: FakeOptions = {}) => {
  const sent: { to: string; block: Block }[] = []
  const readsFrom: string[] = []
  const relay: Relay = {
    ready: async () => ({
      origin: ORIGIN,
      viewer: options.viewer ?? operator,
      community: COMMUNITY,
    }),
    readOwnRecords: async () => ({ ok: true, records: new Map() }),
    readProfile: async (pubkey) => options.profiles?.[pubkey],
    publishRecord: async () => {},
    publishSigned: async () => {},
    sendBlock: async (to, block) => {
      if (options.sendError) throw options.sendError
      sent.push({ to, block })
    },
    readBlocks: async (withPubkey) => {
      readsFrom.push(withPubkey)
      if (options.readError) throw options.readError
      return options.messages?.[withPubkey] ?? []
    },
    isLocalIdentity: () => false,
  }
  return { relay, sent, readsFrom }
}

describe('handoff', () => {
  test('names the file after the slot and lists the public data exactly', () => {
    const request = installRequest()
    const result = handoff(request, slot('vps-1'))
    expect(result.filename).toBe('vps-1.age')
    expect(result.fileText).toBe(SEALED)
    expect(result.publicJson).toBe(
      JSON.stringify(
        { name: 'Robo', host: 'Server vps-1', pubkey: agent, auth_tag: request.auth },
        null,
        2,
      ),
    )
    expect(result).not.toHaveProperty('command')
  })

  test('renders the command with every value shell-quoted when a template is set', () => {
    const request = installRequest()
    const result = handoff(
      request,
      slot('vps-1'),
      'deploy -e name={name} -e slot={slot} -e host={host} {pubkey} {npub} {auth_tag} {file}',
    )
    expect(result.command).toBe(
      [
        "deploy -e name='Robo' -e slot='vps-1' -e host='Server vps-1'",
        `'${agent}'`,
        `'${encodeNpub(agent)}'`,
        `'${JSON.stringify(request.auth)}'`,
        "'vps-1.age'",
      ].join(' '),
    )
  })

  test('a blank template yields no command', () => {
    expect(handoff(installRequest(), slot('vps-1'), '  ')).not.toHaveProperty('command')
  })
})

describe('offerSlot', () => {
  test('stores the slot as offered and sends a slot-offer to the owner', async () => {
    const store = newStore()
    const { relay, sent } = fakeRelay()
    await offerSlot(relay, store, {
      slot: 'vps-1',
      label: 'My VPS',
      hostKeyText: `${hostKeyLine(7)} root@vps-1`,
      owner: encodeNpub(owner),
    })
    const host = parseHostKey(hostKeyLine(7))
    expect(store.slots()).toEqual([
      { slot: 'vps-1', label: 'My VPS', host, owner, state: 'offered' },
    ])
    expect(sent).toEqual([
      {
        to: owner,
        block: {
          v: 1,
          type: 'slot-offer',
          slot: 'vps-1',
          label: 'My VPS',
          hostKey: host.line,
          community: COMMUNITY,
        },
      },
    ])
  })

  test('the slot id adopted is reserved', async () => {
    const { relay } = fakeRelay()
    await expect(
      offerSlot(relay, newStore(), {
        slot: 'adopted',
        label: 'X',
        hostKeyText: hostKeyLine(7),
        owner: encodeNpub(owner),
      }),
    ).rejects.toThrow('The slot id "adopted" is reserved')
    expect(() =>
      importSlots(JSON.stringify([{ slot: 'adopted', label: 'X', hostKey: hostKeyLine(7) }])),
    ).toThrow(/reserved/)
  })

  test('rejects host keys that are not ssh-ed25519', async () => {
    const store = newStore()
    const { relay, sent } = fakeRelay()
    await expect(
      offerSlot(relay, store, {
        slot: 'vps-1',
        label: 'My VPS',
        hostKeyText: RSA_KEY,
        owner: encodeNpub(owner),
      }),
    ).rejects.toThrow('Only ssh-ed25519 host keys are supported')
    expect(store.slots()).toEqual([])
    expect(sent).toEqual([])
  })

  test('rejects a bad owner, a bad slot id and a slot that was already offered', async () => {
    const store = newStore()
    store.putSlot(slot('vps-2'))
    const { relay, sent } = fakeRelay()
    const input = { slot: 'vps-1', label: 'My VPS', hostKeyText: hostKeyLine(7) }
    await expect(offerSlot(relay, store, { ...input, owner })).rejects.toThrow(/npub/)
    await expect(
      offerSlot(relay, store, { ...input, slot: 'Bad Slot', owner: encodeNpub(owner) }),
    ).rejects.toThrow(/slot id/i)
    await expect(
      offerSlot(relay, store, { ...input, slot: 'vps-2', owner: encodeNpub(owner) }),
    ).rejects.toThrow(/already offered/)
    expect(sent).toEqual([])
  })

  test('offers an imported open slot; a failed send leaves it open', async () => {
    const store = newStore()
    store.putSlot(openSlot('vps-1'))
    const failing = fakeRelay({ sendError: new Error('not sent') })
    const input = {
      slot: 'vps-1',
      label: 'Server vps-1',
      hostKeyText: hostKeyLine(7),
      owner: encodeNpub(owner),
    }
    await expect(offerSlot(failing.relay, store, input)).rejects.toThrow('not sent')
    expect(store.slots()[0]?.state).toBe('open')
    const working = fakeRelay()
    await offerSlot(working.relay, store, input)
    expect(store.slots()[0]).toMatchObject({ state: 'offered', owner })
  })
})

describe('importSlots', () => {
  const item = (id: string, hostKey = hostKeyLine(7)) => ({ slot: id, label: `L ${id}`, hostKey })

  test('parses a JSON list into open slots without saving', () => {
    const slots = importSlots(JSON.stringify([item('vps-1'), item('vps-2', hostKeyLine(8))]))
    expect(slots).toEqual([
      { slot: 'vps-1', label: 'L vps-1', host: parseHostKey(hostKeyLine(7)), state: 'open' },
      { slot: 'vps-2', label: 'L vps-2', host: parseHostKey(hostKeyLine(8)), state: 'open' },
    ])
  })

  test('rejects duplicate slot ids within the input', () => {
    expect(() => importSlots(JSON.stringify([item('vps-1'), item('vps-1')]))).toThrow(
      'Duplicate slot id "vps-1"',
    )
  })

  test('rejects slot ids that already exist', () => {
    expect(() => importSlots(JSON.stringify([item('vps-1')]), [slot('vps-1')])).toThrow(
      'Slot "vps-1" already exists',
    )
  })

  test('rejects invalid host keys, naming the slot', () => {
    expect(() => importSlots(JSON.stringify([item('vps-1', RSA_KEY)]))).toThrow(
      'Slot "vps-1": Only ssh-ed25519 host keys are supported',
    )
  })

  test('rejects anything but a list of {slot, label, hostKey}', () => {
    expect(() => importSlots('not json')).toThrow(/JSON list/)
    expect(() => importSlots('{}')).toThrow(/JSON list/)
    expect(() => importSlots(JSON.stringify([{ slot: 'vps-1' }]))).toThrow(/Item 1/)
    expect(() => importSlots(JSON.stringify([item('Bad Slot')]))).toThrow(/slot id/i)
  })
})

describe('confirm', () => {
  test('installed: sends installed to the slot owner and marks the slot installed', async () => {
    const store = newStore()
    store.putSlot(slot('vps-1', { state: 'requested' }))
    store.addRequest(installRequest())
    const { relay, sent } = fakeRelay()
    await confirm(relay, store, 'installed', agent)
    expect(sent).toEqual([
      { to: owner, block: { v: 1, type: 'installed', slot: 'vps-1', pubkey: agent } },
    ])
    expect(store.slots()[0]?.state).toBe('installed')
  })

  test('retired: sends retired to the slot owner and marks the slot retired', async () => {
    const store = newStore()
    store.putSlot(slot('vps-1', { state: 'installed' }))
    store.addRequest(installRequest())
    store.addRetireRequest(storedRetire())
    const { relay, sent } = fakeRelay()
    await confirm(relay, store, 'retired', agent)
    expect(sent).toEqual([
      { to: owner, block: { v: 1, type: 'retired', slot: 'vps-1', pubkey: agent } },
    ])
    expect(store.slots()[0]?.state).toBe('retired')
  })

  test('retired for an adopted agent goes to the stored sender and closes the request', async () => {
    const store = newStore()
    store.addRetireRequest(storedRetire(agent, 'adopted', stranger))
    const { relay, sent } = fakeRelay()
    await confirm(relay, store, 'retired', agent)
    expect(sent).toEqual([
      { to: stranger, block: { v: 1, type: 'retired', slot: 'adopted', pubkey: agent } },
    ])
    expect(store.slots()).toEqual([])
    expect(buildOperatorView(store).adopted).toEqual([])
    await expect(confirm(relay, store, 'retired', agent)).rejects.toThrow()
    expect(sent).toHaveLength(1)
  })

  test('a failed retired send for an adopted agent keeps the request open', async () => {
    const store = newStore()
    store.addRetireRequest(storedRetire(agent, 'adopted'))
    const { relay } = fakeRelay({ sendError: new Error('not sent') })
    await expect(confirm(relay, store, 'retired', agent)).rejects.toThrow('not sent')
    expect(buildOperatorView(store).adopted.map((a) => a.pubkey)).toEqual([agent])
  })

  test('a failed send leaves the slot state unchanged', async () => {
    const store = newStore()
    store.putSlot(slot('vps-1', { state: 'requested' }))
    store.addRequest(installRequest())
    const { relay } = fakeRelay({ sendError: new Error('not sent') })
    await expect(confirm(relay, store, 'installed', agent)).rejects.toThrow('not sent')
    expect(store.slots()[0]?.state).toBe('requested')
  })

  test('refuses unknown agents and slots in the wrong state', async () => {
    const store = newStore()
    store.putSlot(slot('vps-1', { state: 'installed' }))
    store.addRequest(installRequest())
    const { relay, sent } = fakeRelay()
    await expect(confirm(relay, store, 'installed', otherAgent)).rejects.toThrow()
    await expect(confirm(relay, store, 'installed', agent)).rejects.toThrow()
    await expect(confirm(relay, store, 'retired', agent)).rejects.toThrow()
    expect(sent).toEqual([])
  })
})

describe('applyOwnerBlocks', () => {
  test('lists a verified install-request and marks the slot requested', async () => {
    const store = newStore()
    store.putSlot(slot('vps-1'))
    const request = installRequest()
    const rejected = await applyOwnerBlocks(store, [from(owner, request)], context)
    expect(rejected).toEqual([])
    expect(store.requests()).toEqual([request])
    expect(store.slots()[0]?.state).toBe('requested')
  })

  test('rejects an install-request whose owner proof does not verify', async () => {
    const store = newStore()
    store.putSlot(slot('vps-1'))
    const forged = installRequest({ auth: signNipOaForTests(ownerSecret, otherAgent) })
    const rejected = await applyOwnerBlocks(store, [from(owner, forged)], context)
    expect(rejected).toEqual([
      {
        type: 'install-request',
        slot: 'vps-1',
        pubkey: agent,
        reason: 'owner proof does not verify',
      },
    ])
    expect(store.requests()).toEqual([])
    expect(store.slots()[0]?.state).toBe('offered')
  })

  test('rejects an install-request whose proof names someone other than the sender', async () => {
    const store = newStore()
    store.putSlot(slot('vps-1'))
    const relayed = installRequest({}, strangerSecret)
    const rejected = await applyOwnerBlocks(store, [from(owner, relayed)], context)
    expect(rejected.map((r) => r.reason)).toEqual(['owner proof names someone else'])
    expect(store.requests()).toEqual([])
  })

  test('rejects an install-request from someone other than the DM owner', async () => {
    const store = newStore()
    store.putSlot(slot('vps-1', { owner: stranger }))
    const rejected = await applyOwnerBlocks(
      store,
      [from(stranger, installRequest({}, strangerSecret))],
      context,
    )
    expect(rejected.map((r) => r.reason)).toEqual(['not sent by this owner'])
    expect(store.requests()).toEqual([])
  })

  test('rejects an install-request for a slot not offered to that owner', async () => {
    const store = newStore()
    store.putSlot(slot('vps-1', { owner: stranger }))
    store.putSlot(openSlot('vps-2'))
    const rejected = await applyOwnerBlocks(
      store,
      [
        from(owner, installRequest()),
        from(owner, installRequest({ slot: 'vps-2' })),
        from(owner, installRequest({ slot: 'vps-9' })),
      ],
      context,
    )
    expect(rejected.map((r) => r.reason)).toEqual([
      'not a server offered to this owner',
      'not a server offered to this owner',
      'not a server offered to this owner',
    ])
    expect(store.requests()).toEqual([])
  })

  test('rejects an install-request for a slot already installed or retired', async () => {
    for (const state of ['installed', 'retired'] as const) {
      const store = newStore()
      store.putSlot(slot('vps-1', { state }))
      const rejected = await applyOwnerBlocks(store, [from(owner, installRequest())], context)
      expect(rejected.map((r) => r.reason)).toEqual(['not a server offered to this owner'])
      expect(store.requests()).toEqual([])
      expect(store.slots()[0]?.state).toBe(state)
    }
  })

  test('a request already listed is not re-applied after the slot moved on', async () => {
    const store = newStore()
    store.putSlot(slot('vps-1', { state: 'installed' }))
    store.addRequest(installRequest())
    store.addRetireRequest(storedRetire())
    const rejected = await applyOwnerBlocks(
      store,
      [from(owner, installRequest()), from(owner, retireRequest())],
      context,
    )
    expect(rejected).toEqual([])
    expect(store.slots()[0]?.state).toBe('installed')
  })

  test('lists a retire-request for an agent installed on a slot of that owner', async () => {
    const store = newStore()
    store.putSlot(slot('vps-1', { state: 'installed' }))
    store.addRequest(installRequest())
    const rejected = await applyOwnerBlocks(store, [from(owner, retireRequest())], context)
    expect(rejected).toEqual([])
    expect(store.retireRequests()).toEqual([storedRetire()])
  })

  test('rejects retire-requests for unknown agents and slots of other owners', async () => {
    const store = newStore()
    store.putSlot(slot('vps-1', { state: 'installed' }))
    store.putSlot(slot('vps-2', { state: 'installed', owner: stranger }))
    store.addRequest(installRequest())
    const rejected = await applyOwnerBlocks(
      store,
      [from(owner, retireRequest(otherAgent)), from(owner, retireRequest(agent, 'vps-2'))],
      context,
    )
    expect(rejected.map((r) => r.reason)).toEqual([
      'not an agent requested on this server',
      'not a server offered to this owner',
    ])
    expect(store.retireRequests()).toEqual([])
  })

  test('ignores operator-bound blocks the operator sent itself and owner-bound blocks', async () => {
    const store = newStore()
    store.putSlot(slot('vps-1'))
    const rejected = await applyOwnerBlocks(
      store,
      [
        from(operator, installRequest()),
        from(owner, { v: 1, type: 'installed', slot: 'vps-1', pubkey: agent }),
      ],
      context,
    )
    expect(rejected).toEqual([])
    expect(store.requests()).toEqual([])
  })
})

describe('applyOwnerBlocks: adopted agents and re-set-up slots', () => {
  const adoptedRetire = retireRequest(agent, 'adopted')
  const withProfile = (profile: SignedEvent | undefined) => ({
    ...context,
    readProfile: async (pubkey: string) => (pubkey === agent ? profile : undefined),
  })

  test("an adopted agent's retire-request from its profile owner is listed", async () => {
    const store = newStore()
    const rejected = await applyOwnerBlocks(
      store,
      [from(owner, adoptedRetire)],
      withProfile(agentProfile()),
    )
    expect(rejected).toEqual([])
    expect(store.retireRequests()).toEqual([{ ...adoptedRetire, owner, name: 'Old agent' }])
  })

  test('an adopted retire-request from someone other than the profile owner is ignored', async () => {
    const store = newStore()
    const rejected = await applyOwnerBlocks(
      store,
      [from(owner, adoptedRetire)],
      withProfile(agentProfile(strangerSecret)),
    )
    expect(rejected.map((r) => r.reason)).toEqual(['agent is owned by someone else'])
    expect(store.retireRequests()).toEqual([])
  })

  test('an adopted retire-request without a verifiable profile is ignored', async () => {
    for (const profile of [undefined, agentProfile(ownerSecret, false)]) {
      const store = newStore()
      const rejected = await applyOwnerBlocks(
        store,
        [from(owner, adoptedRetire)],
        withProfile(profile),
      )
      expect(rejected.map((r) => r.reason)).toEqual(['agent profile missing or unverified'])
      expect(store.retireRequests()).toEqual([])
    }
  })

  test('a newer install-request for a requested slot replaces the older one', async () => {
    const store = newStore()
    store.putSlot(slot('vps-1'))
    const older = installRequest()
    const newer = installRequest({ pubkey: otherAgent })
    const batch = [from(owner, older), from(owner, newer)]
    expect(await applyOwnerBlocks(store, batch, context)).toEqual([])
    expect(store.requests()).toEqual([newer])
    expect(store.slots()[0]?.state).toBe('requested')
    expect(await applyOwnerBlocks(store, batch, context)).toEqual([])
    expect(store.requests()).toEqual([newer])
  })

  test('a stored request is replaced when a newer one for its slot arrives', async () => {
    const store = newStore()
    store.putSlot(slot('vps-1', { state: 'requested' }))
    store.addRequest(installRequest())
    const newer = installRequest({ pubkey: otherAgent })
    expect(await applyOwnerBlocks(store, [from(owner, newer)], context)).toEqual([])
    expect(store.requests()).toEqual([newer])
  })

  test('an install-request for an installed slot does not replace the installed agent', async () => {
    const store = newStore()
    store.putSlot(slot('vps-1', { state: 'installed' }))
    const installedRequest = installRequest()
    store.addRequest(installedRequest)
    const rejected = await applyOwnerBlocks(
      store,
      [from(owner, installRequest({ pubkey: otherAgent }))],
      context,
    )
    expect(rejected.map((r) => r.reason)).toEqual(['not a server offered to this owner'])
    expect(store.requests()).toEqual([installedRequest])
  })
})

describe('buildOperatorView', () => {
  test('shows slots, open install requests with their handoff, and open retire requests', () => {
    const store = newStore()
    store.setSettings({ operator: encodeNpub(operator), template: 'deploy {slot}' })
    store.putSlot(slot('vps-1', { state: 'requested' }))
    store.putSlot(slot('vps-2', { state: 'installed' }))
    store.putSlot(openSlot('vps-3'))
    store.addRequest(installRequest())
    store.addRequest(installRequest({ slot: 'vps-2', pubkey: otherAgent }))
    store.addRetireRequest(storedRetire(otherAgent, 'vps-2'))
    const view = buildOperatorView(store)
    expect(view.template).toBe('deploy {slot}')
    expect(view.slots.map((s) => [s.slot, s.state, s.owner])).toEqual([
      ['vps-1', 'requested', encodeNpub(owner)],
      ['vps-2', 'installed', encodeNpub(owner)],
      ['vps-3', 'open', ''],
    ])
    expect(view.installs).toHaveLength(1)
    expect(view.installs[0]).toMatchObject({
      pubkey: agent,
      name: 'Robo',
      slot: 'vps-1',
      handoff: { filename: 'vps-1.age', command: "deploy 'vps-1'" },
    })
    expect(view.retires).toEqual([
      { pubkey: otherAgent, slot: 'vps-2', label: 'Server vps-2', owner: encodeNpub(owner) },
    ])
  })

  test('lists adopted retire requests separately until retired, and the known owners', () => {
    const store = newStore()
    store.setSettings({ owners: [owner, stranger] })
    store.addRetireRequest({ ...retireRequest(agent, 'adopted'), owner, name: 'Old agent' })
    store.addRetireRequest({ ...retireRequest(otherAgent, 'adopted'), owner: stranger })
    const view = buildOperatorView(store)
    expect(view.owners).toEqual([encodeNpub(owner), encodeNpub(stranger)])
    expect(view.retires).toEqual([])
    expect(view.adopted).toEqual([
      { pubkey: agent, name: 'Old agent', owner: encodeNpub(owner) },
      { pubkey: otherAgent, name: encodeNpub(otherAgent), owner: encodeNpub(stranger) },
    ])
    store.addRetireRequest({
      ...retireRequest(agent, 'adopted'),
      owner,
      name: 'Old agent',
      retired: true,
    })
    expect(buildOperatorView(store).adopted.map((a) => a.pubkey)).toEqual([otherAgent])
  })

  test('a template with an unknown placeholder shows an error instead of a command', () => {
    const store = newStore()
    store.setSettings({ template: 'deploy {nope}' })
    store.putSlot(slot('vps-1', { state: 'requested' }))
    store.addRequest(installRequest())
    expect(buildOperatorView(store).installs[0]).toMatchObject({
      commandError: 'Unknown placeholder {nope}',
    })
  })
})

describe('createOperator', () => {
  const setup = (options: FakeOptions = {}) => {
    const storage = new MemoryStorage()
    const store = createStore(storage, { origin: ORIGIN, viewer: options.viewer ?? operator })
    const fake = fakeRelay(options)
    const op = createOperator({
      relay: fake.relay,
      storeFor: (scope) => createStore(storage, scope),
    })
    return { op, store, ...fake }
  }

  test('view is undefined unless the viewer is the configured operator', async () => {
    const notSet = setup()
    expect(await notSet.op.view()).toBeUndefined()
    const other = setup({ viewer: owner })
    other.store.setSettings({ operator: encodeNpub(operator) })
    expect(await other.op.view()).toBeUndefined()
    const self = setup()
    self.store.setSettings({ operator: encodeNpub(operator) })
    expect(await self.op.view()).toMatchObject({ slots: [], installs: [], retires: [] })
  })

  test('poll reads the DM with each owner of an active slot and applies requests', async () => {
    const fake = setup({ messages: { [owner]: [from(owner, installRequest())] } })
    fake.store.setSettings({ operator: encodeNpub(operator) })
    fake.store.putSlot(slot('vps-1'))
    fake.store.putSlot(slot('vps-2', { state: 'retired', owner: stranger }))
    fake.store.putSlot(openSlot('vps-3'))
    let notified = 0
    fake.op.subscribe(() => notified++)
    await fake.op.poll()
    expect(fake.readsFrom).toEqual([owner])
    expect(fake.store.requests().map((r) => r.pubkey)).toEqual([agent])
    expect(notified).toBe(1)
  })

  test('poll also reads known owners without slots, and lists their adopted retires', async () => {
    const fake = setup({
      messages: { [stranger]: [from(stranger, retireRequest(agent, 'adopted'))] },
      profiles: { [agent]: agentProfile(strangerSecret) },
    })
    fake.store.setSettings({ operator: encodeNpub(operator), owners: [owner, stranger] })
    fake.store.putSlot(slot('vps-1'))
    await fake.op.poll()
    expect(fake.readsFrom).toEqual([owner, stranger])
    expect(fake.store.retireRequests()).toEqual([
      { ...retireRequest(agent, 'adopted'), owner: stranger, name: 'Old agent' },
    ])
  })

  test('saveOwners stores npubs as hex and rejects anything else', async () => {
    const fake = setup()
    fake.store.setSettings({ operator: encodeNpub(operator) })
    await expect(fake.op.saveOwners(`${encodeNpub(owner)}\nnpub1nope`)).rejects.toThrow(
      'Not an npub: npub1nope',
    )
    expect(fake.store.settings().owners).toBeUndefined()
    await fake.op.saveOwners(
      ` ${encodeNpub(owner)}\n\n${encodeNpub(stranger)}, ${encodeNpub(owner)}`,
    )
    expect(fake.store.settings()).toEqual({
      operator: encodeNpub(operator),
      owners: [owner, stranger],
    })
  })

  test('poll does nothing for a viewer that is not the operator', async () => {
    const fake = setup({ viewer: owner })
    fake.store.setSettings({ operator: encodeNpub(operator) })
    fake.store.putSlot(slot('vps-1'))
    await fake.op.poll()
    expect(fake.readsFrom).toEqual([])
  })

  test('overlapping polls share one read', async () => {
    const fake = setup()
    fake.store.setSettings({ operator: encodeNpub(operator) })
    fake.store.putSlot(slot('vps-1'))
    await Promise.all([fake.op.poll(), fake.op.poll()])
    expect(fake.readsFrom).toEqual([owner])
  })

  test('a rejected request is warned about once, without its sealed key', async () => {
    const forged = installRequest({ auth: signNipOaForTests(ownerSecret, otherAgent) })
    const fake = setup({ messages: { [owner]: [from(owner, forged)] } })
    fake.store.setSettings({ operator: encodeNpub(operator) })
    fake.store.putSlot(slot('vps-1'))
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await fake.op.poll()
      await fake.op.poll()
      expect(warn).toHaveBeenCalledTimes(1)
      const text = String(warn.mock.calls[0])
      expect(text).toContain('owner proof does not verify')
      expect(text).not.toContain('AGE ENCRYPTED')
    } finally {
      warn.mockRestore()
    }
  })

  test('pollSafely logs a read failure and does not throw', async () => {
    const fake = setup({ readError: new Error('relay timeout') })
    fake.store.setSettings({ operator: encodeNpub(operator) })
    fake.store.putSlot(slot('vps-1'))
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await fake.op.pollSafely()
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0])).toContain('relay timeout')
    } finally {
      warn.mockRestore()
    }
  })

  test('saveTemplate keeps the operator setting and rejects unknown placeholders', async () => {
    const fake = setup()
    fake.store.setSettings({ operator: encodeNpub(operator) })
    await expect(fake.op.saveTemplate('deploy {nope}')).rejects.toThrow(
      'Unknown placeholder {nope}',
    )
    await fake.op.saveTemplate('deploy {name}')
    expect(fake.store.settings()).toEqual({
      operator: encodeNpub(operator),
      template: 'deploy {name}',
    })
  })

  test('offerOpen offers an imported slot with its stored host key', async () => {
    const fake = setup()
    fake.store.setSettings({ operator: encodeNpub(operator) })
    fake.store.putSlot(openSlot('vps-1'))
    await fake.op.offerOpen('vps-1', encodeNpub(owner))
    expect(fake.sent[0]).toMatchObject({
      to: owner,
      block: { type: 'slot-offer', slot: 'vps-1', hostKey: hostKeyLine(7) },
    })
    expect(fake.store.slots()[0]).toMatchObject({ state: 'offered', owner })
    await expect(fake.op.offerOpen('vps-1', encodeNpub(owner))).rejects.toThrow(/already offered/)
    await expect(fake.op.offerOpen('vps-9', encodeNpub(owner))).rejects.toThrow(/already offered/)
  })

  test('operator actions refuse a viewer that is not the operator', async () => {
    const fake = setup({ viewer: owner })
    fake.store.setSettings({ operator: encodeNpub(operator) })
    await expect(fake.op.importSlots('[]')).rejects.toThrow(/operator/)
    await expect(fake.op.saveTemplate('x')).rejects.toThrow(/operator/)
  })

  test('importSlots saves the parsed slots as open', async () => {
    const fake = setup()
    fake.store.setSettings({ operator: encodeNpub(operator) })
    const count = await fake.op.importSlots(
      JSON.stringify([{ slot: 'vps-1', label: 'One', hostKey: hostKeyLine(7) }]),
    )
    expect(count).toBe(1)
    expect(fake.store.slots().map((s) => [s.slot, s.state])).toEqual([['vps-1', 'open']])
  })
})
