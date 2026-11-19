import { describe, expect, test } from 'bun:test'
import { RUNTIME } from '../../src/constants'
import {
  buildAgentProfile,
  buildAuthEvent,
  mergeAgentRecord,
  newAgentRecord,
  profileOwner,
  recordRuntime,
  type SignedEvent,
  verifyEvent,
} from '../../src/core/events'
import { generateSecretKey, publicKeyHex } from '../../src/core/keys'
import { signNipOaForTests } from '../helpers/nipoa'

const owner = generateSecretKey()
const ownerPub = publicKeyHex(owner)
const secret = generateSecretKey()
const pubkey = publicKeyHex(secret)
const createdAt = 1_800_000_000

const profile = (conditions = 'kind=0', picture?: string): SignedEvent =>
  buildAgentProfile({
    secret,
    name: 'Bot',
    ...(picture === undefined ? {} : { picture }),
    auth: signNipOaForTests(owner, pubkey, conditions),
    createdAt,
  })

describe('buildAuthEvent', () => {
  test('builds a NIP-42 event for the relay and challenge, carrying the owner proof', () => {
    const auth = signNipOaForTests(owner, pubkey)
    const event = buildAuthEvent(secret, 'wss://buzz.test', 'challenge-1', auth, createdAt)
    expect(event.kind).toBe(22242)
    expect(event.pubkey).toBe(pubkey)
    expect(event.created_at).toBe(createdAt)
    expect(event.content).toBe('')
    expect(event.tags).toEqual([
      ['relay', 'wss://buzz.test'],
      ['challenge', 'challenge-1'],
      [...auth],
    ])
    expect(verifyEvent(event)).toBe(true)
  })
})

describe('buildAgentProfile', () => {
  test('builds a verifying kind 0 event with one auth tag', () => {
    const event = profile()
    expect(event.kind).toBe(0)
    expect(event.pubkey).toBe(pubkey)
    expect(event.tags.filter((tag) => tag[0] === 'auth')).toHaveLength(1)
    expect(verifyEvent(event)).toBe(true)
    expect(profileOwner(event)).toBe(ownerPub)
  })

  test('serializes content in order and includes picture only when given', () => {
    expect(profile().content).toBe('{"name":"Bot","display_name":"Bot","bot":true}')
    expect(profile('kind=0', 'https://x/p.png').content).toBe(
      '{"name":"Bot","display_name":"Bot","picture":"https://x/p.png","bot":true}',
    )
  })

  test('verifyEvent rejects tampered content and signature', () => {
    const event = profile()
    expect(verifyEvent({ ...event, content: '{}' })).toBe(false)
    const flipped = (event.sig.startsWith('0') ? '1' : '0') + event.sig.slice(1)
    expect(verifyEvent({ ...event, sig: flipped })).toBe(false)
  })
})

describe('profileOwner', () => {
  test('rejects two auth tags', () => {
    const event = profile()
    const second = signNipOaForTests(generateSecretKey(), pubkey, 'kind=0')
    expect(profileOwner({ ...event, tags: [...event.tags, [...second]] })).toBeUndefined()
  })

  test('rejects an auth tag whose conditions the event does not satisfy', () => {
    expect(profileOwner(profile('kind=1'))).toBeUndefined()
    expect(profileOwner(profile(`created_at<${createdAt}`))).toBeUndefined()
    expect(profileOwner(profile(`created_at>${createdAt}`))).toBeUndefined()
  })

  test('accepts satisfied time conditions', () => {
    expect(profileOwner(profile(`kind=0&created_at<${createdAt + 1}`))).toBe(ownerPub)
    expect(profileOwner(profile(`created_at>${createdAt - 1}`))).toBe(ownerPub)
    expect(profileOwner(profile(''))).toBe(ownerPub)
  })

  test('rejects an auth tag signed for another agent', () => {
    const other = publicKeyHex(generateSecretKey())
    const event = buildAgentProfile({
      secret,
      name: 'Bot',
      auth: signNipOaForTests(owner, other),
      createdAt,
    })
    expect(profileOwner(event)).toBeUndefined()
  })
})

describe('agent records', () => {
  test('newAgentRecord has defaults', () => {
    const record = newAgentRecord({ pubkey, name: 'Bot' })
    expect(record.content).toEqual({ parallelism: 1, respond_to: 'anyone', name: 'Bot' })
    expect(record.tags).toEqual([
      ['d', pubkey],
      ['runtime', RUNTIME],
    ])
  })

  test('newAgentRecord includes picture when given', () => {
    const record = newAgentRecord({ pubkey, name: 'Bot', picture: 'p' })
    expect(record.content.picture).toBe('p')
  })

  test('mergeAgentRecord keeps unknown keys and extra tags, replaces owned tags', () => {
    const prior = {
      content: { respond_to: 'owner', parallelism: 3, extra: { a: 1 }, name: 'Old', picture: '' },
      tags: [
        ['d', 'old'],
        ['client-id', 'x'],
        ['runtime', 'other'],
        ['custom', 'v'],
      ],
    }
    const merged = mergeAgentRecord(prior, { pubkey, name: 'New' })
    expect(merged.content).toEqual({
      respond_to: 'owner',
      parallelism: 3,
      extra: { a: 1 },
      name: 'New',
    })
    expect(merged.tags).toEqual([
      ['d', pubkey],
      ['runtime', RUNTIME],
      ['custom', 'v'],
    ])
  })

  test('mergeAgentRecord sets a provided picture and drops an empty one', () => {
    const prior = { content: { picture: 'old' }, tags: [] }
    expect(mergeAgentRecord(prior, { pubkey, name: 'N', picture: 'new' }).content.picture).toBe(
      'new',
    )
    expect('picture' in mergeAgentRecord(prior, { pubkey, name: 'N', picture: '' }).content).toBe(
      false,
    )
  })

  test('recordRuntime reads the runtime tag', () => {
    expect(recordRuntime(newAgentRecord({ pubkey, name: 'B' }).tags)).toBe(RUNTIME)
    expect(recordRuntime([['d', 'x']])).toBeUndefined()
  })
})
