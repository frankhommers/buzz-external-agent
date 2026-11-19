import { describe, expect, test } from 'bun:test'
import { generateSecretKey, publicKeyHex } from '../../src/core/keys'
import { type NipOaTag, parseNipOaTag, verifyNipOa } from '../../src/core/nipoa'
import { signNipOaForTests } from '../helpers/nipoa'

const owner = generateSecretKey()
const agent = publicKeyHex(generateSecretKey())

describe('verifyNipOa', () => {
  test('accepts empty and valid conditions', () => {
    expect(verifyNipOa(signNipOaForTests(owner, agent), agent)).toBe(true)
    const conditions = 'kind=0&created_at<4294967295'
    expect(verifyNipOa(signNipOaForTests(owner, agent, conditions), agent)).toBe(true)
  })

  test('rejects tampered signature', () => {
    const tag = signNipOaForTests(owner, agent)
    const flipped = (tag[3].startsWith('0') ? '1' : '0') + tag[3].slice(1)
    expect(verifyNipOa(['auth', tag[1], tag[2], flipped], agent)).toBe(false)
  })

  test('rejects a different agent pubkey', () => {
    const tag = signNipOaForTests(owner, agent)
    expect(verifyNipOa(tag, publicKeyHex(generateSecretKey()))).toBe(false)
  })

  test('rejects owner equal to agent', () => {
    const ownerPubkey = publicKeyHex(owner)
    expect(verifyNipOa(signNipOaForTests(owner, ownerPubkey), ownerPubkey)).toBe(false)
  })

  test.each([
    'kind=01',
    '&kind=0',
    'kind=0&',
    'kind=0&&kind=1',
    'kind=65536',
    'kind=',
    'created_at<4294967296',
    'created_at=5',
    'foo=1',
    'kind=0 &kind=1',
    ' kind=0',
  ])('rejects signed but malformed conditions %j', (conditions) => {
    expect(verifyNipOa(signNipOaForTests(owner, agent, conditions), agent)).toBe(false)
  })
})

describe('parseNipOaTag', () => {
  const valid = signNipOaForTests(owner, agent, 'kind=1')

  test('accepts a well-formed tag', () => {
    expect(parseNipOaTag([...valid])).toEqual(valid)
  })

  test('rejects wrong lengths and non-arrays', () => {
    expect(parseNipOaTag(valid.slice(0, 3))).toBeUndefined()
    expect(parseNipOaTag([...valid, 'x'])).toBeUndefined()
    expect(parseNipOaTag('auth')).toBeUndefined()
    expect(parseNipOaTag(undefined)).toBeUndefined()
  })

  test('rejects uppercase hex', () => {
    const upperOwner: NipOaTag = ['auth', valid[1].toUpperCase(), valid[2], valid[3]]
    const upperSig: NipOaTag = ['auth', valid[1], valid[2], valid[3].toUpperCase()]
    expect(parseNipOaTag([...upperOwner])).toBeUndefined()
    expect(parseNipOaTag([...upperSig])).toBeUndefined()
  })

  test('rejects bad conditions grammar and wrong tag name', () => {
    expect(parseNipOaTag(['auth', valid[1], 'kind=01', valid[3]])).toBeUndefined()
    expect(parseNipOaTag(['nope', valid[1], '', valid[3]])).toBeUndefined()
  })
})
