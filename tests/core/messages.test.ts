import { describe, expect, test } from 'bun:test'
import { ed25519 } from '@noble/curves/ed25519.js'
import { generateSecretKey, publicKeyHex } from '../../src/core/keys'
import { acceptBlock, type Block, encodeBlock, parseBlocks } from '../../src/core/messages'
import { signNipOaForTests } from '../helpers/nipoa'

const operator = publicKeyHex(generateSecretKey())
const owner = publicKeyHex(generateSecretKey())
const agent = publicKeyHex(generateSecretKey())
const ARMOR = '-----BEGIN AGE ENCRYPTED FILE-----\nabc\n-----END AGE ENCRYPTED FILE-----'

const HOST_KEY = (() => {
  const part = (b: Uint8Array): Uint8Array => {
    const out = new Uint8Array(4 + b.length)
    new DataView(out.buffer).setUint32(0, b.length)
    out.set(b, 4)
    return out
  }
  const blob = new Uint8Array([
    ...part(new TextEncoder().encode('ssh-ed25519')),
    ...part(ed25519.getPublicKey(new Uint8Array(32).fill(7))),
  ])
  return `ssh-ed25519 ${Buffer.from(blob).toString('base64')}`
})()

const offer: Block = {
  v: 1,
  type: 'slot-offer',
  slot: 'vps-1',
  label: 'My VPS',
  hostKey: HOST_KEY,
  community: 'wss://relay.example.com',
}
const install: Block = {
  v: 1,
  type: 'install-request',
  slot: 'vps-1',
  pubkey: agent,
  name: 'Robo',
  auth: signNipOaForTests(generateSecretKey(), agent),
  sealed: ARMOR,
}
const retireReq: Block = { v: 1, type: 'retire-request', slot: 'vps-1', pubkey: agent }
const retired: Block = { v: 1, type: 'retired', slot: 'vps-1', pubkey: agent }
const installed: Block = { v: 1, type: 'installed', slot: 'vps-1', pubkey: agent }

const fence = (json: unknown): string =>
  `line\n\n\`\`\`selfhosted-agents\n${typeof json === 'string' ? json : JSON.stringify(json)}\n\`\`\``

describe('encode/parse', () => {
  for (const block of [offer, install, retireReq, retired, installed]) {
    test(`round-trips ${block.type}`, () => {
      const text = encodeBlock(block)
      expect(text.split('\n')[0]).not.toContain('```')
      expect(parseBlocks(text)).toEqual([block])
    })
  }

  test('human line is a single line and mentions the plugin', () => {
    const first = encodeBlock(offer).split('\n\n')[0] ?? ''
    expect(first).not.toContain('\n')
    expect(first).toContain('Self-hosted agents')
  })

  test('parses multiple blocks in order, skipping other fences', () => {
    const text = `${encodeBlock(offer)}\n\n\`\`\`js\n1\n\`\`\`\n\n${encodeBlock(retired)}`
    expect(parseBlocks(text)).toEqual([offer, retired])
  })

  test('rejects nsec1 anywhere', () => {
    expect(() => encodeBlock({ ...offer, label: 'nsec1abc' })).toThrow(
      'Refusing to send secret material',
    )
    expect(parseBlocks(fence({ ...offer, label: 'nsec1abc' }))).toEqual([])
  })

  test('ignores invalid blocks silently', () => {
    const bad = [
      { ...offer, v: 2 },
      { ...offer, extra: 1 },
      { ...offer, slot: 'Bad Slot' },
      { ...offer, slot: '-x' },
      { ...offer, community: 'https://x.example' },
      { ...offer, community: 'nonsense' },
      { ...offer, label: 'x'.repeat(81) },
      { ...install, sealed: 'not armored' },
      { ...install, sealed: `${ARMOR}${'a'.repeat(5000)}` },
      { ...install, name: '' },
      { ...install, name: 'a\nb' },
      { ...install, name: 'a\u0007b' },
      { ...offer, hostKey: 'ssh-rsa AAAA' },
      { ...offer, hostKey: 'ssh-ed25519 AAAA' },
      { ...offer, hostKey: `${HOST_KEY}${' '.repeat(600)}` },
      { ...install, auth: ['auth', 'x', '', 'y'] },
      { ...retired, pubkey: 'zz' },
    ]
    for (const b of bad) expect(parseBlocks(fence(b))).toEqual([])
    expect(parseBlocks(fence('{not json'))).toEqual([])
  })
})

describe('acceptBlock', () => {
  test('operator-origin blocks accepted only from operator', () => {
    for (const b of [offer, retired, installed]) {
      expect(acceptBlock(b, operator, { operator, viewer: owner })).toBe(true)
      expect(acceptBlock(b, owner, { operator, viewer: owner })).toBe(false)
      expect(acceptBlock(b, operator.toUpperCase(), { operator, viewer: owner })).toBe(true)
    }
  })

  test('requests accepted only when viewer is operator and sender is not viewer', () => {
    for (const b of [install, retireReq]) {
      expect(acceptBlock(b, owner, { operator, viewer: operator })).toBe(true)
      expect(acceptBlock(b, owner, { operator, viewer: agent })).toBe(false)
      expect(acceptBlock(b, operator, { operator, viewer: operator })).toBe(false)
    }
  })

  test('operator who is also owner may see own operator blocks', () => {
    expect(acceptBlock(offer, operator, { operator, viewer: operator })).toBe(true)
  })
})
