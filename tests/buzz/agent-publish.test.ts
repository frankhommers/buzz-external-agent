import { afterEach, describe, expect, test } from 'bun:test'
import { publishAsAgent } from '../../src/buzz/agent-publish'
import { buildAgentProfile, type SignedEvent, verifyEvent } from '../../src/core/events'
import { generateSecretKey, publicKeyHex } from '../../src/core/keys'
import type { NipOaTag } from '../../src/core/nipoa'
import { signNipOaForTests } from '../helpers/nipoa'

const RELAY = 'wss://buzz.test'

type Listener = (event: { data?: unknown }) => void

/** A WebSocket the test drives: frames it sends are recorded, frames from the relay are pushed. */
class FakeSocket {
  static last: FakeSocket | undefined
  static created = 0
  readonly sent: unknown[] = []
  readonly url: string
  closed = false
  private readonly listeners = new Map<string, Set<Listener>>()

  constructor(url: string) {
    this.url = url
    FakeSocket.last = this
    FakeSocket.created += 1
  }

  addEventListener(type: string, listener: Listener): void {
    const set = this.listeners.get(type) ?? new Set<Listener>()
    set.add(listener)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener)
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data))
  }

  close(): void {
    this.closed = true
  }

  listenerCount(): number {
    return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0)
  }

  fire(type: string, event: { data?: unknown } = {}): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event)
  }

  frame(value: unknown): void {
    this.fire('message', { data: typeof value === 'string' ? value : JSON.stringify(value) })
  }
}

const socket = (): FakeSocket => {
  if (FakeSocket.last === undefined) throw new Error('no socket opened')
  return FakeSocket.last
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => {
  FakeSocket.last = undefined
  FakeSocket.created = 0
})

const owner = generateSecretKey()

const NOW_MS = 1_800_000_123_456

const fixture = (overrides: { timeoutMs?: number; signal?: AbortSignal } = {}) => {
  const secret = generateSecretKey()
  const pubkey = publicKeyHex(secret)
  const auth: NipOaTag = signNipOaForTests(owner, pubkey)
  const event = buildAgentProfile({ secret, name: 'Bot', auth, createdAt: 1_800_000_000 })
  const promise = publishAsAgent({
    relay: RELAY,
    secret,
    auth,
    event,
    WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
    now: () => NOW_MS,
    ...overrides,
  })
  // Observed so a rejection the test has not awaited yet is not reported as unhandled.
  promise.catch(() => {})
  return { secret, pubkey, auth, event, promise }
}

const authEventSent = (): SignedEvent => {
  const frame = socket().sent.find((f) => Array.isArray(f) && f[0] === 'AUTH') as
    | [string, SignedEvent]
    | undefined
  if (frame === undefined) throw new Error('no AUTH sent')
  return frame[1]
}

describe('publishAsAgent', () => {
  test('signs in as the agent, publishes the event, then closes', async () => {
    const { pubkey, auth, event, promise } = fixture()
    expect(socket().url).toBe(RELAY)
    expect(socket().sent).toEqual([])

    socket().frame(['NOTICE', 'hello'])
    socket().frame(['AUTH', 'challenge-1'])
    const authEvent = authEventSent()
    expect(authEvent.kind).toBe(22242)
    expect(authEvent.pubkey).toBe(pubkey)
    expect(authEvent.tags).toEqual([['relay', RELAY], ['challenge', 'challenge-1'], [...auth]])
    expect(verifyEvent(authEvent)).toBe(true)
    expect(authEvent.created_at).toBe(Math.floor(NOW_MS / 1000))
    expect(socket().sent).toHaveLength(1)

    socket().frame(['OK', 'f'.repeat(64), true, ''])
    expect(socket().sent).toHaveLength(1)
    socket().frame(['OK', authEvent.id, true, ''])
    expect(socket().sent).toEqual([
      ['AUTH', authEvent],
      ['EVENT', event],
    ])

    socket().frame(['CLOSED', 'sub', 'whatever'])
    socket().frame('not json')
    socket().frame(['OK', event.id, true, ''])
    await expect(promise).resolves.toBeUndefined()
    expect(socket().closed).toBe(true)
    expect(socket().listenerCount()).toBe(0)
  })

  test('a refused sign-in rejects with the relay message and sends no event', async () => {
    const { promise } = fixture()
    socket().frame(['AUTH', 'challenge-1'])
    socket().frame(['OK', authEventSent().id, false, 'restricted: not a member'])
    await expect(promise).rejects.toThrow('restricted: not a member')
    expect(socket().sent).toHaveLength(1)
    expect(socket().closed).toBe(true)
  })

  test('a refused event rejects with the relay message', async () => {
    const { event, promise } = fixture()
    socket().frame(['AUTH', 'challenge-1'])
    socket().frame(['OK', authEventSent().id, true, ''])
    socket().frame(['OK', event.id, false, 'invalid: bad auth tag'])
    await expect(promise).rejects.toThrow('invalid: bad auth tag')
    expect(socket().closed).toBe(true)
  })

  test('no challenge in time rejects and closes', async () => {
    const { promise } = fixture({ timeoutMs: 20 })
    await expect(promise).rejects.toThrow('The relay did not ask the agent to sign in')
    expect(socket().sent).toEqual([])
    expect(socket().closed).toBe(true)
  })

  test('no answer to the event in time rejects', async () => {
    const { promise } = fixture({ timeoutMs: 20 })
    socket().frame(['AUTH', 'challenge-1'])
    socket().frame(['OK', authEventSent().id, true, ''])
    await expect(promise).rejects.toThrow('The relay did not answer in time')
    expect(socket().closed).toBe(true)
  })

  test('a socket error rejects', async () => {
    const { promise } = fixture()
    socket().fire('error')
    await expect(promise).rejects.toThrow('Could not reach the relay')
    expect(socket().closed).toBe(true)
  })

  test('the relay closing the socket rejects', async () => {
    const { promise } = fixture()
    socket().frame(['AUTH', 'challenge-1'])
    socket().fire('close')
    await expect(promise).rejects.toThrow('The relay closed the connection')
  })

  test('an abort rejects with the abort reason and closes', async () => {
    const controller = new AbortController()
    const { promise } = fixture({ signal: controller.signal })
    socket().frame(['AUTH', 'challenge-1'])
    controller.abort()
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(socket().closed).toBe(true)
    expect(socket().listenerCount()).toBe(0)
  })

  test('an already aborted signal opens no socket', async () => {
    const controller = new AbortController()
    controller.abort()
    const { promise } = fixture({ signal: controller.signal })
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(FakeSocket.created).toBe(0)
  })

  test('frames after settling are ignored', async () => {
    const { promise } = fixture()
    socket().fire('error')
    await expect(promise).rejects.toThrow()
    socket().frame(['AUTH', 'late'])
    await tick()
    expect(socket().sent).toEqual([])
  })

  test('never puts the secret key in a frame or error', async () => {
    const { secret, promise } = fixture()
    const secretHex = Buffer.from(secret).toString('hex')
    socket().frame(['AUTH', 'challenge-1'])
    socket().frame(['OK', authEventSent().id, false, 'no'])
    const error = await promise.catch((e: unknown) => e)
    expect(JSON.stringify(socket().sent)).not.toContain(secretHex)
    expect(String(error)).not.toContain(secretHex)
  })
})
