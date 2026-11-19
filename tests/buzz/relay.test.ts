import { describe, expect, test } from 'bun:test'
import { createRelay } from '../../src/buzz/relay'
import type { VisibleEvent } from '../../src/buzz/types'
import { buildAgentProfile } from '../../src/core/events'
import { generateSecretKey, publicKeyHex } from '../../src/core/keys'
import { type Block, encodeBlock } from '../../src/core/messages'
import { agentSummary, event, fakeCtx } from '../helpers/fake-session'
import { signNipOaForTests } from '../helpers/nipoa'

const hex = (c: string): string => c.repeat(64)
const agentA = hex('a')
const agentB = hex('b')
const peer = hex('c')

const record = (id: string, d: string, at: number, content: object = { name: 'x' }) =>
  event({
    id,
    pubkey: hex('v'),
    kind: 30177,
    created_at: at,
    content: JSON.stringify(content),
    tags: [
      ['d', d],
      ['runtime', 'r'],
    ],
  })

describe('ready', () => {
  test('returns origin, viewer and wss community', async () => {
    const { ctx, viewer } = fakeCtx()
    expect(await createRelay(ctx).ready()).toEqual({
      origin: 'https://relay.example.com',
      viewer,
      community: 'wss://relay.example.com',
    })
  })

  test('throws when not ready', async () => {
    const { ctx } = fakeCtx({ status: 'connecting' })
    await expect(createRelay(ctx).ready()).rejects.toThrow()
  })
})

describe('readOwnRecords', () => {
  test('newest per d, tie goes to greater id, ignores non-hex d', async () => {
    const { ctx } = fakeCtx({
      events: [
        record('1', agentA, 10, { name: 'old' }),
        record('2', agentA, 20, { name: 'new' }),
        record('3', agentB, 5, { name: 'tie-low' }),
        record('4', agentB, 5, { name: 'tie-high' }),
        record('5', 'not-hex', 99),
      ],
    })
    const result = await createRelay(ctx).readOwnRecords()
    if (!result.ok) throw new Error('expected ok')
    expect([...result.records.keys()].sort()).toEqual([agentA, agentB])
    expect(result.records.get(agentA)?.content).toEqual({ name: 'new' })
    expect(result.records.get(agentB)?.content).toEqual({ name: 'tie-high' })
    expect(result.records.get(agentA)?.tags).toEqual([
      ['d', agentA],
      ['runtime', 'r'],
    ])
  })

  test('ignores other authors', async () => {
    const stranger = { ...record('9', agentA, 50), pubkey: hex('e') }
    const { ctx } = fakeCtx({ events: [stranger] })
    const result = await createRelay(ctx).readOwnRecords()
    expect(result.ok && result.records.size).toBe(0)
  })

  test('reads fresh, in the foreground, as Buzz reads its own listings', async () => {
    const fake = fakeCtx()
    await createRelay(fake.ctx).readOwnRecords()
    expect(fake.readSettings).toEqual([{ fresh: true, priority: 'foreground' }])
  })

  test('skips heads whose local delivery failed or is unknown', async () => {
    const { ctx } = fakeCtx({
      events: [
        record('1', agentA, 10, { name: 'accepted' }),
        { ...record('2', agentA, 20, { name: 'failed' }), delivery: 'failed' },
        { ...record('3', agentA, 30, { name: 'unknown' }), delivery: 'unknown' },
        { ...record('4', agentB, 40, { name: 'sending' }), delivery: 'sending' },
      ],
    })
    const result = await createRelay(ctx).readOwnRecords()
    if (!result.ok) throw new Error('expected ok')
    expect(result.records.get(agentA)?.content).toEqual({ name: 'accepted' })
    expect(result.records.get(agentB)?.content).toEqual({ name: 'sending' })
  })

  test('keeps a head whose content is not a JSON object as {} with its tags', async () => {
    const { ctx } = fakeCtx({
      events: [
        record('1', agentA, 10, { name: 'older' }),
        { ...record('2', agentA, 20), content: 'not json' },
        { ...record('3', agentB, 20), content: '[1,2]' },
      ],
    })
    const result = await createRelay(ctx).readOwnRecords()
    if (!result.ok) throw new Error('expected ok')
    expect(result.records.get(agentA)).toEqual({
      content: {},
      tags: [
        ['d', agentA],
        ['runtime', 'r'],
      ],
    })
    expect(result.records.get(agentB)?.content).toEqual({})
  })

  test('a rejected read is { ok: false }', async () => {
    const { ctx } = fakeCtx({ readError: new Error('denied') })
    expect(await createRelay(ctx).readOwnRecords()).toEqual({ ok: false, error: 'denied' })
  })
})

describe('readProfile', () => {
  const secret = generateSecretKey()
  const pubkey = publicKeyHex(secret)
  const owner = generateSecretKey()
  const profile = (createdAt: number): VisibleEvent =>
    buildAgentProfile({
      secret,
      name: 'Robo',
      auth: signNipOaForTests(owner, pubkey),
      createdAt,
    })

  test('returns the newest verified profile', async () => {
    const { ctx } = fakeCtx({ events: [profile(10), profile(20)] })
    expect((await createRelay(ctx).readProfile(pubkey))?.created_at).toBe(20)
  })

  test('rejects an event that does not verify', async () => {
    const forged = { ...profile(30), content: '{"name":"evil"}' }
    const { ctx } = fakeCtx({ events: [profile(10), forged] })
    expect(await createRelay(ctx).readProfile(pubkey)).toBeUndefined()
  })

  test('reads fresh, in the foreground, so a read from before a publish is not joined', async () => {
    const fake = fakeCtx({ events: [profile(10)] })
    await createRelay(fake.ctx).readProfile(pubkey)
    expect(fake.readSettings).toEqual([{ fresh: true, priority: 'foreground' }])
  })

  test('undefined when none, or unsigned', async () => {
    const { sig: _sig, ...unsigned } = profile(10)
    const { ctx } = fakeCtx({ events: [unsigned] })
    expect(await createRelay(ctx).readProfile(pubkey)).toBeUndefined()
  })
})

describe('publishRecord', () => {
  test('sends kind 30177, awaits delivery and dismisses', async () => {
    const fake = fakeCtx()
    await createRelay(fake.ctx).publishRecord({
      content: { name: 'x', parallelism: 1 },
      tags: [['d', agentA]],
    })
    expect(fake.sent).toEqual([
      { kind: 30177, content: '{"name":"x","parallelism":1}', tags: [['d', agentA]] },
    ])
    expect(fake.dismissed).toEqual(['out-1'])
  })

  test('throws when 30177 unsupported', async () => {
    const fake = fakeCtx({ supported: [9] })
    await expect(createRelay(fake.ctx).publishRecord({ content: {}, tags: [] })).rejects.toThrow(
      /cannot list agents/,
    )
    expect(fake.sent).toHaveLength(0)
  })

  test('throws when the relay refuses', async () => {
    const fake = fakeCtx({ deliveryOutcome: 'failed' })
    await expect(createRelay(fake.ctx).publishRecord({ content: {}, tags: [] })).rejects.toThrow(
      'relay refused',
    )
  })
})

const offer: Block = {
  v: 1,
  type: 'retired',
  slot: 'vps-1',
  pubkey: agentA,
}

describe('sendBlock', () => {
  test('opens a 1:1 DM and sends the encoded block', async () => {
    const fake = fakeCtx()
    await createRelay(fake.ctx).sendBlock(peer, offer)
    expect(fake.opened).toEqual([[peer]])
    expect(fake.messagesSent).toEqual([{ channelId: `dm-${peer}`, content: encodeBlock(offer) }])
  })

  test('dismisses the outbox entry once the relay accepted the message', async () => {
    const fake = fakeCtx()
    await createRelay(fake.ctx).sendBlock(peer, offer)
    expect(fake.dismissed).toEqual(['msg-1'])
  })

  test('keeps a refused message in the outbox so the user sees it', async () => {
    const fake = fakeCtx({ deliveryOutcome: 'failed' })
    await expect(createRelay(fake.ctx).sendBlock(peer, offer)).rejects.toThrow('relay refused')
    expect(fake.dismissed).toEqual([])
  })

  test('refuses secret material before touching the DM', async () => {
    const fake = fakeCtx()
    const bad = { ...offer, slot: 'nsec1leak' } as Block
    await expect(createRelay(fake.ctx).sendBlock(peer, bad)).rejects.toThrow(/secret/)
    expect(fake.opened).toHaveLength(0)
    expect(fake.messagesSent).toHaveLength(0)
  })

  test('throws when DMs are unavailable', async () => {
    const fake = fakeCtx({ dmAvailable: false })
    await expect(createRelay(fake.ctx).sendBlock(peer, offer)).rejects.toThrow()
  })
})

describe('readBlocks', () => {
  const dm = `dm-${peer}`
  const msg = (id: string, pubkey: string, at: number, content: string) =>
    event({ id, pubkey, kind: 9, created_at: at, content, tags: [['h', dm]] })

  test('returns parsed blocks with senders in message order', async () => {
    const viewer = hex('v')
    const second: Block = { ...offer, slot: 'vps-2' }
    const { ctx } = fakeCtx({
      events: [
        msg('2', peer, 20, encodeBlock(second)),
        msg('1', viewer, 10, encodeBlock(offer)),
        msg('3', peer, 30, 'just chatting'),
        msg('4', hex('e'), 40, encodeBlock(offer)),
        event({
          id: '5',
          pubkey: peer,
          kind: 9,
          created_at: 50,
          content: encodeBlock(offer),
          tags: [['h', 'other']],
        }),
      ],
    })
    expect(await createRelay(ctx).readBlocks(peer)).toEqual([
      { sender: viewer, block: offer },
      { sender: peer, block: second },
    ])
  })
})

describe('isLocalIdentity', () => {
  test('true only for an agent placed here', () => {
    const { ctx } = fakeCtx({
      agents: [agentSummary(agentA, 'here'), agentSummary(agentB, 'hosted')],
    })
    const relay = createRelay(ctx)
    expect(relay.isLocalIdentity(agentA)).toBe(true)
    expect(relay.isLocalIdentity(agentB)).toBe(false)
    expect(relay.isLocalIdentity(peer)).toBe(false)
  })

  test('also finds a local agent running in another community', () => {
    const { ctx } = fakeCtx({ running: [agentSummary(agentB, 'here')] })
    expect(createRelay(ctx).isLocalIdentity(agentB)).toBe(true)
  })

  test('fails closed while Buzz is still loading its agents', () => {
    for (const agentsStatus of ['loading', 'unavailable', 'error'] as const) {
      const { ctx } = fakeCtx({ agentsStatus })
      expect(() => createRelay(ctx).isLocalIdentity(agentA)).toThrow(
        'Buzz is still loading agents, try again',
      )
    }
  })
})
