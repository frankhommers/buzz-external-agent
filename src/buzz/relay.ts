import { type AgentRecord, type SignedEvent, verifyEvent } from '../core/events'
import { isHex64 } from '../core/keys'
import { type Block, encodeBlock, parseBlocks } from '../core/messages'
import type { Outbox, RelayCtx, RelaySession, VisibleEvent } from './types'

const AGENT_RECORD_KIND = 30177
const PROFILE_KIND = 0
const DM_MESSAGE_KIND = 9
const RECORD_LIMIT = 500
const PROFILE_LIMIT = 20
const DM_LIMIT = 200
const DM_OPEN_TIMEOUT_MS = 30_000
const AGENTS_LOADING = 'Buzz is still loading agents, try again'

export interface ReadyRelay {
  origin: string
  viewer: string
  community: string
}

export type OwnRecords =
  | { ok: true; records: Map<string, AgentRecord> }
  | { ok: false; error: string }

export interface BlockMessage {
  sender: string
  block: Block
}

export interface Relay {
  ready(): Promise<ReadyRelay>
  readOwnRecords(): Promise<OwnRecords>
  readProfile(pubkey: string): Promise<SignedEvent | undefined>
  publishRecord(record: AgentRecord): Promise<void>
  sendBlock(to: string, block: Block): Promise<void>
  readBlocks(withPubkey: string): Promise<BlockMessage[]>
  /** Whether the key is an agent identity of this Buzz. Throws until Buzz has loaded its agents. */
  isLocalIdentity(pubkey: string): boolean
}

// Same derivation as wssOf in Buzz agents/service.ts:2042 (origin is already https://host).
const wssOf = (origin: string): string => origin.replace(/\/+$/, '').replace(/^https:/, 'wss:')

const isNewer = (candidate: VisibleEvent, current: VisibleEvent | undefined): boolean =>
  current === undefined ||
  candidate.created_at > current.created_at ||
  (candidate.created_at === current.created_at && candidate.id > current.id)

const tagValue = (event: VisibleEvent, name: string): string | undefined =>
  event.tags.find((tag) => tag[0] === name)?.[1]

const toSigned = (event: VisibleEvent): SignedEvent | undefined =>
  event.sig === undefined
    ? undefined
    : {
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at,
        kind: event.kind,
        tags: event.tags.map((tag) => [...tag]),
        content: event.content,
        sig: event.sig,
      }

// As Buzz reads a listing (agents/service.ts:2008-2015): anything but a JSON object is {}.
const parseContent = (content: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(content)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

/** A local outbox intent the relay refused or may never have stored is not the record. */
const isUndelivered = (event: VisibleEvent): boolean =>
  event.delivery === 'failed' || event.delivery === 'unknown'

/** Settles when the outbox reports relay acceptance of `id`; rejects with its refusal. */
const delivered = (outbox: Outbox, id: string, failure: string): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    let stop = (): void => {}
    const inspect = (): void => {
      const item = outbox.snapshot().find((entry) => entry.event.id === id)
      if (item === undefined || item.delivery === 'accepted' || item.delivery === 'seen') {
        stop()
        resolve()
      } else if (item.delivery !== 'sending') {
        stop()
        reject(new Error(item.error ?? failure))
      }
    }
    stop = outbox.subscribe(inspect)
    inspect()
  })

export const createRelay = (ctx: RelayCtx): Relay => {
  // Never capture the session: Buzz replaces it on reconnect.
  const live = (): { session: RelaySession; origin: string; viewer: string } => {
    const snapshot = ctx.relay.snapshot()
    if (
      snapshot.status !== 'ready' ||
      snapshot.cached === true ||
      snapshot.origin === undefined ||
      snapshot.viewer === undefined
    )
      throw new Error('Not connected to a community yet')
    return { session: snapshot.session, origin: snapshot.origin, viewer: snapshot.viewer }
  }

  const openDirectMessage = async (session: RelaySession, pubkey: string): Promise<string> => {
    if (!isHex64(pubkey)) throw new Error('Invalid public key')
    if (!session.directMessages.available) throw new Error('Direct messages are unavailable here')
    return session.directMessages.open([pubkey], AbortSignal.timeout(DM_OPEN_TIMEOUT_MS))
  }

  return {
    ready: async () => {
      const { origin, viewer } = live()
      return { origin, viewer, community: wssOf(origin) }
    },

    readOwnRecords: async () => {
      try {
        const { session, viewer } = live()
        // Buzz reads its own listings the same way (agents/service.ts:6402-6404).
        const events = await session.read(
          [{ kinds: [AGENT_RECORD_KIND], authors: [viewer], limit: RECORD_LIMIT }],
          { fresh: true, priority: 'foreground' },
        )
        const newest = new Map<string, VisibleEvent>()
        for (const event of events) {
          const d = tagValue(event, 'd')
          if (event.kind !== AGENT_RECORD_KIND || event.pubkey !== viewer) continue
          if (d === undefined || !isHex64(d) || isUndelivered(event)) continue
          if (isNewer(event, newest.get(d))) newest.set(d, event)
        }
        const records = new Map<string, AgentRecord>()
        for (const [d, event] of newest)
          records.set(d, {
            content: parseContent(event.content),
            tags: event.tags.map((tag) => [...tag]),
          })
        return { ok: true, records }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },

    readProfile: async (pubkey) => {
      const { session } = live()
      // Fresh: a read joined from before a publish could report the profile absent.
      const events = await session.read(
        [{ kinds: [PROFILE_KIND], authors: [pubkey], limit: PROFILE_LIMIT }],
        { fresh: true, priority: 'foreground' },
      )
      let head: VisibleEvent | undefined
      for (const event of events)
        if (event.kind === PROFILE_KIND && event.pubkey === pubkey && isNewer(event, head))
          head = event
      const signed = head === undefined ? undefined : toSigned(head)
      return signed !== undefined && verifyEvent(signed) ? signed : undefined
    },

    publishRecord: async (record) => {
      const { session } = live()
      const outbox = session.outbox
      if (outbox?.supports(AGENT_RECORD_KIND) !== true)
        throw new Error('This community cannot list agents.')
      await outbox.ready()
      const id = outbox.send({
        kind: AGENT_RECORD_KIND,
        content: JSON.stringify(record.content),
        tags: record.tags.map((tag) => [...tag]),
      })
      await delivered(outbox, id, 'The agent list was not updated. Retry.')
      await outbox.dismiss(id)
    },

    sendBlock: async (to, block) => {
      const text = encodeBlock(block)
      const { session } = live()
      const outbox = session.outbox
      if (outbox === undefined) throw new Error('Sending is unavailable.')
      const channelId = await openDirectMessage(session, to)
      const id = session.messages.send(channelId, text)
      await delivered(outbox, id, 'The message was not sent. Retry.')
      // As publishRecord: Buzz caps pending outbox entries, so clear the delivered one.
      await outbox.dismiss(id)
    },

    readBlocks: async (withPubkey) => {
      const { session, viewer } = live()
      const channelId = await openDirectMessage(session, withPubkey)
      const events = await session.read([
        { kinds: [DM_MESSAGE_KIND], '#h': [channelId], limit: DM_LIMIT },
      ])
      return events
        .filter(
          (event) =>
            event.kind === DM_MESSAGE_KIND &&
            tagValue(event, 'h') === channelId &&
            (event.pubkey === viewer || event.pubkey === withPubkey),
        )
        .sort((a, b) => a.created_at - b.created_at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .flatMap((event) =>
          parseBlocks(event.content).map((block) => ({ sender: event.pubkey, block })),
        )
    },

    // Fails closed: until Buzz has loaded its agents, a local key could look foreign.
    isLocalIdentity: (pubkey) => {
      const snapshot = ctx.agents.snapshot()
      if (snapshot.status !== 'ready') throw new Error(AGENTS_LOADING)
      return [...snapshot.agents, ...snapshot.running].some(
        (agent) => agent.pubkey === pubkey && agent.place === 'here',
      )
    },
  }
}
