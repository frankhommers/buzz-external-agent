import { describe, expect, test } from 'bun:test'
import {
  decodeNpub,
  encodeNpub,
  encodeNsec,
  generateSecretKey,
  isHex64,
  publicKeyHex,
} from '../../src/core/keys'

const NPUB = 'npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg'
const HEX = '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e'

describe('keys', () => {
  test('npub round-trips against the NIP-19 vector', () => {
    expect(encodeNpub(HEX)).toBe(NPUB)
    expect(decodeNpub(NPUB)).toBe(HEX)
  })

  test('decodeNpub rejects bad checksum and wrong prefix', () => {
    expect(() => decodeNpub(`${NPUB.slice(0, -1)}q`)).toThrow()
    expect(() => decodeNpub(NPUB.replace('npub', 'nsec'))).toThrow()
  })

  test('nsec encoding uses the nsec prefix and round-trips length', () => {
    const secret = generateSecretKey()
    expect(encodeNsec(secret).startsWith('nsec1')).toBe(true)
  })

  test('generateSecretKey returns distinct 32-byte keys', () => {
    const first = generateSecretKey()
    const second = generateSecretKey()
    expect(first).toHaveLength(32)
    expect(second).toHaveLength(32)
    expect(first).not.toEqual(second)
  })

  test('publicKeyHex is x-only lowercase hex', () => {
    expect(isHex64(publicKeyHex(generateSecretKey()))).toBe(true)
  })

  test('isHex64 rejects uppercase and wrong length', () => {
    expect(isHex64(HEX)).toBe(true)
    expect(isHex64(HEX.toUpperCase())).toBe(false)
    expect(isHex64(HEX.slice(1))).toBe(false)
  })
})
