import { describe, expect, test } from 'bun:test'
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encodeNsec, generateSecretKey, publicKeyHex } from '../src/core/keys'
import { parseHostKey, sealSecret } from '../src/core/seal'

const SCRIPT = join(import.meta.dir, '..', 'installer', 'install-agent-key.sh')
const RELAY = 'wss://relay.example.test'
const OWNER = 'a'.repeat(64)
const SIG = 'b'.repeat(128)
const OLD_ENV = ['# agent env', 'FOO=bar', "BUZZ_RELAY_URL='old'", 'BUZZ_PRIVATE_KEY=old', ''].join(
  '\n',
)

// Skip with a printed reason when a tool is missing locally; fail in CI.
const requireTools = (): boolean => {
  const missing = ['age', 'jq', 'ssh-keygen', 'sh'].filter((name) => Bun.which(name) === null)
  if (missing.length === 0) return true
  const message = `required tool(s) not on PATH: ${missing.join(', ')}`
  if (process.env.CI) throw new Error(message)
  console.warn(`SKIPPED (${message})`)
  return false
}

interface Fixture {
  dir: string
  pubkey: string
  nsec: string
  authTag: string
  sealed: string
  envFile: string
  hostKey: string
  buzzLog: string
  run: (overrides?: {
    buzzPubkey?: string
    authTag?: string
    sealed?: string
    relay?: string
  }) => RunResult
}

interface RunResult {
  code: number
  stdout: string
  stderr: string
}

const setup = async (dir: string, withEnv: boolean): Promise<Fixture> => {
  const hostKey = join(dir, 'host_key')
  const keygen = Bun.spawnSync(['ssh-keygen', '-t', 'ed25519', '-N', '', '-C', 't', '-f', hostKey])
  if (keygen.exitCode !== 0) throw new Error('ssh-keygen failed')
  const secret = generateSecretKey()
  const pubkey = publicKeyHex(secret)
  const nsec = encodeNsec(secret)
  const sealed = join(dir, 'slot.age')
  writeFileSync(
    sealed,
    await sealSecret(secret, parseHostKey(readFileSync(`${hostKey}.pub`, 'utf8'))),
  )
  const envFile = join(dir, 'agent.env')
  if (withEnv) writeFileSync(envFile, OLD_ENV, { mode: 0o644 })
  const buzzLog = join(dir, 'buzz.log')
  const authTag = JSON.stringify(['auth', OWNER, 'kind=9', SIG])
  const fakeBuzz = (reportedPubkey: string): string => {
    const path = join(dir, 'buzz')
    writeFileSync(
      path,
      [
        '#!/bin/sh',
        `printf '%s\\n' "$*" >> '${buzzLog}'`,
        ...['BUZZ_RELAY_URL', 'BUZZ_AUTH_TAG'].map((name) => `[ -n "$\{${name}:-}" ] || exit 1`),
        `[ "\${BUZZ_PRIVATE_KEY:-}" = '${nsec}' ] || exit 1`,
        `echo '[{"pubkey":"${reportedPubkey}"}]'`,
        '',
      ].join('\n'),
    )
    chmodSync(path, 0o755)
    return path
  }
  const run: Fixture['run'] = (overrides = {}) => {
    const buzz = fakeBuzz(overrides.buzzPubkey ?? pubkey)
    const result = Bun.spawnSync([
      'sh',
      SCRIPT,
      '--sealed',
      overrides.sealed ?? sealed,
      '--pubkey',
      pubkey,
      '--auth-tag',
      overrides.authTag ?? authTag,
      '--relay',
      overrides.relay ?? RELAY,
      '--env-file',
      envFile,
      '--host-key',
      hostKey,
      '--buzz',
      buzz,
    ])
    return {
      code: result.exitCode,
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
    }
  }
  return { dir, pubkey, nsec, authTag, sealed, envFile, hostKey, buzzLog, run }
}

const withFixture = async (
  withEnv: boolean,
  body: (fixture: Fixture) => Promise<void> | void,
): Promise<void> => {
  if (!requireTools()) return
  const dir = mkdtempSync(join(tmpdir(), 'installer-test-'))
  try {
    await body(await setup(dir, withEnv))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const mode = (path: string): number => statSync(path).mode & 0o777

describe('install-agent-key.sh', () => {
  test('success writes the three keys, keeps other lines, backs up, removes sealed', () =>
    withFixture(true, (f) => {
      const result = f.run()
      expect(result.code).toBe(0)
      const report = JSON.parse(result.stdout) as { ok: boolean; pubkey: string; backup: string }
      expect(report.ok).toBe(true)
      expect(report.pubkey).toBe(f.pubkey)
      expect(report.backup).toMatch(/agent\.env\.bak-\d{8}T\d{6}Z$/)
      expect(readFileSync(report.backup, 'utf8')).toBe(OLD_ENV)
      expect(mode(report.backup)).toBe(0o600)

      const env = readFileSync(f.envFile, 'utf8')
      const lines = env.split('\n')
      expect(lines).toContain('# agent env')
      expect(lines).toContain('FOO=bar')
      expect(lines).toContain(`BUZZ_RELAY_URL='${RELAY}'`)
      expect(lines).toContain(`BUZZ_PRIVATE_KEY=${f.nsec}`)
      expect(lines).toContain(`BUZZ_AUTH_TAG='${f.authTag}'`)
      for (const key of ['BUZZ_RELAY_URL', 'BUZZ_PRIVATE_KEY', 'BUZZ_AUTH_TAG']) {
        expect(lines.filter((line) => line.startsWith(`${key}=`)).length).toBe(1)
      }
      expect(mode(f.envFile)).toBe(0o600)
      expect(existsSync(f.sealed)).toBe(false)
      expect(readdirSync(f.dir).filter((name) => name.includes('.tmp'))).toEqual([])
    }))

  test('creates the env file when absent; backup is null', () =>
    withFixture(false, (f) => {
      const result = f.run()
      expect(result.code).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual({ ok: true, pubkey: f.pubkey, backup: null })
      expect(readFileSync(f.envFile, 'utf8')).toContain(`BUZZ_PRIVATE_KEY=${f.nsec}`)
      expect(mode(f.envFile)).toBe(0o600)
    }))

  test('pubkey mismatch fails, leaves env and sealed file alone', () =>
    withFixture(true, (f) => {
      const result = f.run({ buzzPubkey: 'c'.repeat(64) })
      expect(result.code).not.toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({ ok: false })
      expect(readFileSync(f.envFile, 'utf8')).toBe(OLD_ENV)
      expect(existsSync(f.sealed)).toBe(true)
      expect(readdirSync(f.dir).some((name) => name.includes('.bak-'))).toBe(false)
    }))

  test('malformed auth tag is rejected before anything is written', () =>
    withFixture(true, (f) => {
      for (const tag of [
        JSON.stringify(['auth', 'zz', 'kind=9', SIG]),
        JSON.stringify(['auth', OWNER, 'kind=9']),
        JSON.stringify(['nope', OWNER, 'kind=9', SIG]),
        JSON.stringify(['auth', OWNER, 'kind=9', 'b'.repeat(127)]),
        'not json',
      ]) {
        const result = f.run({ authTag: tag })
        expect(result.code).not.toBe(0)
        expect(JSON.parse(result.stdout)).toMatchObject({ ok: false })
      }
      expect(readFileSync(f.envFile, 'utf8')).toBe(OLD_ENV)
      expect(existsSync(f.sealed)).toBe(true)
    }))

  test('undecryptable sealed file fails cleanly', () =>
    withFixture(true, (f) => {
      const bogus = join(f.dir, 'bogus.age')
      writeFileSync(bogus, 'not an age file')
      const result = f.run({ sealed: bogus })
      expect(result.code).not.toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({ ok: false })
      expect(readFileSync(f.envFile, 'utf8')).toBe(OLD_ENV)
    }))

  test('the nsec never reaches stdout, stderr or buzz argv', () =>
    withFixture(true, (f) => {
      const ok = f.run()
      const bad = f.run({ buzzPubkey: 'c'.repeat(64) })
      for (const result of [ok, bad]) {
        expect(result.stdout).not.toContain('nsec1')
        expect(result.stderr).not.toContain('nsec1')
      }
      expect(readFileSync(f.buzzLog, 'utf8')).not.toContain('nsec1')
    }))

  test.each([
    ['relay with quote', { relay: "wss://a.test'x" }],
    ['relay with trailing newline', { relay: 'wss://a.test\n' }],
    [
      'auth tag with trailing newline in owner',
      {
        authTag: JSON.stringify(['auth', `${OWNER}\n`, 'kind=9', SIG]),
      },
    ],
    [
      'auth tag with trailing newline in sig',
      { authTag: JSON.stringify(['auth', OWNER, 'kind=9', `${SIG}\n`]) },
    ],
    [
      'auth tag with trailing newline in condition',
      { authTag: JSON.stringify(['auth', OWNER, 'kind=9\n', SIG]) },
    ],
    ['relay with newline', { relay: 'wss://a.test\nX=1' }],
    ['relay with command substitution', { relay: 'wss://a.test/$(id)' }],
    ['relay with backtick', { relay: 'wss://a.test/`id`' }],
    ['relay with semicolon', { relay: 'wss://a.test/;id' }],
    ['relay without scheme', { relay: 'https://a.test' }],
    ['auth tag with JSON quote', { authTag: JSON.stringify(['auth', OWNER, "kind=9'x", SIG]) }],
    [
      'auth tag with two documents',
      { authTag: `${JSON.stringify(['auth', OWNER, 'kind=9', SIG])}\n{}` },
    ],
    [
      'auth tag with escaped quote',
      { authTag: `["auth","${OWNER}","kind=9\\u0027;touch x;\\u0027","${SIG}"]` },
    ],
    ['auth tag with bad conditions', { authTag: JSON.stringify(['auth', OWNER, 'kind=09', SIG]) }],
    [
      'auth tag with out-of-range kind',
      { authTag: JSON.stringify(['auth', OWNER, 'kind=65536', SIG]) },
    ],
    [
      'auth tag with whitespace conditions',
      { authTag: JSON.stringify(['auth', OWNER, 'kind=9 & kind=1', SIG]) },
    ],
  ])('rejects %s', (_name, overrides) =>
    withFixture(true, (f) => {
      const result = f.run(overrides)
      expect(result.code).not.toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({ ok: false })
      expect(readFileSync(f.envFile, 'utf8')).toBe(OLD_ENV)
      expect(existsSync(f.sealed)).toBe(true)
    }),
  )

  test.each([
    ['extra line', (nsec: string) => `${nsec}\n$(id)\n`],
    ['no trailing newline', (nsec: string) => nsec],
    ['two trailing newlines', (nsec: string) => `${nsec}\n\n`],
  ])('rejects decrypted plaintext with %s', (_name, craft) =>
    withFixture(true, (f) => {
      const crafted = join(f.dir, 'crafted.age')
      const sealed = Bun.spawnSync(['age', '-a', '-R', `${f.hostKey}.pub`, '-o', crafted], {
        stdin: new TextEncoder().encode(craft(f.nsec)),
      })
      expect(sealed.exitCode).toBe(0)
      const result = f.run({ sealed: crafted })
      expect(result.code).not.toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({ ok: false })
      expect(readFileSync(f.envFile, 'utf8')).toBe(OLD_ENV)
      expect(existsSync(crafted)).toBe(true)
    }),
  )
})
