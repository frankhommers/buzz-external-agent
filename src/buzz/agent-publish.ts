import { buildAuthEvent, type SignedEvent } from '../core/events'
import type { NipOaTag } from '../core/nipoa'

export interface PublishAsAgentInput {
  /** The community's `wss://` URL; also the NIP-42 `relay` tag. */
  relay: string
  /** The agent's secret key, used only to sign the sign-in event; never kept. */
  secret: Uint8Array
  /** The owner's NIP-OA proof for the agent. */
  auth: NipOaTag
  /** The event to publish, already signed by the agent. */
  event: SignedEvent
  signal?: AbortSignal
  WebSocketImpl?: typeof WebSocket
  /** Overall deadline in milliseconds. */
  timeoutMs?: number
  /** Wall-clock Unix milliseconds, for the sign-in event's `created_at`. */
  now?: () => number
}

const DEADLINE_MS = 20_000
// Each wait for the relay, as buzz-ws-client bounds its AUTH challenge and OK phases.
const PHASE_MS = 10_000
const MS_PER_SECOND = 1000

const NO_CHALLENGE = 'The relay did not ask the agent to sign in'
const NO_ANSWER = 'The relay did not answer in time'
const UNREACHABLE = 'Could not reach the relay'
const CLOSED = 'The relay closed the connection'
const SIGN_IN_REFUSED = 'The relay refused the agent sign-in'
const EVENT_REFUSED = 'The relay refused the agent profile'
const ABORTED = 'Publishing the agent profile was cancelled'

type Phase = 'challenge' | 'auth' | 'event'

const parseFrame = (data: unknown): unknown[] | undefined => {
  if (typeof data !== 'string') return undefined
  try {
    const value: unknown = JSON.parse(data)
    return Array.isArray(value) ? value : undefined
  } catch {
    return undefined
  }
}

const refusal = (prefix: string, message: unknown): string =>
  typeof message === 'string' && message !== '' ? `${prefix}: ${message}` : prefix

/**
 * Publishes an agent-signed event on its own connection, signed in (NIP-42) as the agent:
 * the Buzz outbox signs as the viewer. Unrelated relay frames are ignored.
 */
export const publishAsAgent = (input: PublishAsAgentInput): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const { relay, secret, auth, event, signal } = input
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const Impl = input.WebSocketImpl ?? globalThis.WebSocket
    let socket: WebSocket
    try {
      socket = new Impl(relay)
    } catch {
      reject(new Error(UNREACHABLE))
      return
    }

    let phase: Phase = 'challenge'
    let authId = ''
    let settled = false
    let phaseTimer: ReturnType<typeof setTimeout> | undefined

    const timedOut = (): void => settle(new Error(phase === 'challenge' ? NO_CHALLENGE : NO_ANSWER))
    const deadline = setTimeout(timedOut, input.timeoutMs ?? DEADLINE_MS)
    const enter = (next: Phase): void => {
      phase = next
      clearTimeout(phaseTimer)
      phaseTimer = setTimeout(timedOut, PHASE_MS)
    }

    const send = (frame: unknown[]): void => {
      try {
        socket.send(JSON.stringify(frame))
      } catch {
        settle(new Error(UNREACHABLE))
      }
    }

    const onMessage = (message: MessageEvent): void => {
      const frame = parseFrame(message.data)
      if (frame === undefined) return
      const [type, first, accepted, text] = frame
      if (phase === 'challenge') {
        if (type !== 'AUTH' || typeof first !== 'string') return
        const createdAt = Math.floor((input.now ?? Date.now)() / MS_PER_SECOND)
        const authEvent = buildAuthEvent(secret, relay, first, auth, createdAt)
        authId = authEvent.id
        enter('auth')
        send(['AUTH', authEvent])
        return
      }
      if (type !== 'OK' || typeof accepted !== 'boolean') return
      if (phase === 'auth' && first === authId) {
        if (!accepted) {
          settle(new Error(refusal(SIGN_IN_REFUSED, text)))
          return
        }
        enter('event')
        send(['EVENT', event])
      } else if (phase === 'event' && first === event.id) {
        settle(accepted ? undefined : new Error(refusal(EVENT_REFUSED, text)))
      }
    }
    const onError = (): void => settle(new Error(UNREACHABLE))
    const onClose = (): void => settle(new Error(CLOSED))
    const onAbort = (): void => settle(signal?.reason ?? new Error(ABORTED))

    function settle(error?: unknown): void {
      if (settled) return
      settled = true
      clearTimeout(deadline)
      clearTimeout(phaseTimer)
      socket.removeEventListener('message', onMessage)
      socket.removeEventListener('error', onError)
      socket.removeEventListener('close', onClose)
      signal?.removeEventListener('abort', onAbort)
      try {
        socket.close()
      } catch {
        // Already closing or closed.
      }
      if (error === undefined) resolve()
      else reject(error)
    }

    socket.addEventListener('message', onMessage)
    socket.addEventListener('error', onError)
    socket.addEventListener('close', onClose)
    signal?.addEventListener('abort', onAbort)
    enter('challenge')
  })
