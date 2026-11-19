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

  test('nsec encodes the NIP-19 vector', () => {
    const secret = Uint8Array.from(
      Buffer.from('67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa', 'hex'),
    )
    expect(encodeNsec(secret)).toBe(
      'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5',
    )
  })

  test('nsec encoding refuses anything but a valid 32-byte secret key', () => {
    const order = 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'
    for (const secret of [
      new Uint8Array(31).fill(1),
      new Uint8Array(33).fill(1),
      new Uint8Array(32),
      Uint8Array.from(Buffer.from(order, 'hex')),
    ]) {
      expect(() => encodeNsec(secret)).toThrow('not a valid secret key')
    }
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
