import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encodeNsec, generateSecretKey } from '../../src/core/keys'
import { parseHostKey, sealSecret } from '../../src/core/seal'

const hasBinary = (name: string): boolean => Bun.which(name) !== null
const hasSshKeygen = hasBinary('ssh-keygen')
const hasAge = hasBinary('age')

// Skip with a printed reason when a tool is missing locally; fail in CI.
const requireTools = (): boolean => {
  const missing = [hasSshKeygen ? '' : 'ssh-keygen', hasAge ? '' : 'age'].filter(Boolean)
  if (missing.length === 0) return true
  const message = `required tool(s) not on PATH: ${missing.join(', ')}`
  if (process.env.CI) throw new Error(message)
  console.warn(`SKIPPED (${message})`)
  return false
}

const frame = (keyBytes: Uint8Array): string => {
  const type = new TextEncoder().encode('ssh-ed25519')
  const blob = new Uint8Array(4 + type.length + 4 + 32)
  const view = new DataView(blob.buffer)
  view.setUint32(0, type.length)
  blob.set(type, 4)
  view.setUint32(4 + type.length, 32)
  blob.set(keyBytes, 8 + type.length)
  return `ssh-ed25519 ${Buffer.from(blob).toString('base64')}`
}

const makeKey = (dir: string, name: string): { path: string; pub: string } => {
  const path = join(dir, name)
  const result = Bun.spawnSync(['ssh-keygen', '-t', 'ed25519', '-N', '', '-C', 'test', '-f', path])
  if (result.exitCode !== 0) throw new Error('ssh-keygen failed')
  return { path, pub: readFileSync(`${path}.pub`, 'utf8') }
}

const withTempDir = async (run: (dir: string) => Promise<void> | void): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'seal-test-'))
  try {
    await run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('parseHostKey', () => {
  test('parses a key with comment; fingerprint matches ssh-keygen', () =>
    withTempDir((dir) => {
      if (!requireTools()) return
      const key = makeKey(dir, 'k')
      const host = parseHostKey(`  ${key.pub}\n`)
      expect(host.line.startsWith('ssh-ed25519 ')).toBe(true)
      const expected = Bun.spawnSync(['ssh-keygen', '-lf', `${key.path}.pub`])
        .stdout.toString()
        .split(' ')[1]
      expect(host.fingerprint).toBe(expected as string)
      expect(host.fingerprint.startsWith('SHA256:')).toBe(true)
    }))

  test('accepts a key without comment', () => {
    const blob = 'AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl'
    expect(parseHostKey(`ssh-ed25519 ${blob}`).line).toBe(`ssh-ed25519 ${blob}`)
  })

  test('rejects other key types', () => {
    expect(() => parseHostKey('ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC test')).toThrow(
      'Only ssh-ed25519 host keys are supported',
    )
    expect(() => parseHostKey('ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTY= x')).toThrow(
      'Only ssh-ed25519 host keys are supported',
    )
    expect(() => parseHostKey('garbage')).toThrow('Only ssh-ed25519 host keys are supported')
    expect(() => parseHostKey('')).toThrow('Only ssh-ed25519 host keys are supported')
  })

  test('rejects malformed ed25519 blobs', () => {
    expect(() => parseHostKey('ssh-ed25519 !!!notbase64')).toThrow('Not a valid SSH public key')
    expect(() => parseHostKey('ssh-ed25519 AAAA')).toThrow('Not a valid SSH public key')
    // valid wire format but blob declares a different key type
    expect(() => parseHostKey('ssh-ed25519 AAAAB3NzaC1yc2EAAAADAQAB')).toThrow(
      'Not a valid SSH public key',
    )
  })
})

describe('parseHostKey point validation', () => {
  const allFf = new Uint8Array(32).fill(255)
  const identity = new Uint8Array(32)
  identity[0] = 1
  const offCurve = new Uint8Array(32)
  offCurve[0] = 2

  test.each([
    ['non-canonical all-0xff y', allFf],
    ['identity point', identity],
    ['off-curve y=2', offCurve],
  ])('rejects %s', (_name, keyBytes) => {
    expect(() => parseHostKey(frame(keyBytes))).toThrow('Not a valid SSH public key')
  })
})

describe('sealSecret', () => {
  test('age CLI decrypts to nsec + newline', () =>
    withTempDir(async (dir) => {
      if (!requireTools()) return
      const key = makeKey(dir, 'k')
      const secret = generateSecretKey()
      const armored = await sealSecret(secret, parseHostKey(key.pub))
      expect(armored.startsWith('-----BEGIN AGE ENCRYPTED FILE-----')).toBe(true)
      const file = join(dir, 'sealed.age')
      writeFileSync(file, armored)
      const result = Bun.spawnSync(['age', '-d', '-i', key.path, file])
      expect(result.exitCode).toBe(0)
      expect(result.stdout.toString()).toBe(`${encodeNsec(secret)}\n`)
    }))

  test('a different ssh key cannot decrypt', () =>
    withTempDir(async (dir) => {
      if (!requireTools()) return
      const right = makeKey(dir, 'right')
      const wrong = makeKey(dir, 'wrong')
      const file = join(dir, 'sealed.age')
      writeFileSync(file, await sealSecret(generateSecretKey(), parseHostKey(right.pub)))
      const result = Bun.spawnSync(['age', '-d', '-i', wrong.path, file])
      expect(result.exitCode).not.toBe(0)
    }))

  test('two seals of the same secret differ (fresh ephemeral key)', async () => {
    const host = parseHostKey(
      'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl',
    )
    const secret = generateSecretKey()
    expect(await sealSecret(secret, host)).not.toBe(await sealSecret(secret, host))
  })
})
