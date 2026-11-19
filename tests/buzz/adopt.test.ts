import { describe, expect, test } from 'bun:test'
import { adopt, findAdoptable } from '../../src/buzz/adopt'
import { createRelay } from '../../src/buzz/relay'
import type { VisibleEvent } from '../../src/buzz/types'
import { RUNTIME } from '../../src/constants'
import { buildAgentProfile } from '../../src/core/events'
import { generateSecretKey, publicKeyHex } from '../../src/core/keys'
import { agentSummary, event, type FakeOptions, fakeCtx } from '../helpers/fake-session'
import { signNipOaForTests } from '../helpers/nipoa'

const ownerSecret = generateSecretKey()
const viewer = publicKeyHex(ownerSecret)
const strangerSecret = generateSecretKey()
const agentSecret = generateSecretKey()
const agent = publicKeyHex(agentSecret)

const record = (
  content: object | string = { name: 'Robo', parallelism: 3, respond_to: 'owner' },
  tags: string[][] = [],
  at = 10,
): VisibleEvent =>
  event({
    id: `rec-${at}`,
    pubkey: viewer,
    kind: 30177,
    created_at: at,
    content: typeof content === 'string' ? content : JSON.stringify(content),
    tags: [['d', agent], ...tags],
  })

const profile = (owner: Uint8Array = ownerSecret): VisibleEvent =>
  buildAgentProfile({
    secret: agentSecret,
    name: 'Robo',
    auth: signNipOaForTests(owner, agent),
    createdAt: 5,
  })

const unauthenticatedProfile = (): VisibleEvent => {
  const signed = profile()
  return { ...signed, tags: [] }
}

const setup = (options: FakeOptions = {}) => {
  const fake = fakeCtx({ viewer, events: [record(), profile()], ...options })
  return { ...fake, relay: createRelay(fake.ctx) }
}

const onlyItem = async (relay: ReturnType<typeof createRelay>) => {
  const result = await findAdoptable(relay)
  if (!result.ok) throw new Error(result.error)
  expect(result.items).toHaveLength(1)
  return result.items[0]
}

describe('findAdoptable', () => {
  test('a record without runtime whose profile names the viewer is ready', async () => {
    const { relay } = setup()
    expect(await onlyItem(relay)).toEqual({ pubkey: agent, name: 'Robo', state: 'ready' })
  })

  test('no records is an empty list, not a failure', async () => {
    const { relay } = setup({ events: [] })
    expect(await findAdoptable(relay)).toEqual({ ok: true, items: [] })
  })

  test('a key that lives in this Buzz is local-key', async () => {
    const { relay } = setup({ agents: [agentSummary(agent, 'here')] })
    expect((await onlyItem(relay))?.state).toBe('local-key')
  })

  test('a key running here for another community is local-key', async () => {
    const { relay } = setup({ running: [agentSummary(agent, 'here')] })
    expect((await onlyItem(relay))?.state).toBe('local-key')
  })

  test('a record naming another runtime is other-runtime, with that runtime', async () => {
    const { relay } = setup({
      events: [record(undefined, [['runtime', 'someone.else/agent']]), profile()],
    })
    expect(await onlyItem(relay)).toEqual({
      pubkey: agent,
      name: 'Robo',
      state: 'other-runtime',
      runtime: 'someone.else/agent',
    })
  })

  test('another runtime with a key held in this Buzz is local-key', async () => {
    const { relay } = setup({
      events: [record(undefined, [['runtime', 'buzz.goose/goose']]), profile()],
      agents: [agentSummary(agent, 'here')],
    })
    expect((await onlyItem(relay))?.state).toBe('local-key')
  })

  test('another runtime whose profile names someone else is unverified-owner', async () => {
    const { relay } = setup({
      events: [record(undefined, [['runtime', 'buzz.goose/goose']]), profile(strangerSecret)],
    })
    expect((await onlyItem(relay))?.state).toBe('unverified-owner')
  })

  test('a record with our runtime is already', async () => {
    const { relay } = setup({ events: [record(undefined, [['runtime', RUNTIME]]), profile()] })
    expect((await onlyItem(relay))?.state).toBe('already')
  })

  test('a profile owned by someone else is unverified-owner', async () => {
    const { relay } = setup({ events: [record(), profile(strangerSecret)] })
    expect((await onlyItem(relay))?.state).toBe('unverified-owner')
  })

  test('a profile without an owner proof is unverified-owner', async () => {
    const { relay } = setup({ events: [record(), unauthenticatedProfile()] })
    expect((await onlyItem(relay))?.state).toBe('unverified-owner')
  })

  test('a forged profile is unverified-owner', async () => {
    const forged = { ...profile(), content: '{"name":"evil"}' }
    const { relay } = setup({ events: [record(), forged] })
    expect((await onlyItem(relay))?.state).toBe('unverified-owner')
  })

  test('no profile at all is unverified-owner', async () => {
    const { relay } = setup({ events: [record()] })
    expect((await onlyItem(relay))?.state).toBe('unverified-owner')
  })

  test('a record without a name is unverified-owner', async () => {
    const { relay } = setup({ events: [record({ name: '  ' }), profile()] })
    expect(await onlyItem(relay)).toEqual({ pubkey: agent, name: '', state: 'unverified-owner' })
  })

  test('a failed read is { ok: false } and publishes nothing', async () => {
    const fake = setup({ readError: new Error('relay timeout') })
    expect(await findAdoptable(fake.relay)).toEqual({ ok: false, error: 'relay timeout' })
    expect(fake.sent).toHaveLength(0)
  })

  test('while Buzz is loading agents the list fails closed', async () => {
    const { relay } = setup({ agentsStatus: 'loading' })
    expect(await findAdoptable(relay)).toEqual({
      ok: false,
      error: 'Buzz is still loading agents, try again',
    })
  })
})

describe('adopt', () => {
  test('publishes the prior record with our runtime, keeping content and tags', async () => {
    const fake = setup({
      events: [
        record({ name: 'Robo', parallelism: 3, respond_to: 'owner', picture: 'https://x/p.png' }, [
          ['client-id', 'old-client'],
          ['extra', 'keep'],
        ]),
        profile(),
      ],
    })
    await adopt(fake.relay, agent)
    expect(fake.sent).toHaveLength(1)
    const sent = fake.sent[0]
    expect(sent?.kind).toBe(30177)
    expect(JSON.parse(sent?.content ?? '')).toEqual({
      name: 'Robo',
      parallelism: 3,
      respond_to: 'owner',
      picture: 'https://x/p.png',
    })
    expect(sent?.tags).toEqual([
      ['d', agent],
      ['runtime', RUNTIME],
      ['extra', 'keep'],
    ])
  })

  test('re-reads the records fresh right before publishing', async () => {
    const fake = setup()
    await adopt(fake.relay, agent)
    const recordReads = fake.reads.filter((filters) => filters[0]?.kinds?.includes(30177))
    expect(recordReads).toHaveLength(1)
    expect(fake.readSettings[fake.reads.indexOf(recordReads[0] ?? [])]).toMatchObject({
      fresh: true,
    })
  })

  test('refuses a local key and publishes nothing', async () => {
    const fake = setup({ agents: [agentSummary(agent, 'here')] })
    await expect(adopt(fake.relay, agent)).rejects.toThrow(/this Buzz/)
    expect(fake.sent).toHaveLength(0)
  })

  test('refuses while Buzz is loading agents', async () => {
    const fake = setup({ agentsStatus: 'loading' })
    await expect(adopt(fake.relay, agent)).rejects.toThrow(
      'Buzz is still loading agents, try again',
    )
    expect(fake.sent).toHaveLength(0)
  })

  test('refuses other runtimes, our own runtime and unverified owners', async () => {
    const cases: VisibleEvent[][] = [
      [record(undefined, [['runtime', 'someone.else/agent']]), profile()],
      [record(undefined, [['runtime', RUNTIME]]), profile()],
      [record(), profile(strangerSecret)],
      [record()],
    ]
    for (const events of cases) {
      const fake = setup({ events })
      await expect(adopt(fake.relay, agent)).rejects.toThrow()
      expect(fake.sent).toHaveLength(0)
    }
  })

  test('takes over an agent another runtime manages only when asked to', async () => {
    const events = [
      record(undefined, [
        ['runtime', 'buzz.goose/goose'],
        ['client-id', 'desktop'],
      ]),
      profile(),
    ]
    const refused = setup({ events })
    await expect(adopt(refused.relay, agent)).rejects.toThrow(/Another runtime/)
    expect(refused.sent).toHaveLength(0)

    const fake = setup({ events })
    await adopt(fake.relay, agent, { takeOver: true })
    expect(fake.sent).toHaveLength(1)
    expect(fake.sent[0]?.tags).toEqual([
      ['d', agent],
      ['runtime', RUNTIME],
    ])
  })

  test('take over still refuses a local key, an unverified owner and our own runtime', async () => {
    const cases: FakeOptions[] = [
      {
        events: [record(undefined, [['runtime', 'buzz.goose/goose']]), profile()],
        agents: [agentSummary(agent, 'here')],
      },
      { events: [record(undefined, [['runtime', 'buzz.goose/goose']]), profile(strangerSecret)] },
      { events: [record(undefined, [['runtime', RUNTIME]]), profile()] },
    ]
    for (const options of cases) {
      const fake = setup(options)
      await expect(adopt(fake.relay, agent, { takeOver: true })).rejects.toThrow()
      expect(fake.sent).toHaveLength(0)
    }
  })

  test('a failed read rejects and publishes nothing', async () => {
    const fake = setup({ readError: new Error('relay timeout') })
    await expect(adopt(fake.relay, agent)).rejects.toThrow('relay timeout')
    expect(fake.sent).toHaveLength(0)
  })

  test('an unknown agent rejects and publishes nothing', async () => {
    const fake = setup({ events: [] })
    await expect(adopt(fake.relay, agent)).rejects.toThrow()
    expect(fake.sent).toHaveLength(0)
  })
})
