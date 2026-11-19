// Minimal structural copies of the Buzz Desktop 1.0.5 plugin API
// (block/buzz-app @ desktop-v1.0.5). Only the members this plugin uses.

/** features/relay/events.ts:16-41 (ReadFilter, reduced to the keys used). */
export interface ReadFilter {
  kinds?: readonly number[]
  authors?: readonly string[]
  '#h'?: readonly string[]
  '#d'?: readonly string[]
  limit: number
}

/**
 * features/relay/projection.ts:5 (VisibleEvent = EventData & delivery) and
 * features/relay/events.ts:13 (EventData has no `sig`). Remote events carry a
 * verified `sig` at runtime; local outbox intent merged by `read` does not.
 */
export interface VisibleEvent {
  id: string
  pubkey: string
  created_at: number
  kind: number
  content: string
  tags: readonly (readonly string[])[]
  sig?: string
}

/** features/relay/outbox.ts:21 */
export type Delivery = 'sending' | 'accepted' | 'unknown' | 'failed' | 'seen'

/** features/relay/outbox.ts:48-53 (OutgoingEvent, reduced). */
export interface OutgoingEvent {
  event: { id: string }
  delivery: Delivery
  error?: string | undefined
}

/** features/relay/outbox.ts:61-123 (Outbox) and :180 (OutboxInput = kind, content, tags). */
export interface Outbox {
  snapshot(): readonly OutgoingEvent[]
  subscribe(listener: () => void): () => void
  supports(kind: number): boolean
  ready(): Promise<void>
  send(input: { kind: number; content: string; tags: string[][] }): string
  dismiss(id: string): Promise<void>
}

/** features/relay/direct-messages.ts:44 (`available`) and :183-210 (`open`). */
export interface DirectMessages {
  available: boolean
  open(pubkeys: readonly string[], signal: AbortSignal): Promise<string>
}

/** features/relay/messages.ts:434-461: `send(channelId, content)` queues a kind 9, returns its id. */
export interface Messages {
  send(channelId: string, content: string): string
}

/** features/relay/session.ts:2484 (session object), :3029 (`read`), :2997 (`outbox`). */
export interface RelaySession {
  viewer?: string | undefined
  read(
    filters: readonly ReadFilter[],
    settings?: { signal?: AbortSignal },
  ): Promise<readonly VisibleEvent[]>
  outbox?: Outbox | undefined
  directMessages: DirectMessages
  messages: Messages
}

/** features/relay/service.ts:28-50 (RelaySnapshot, reduced). */
export interface RelaySnapshot {
  status: 'disconnected' | 'connecting' | 'ready' | 'error'
  origin?: string | undefined
  viewer?: string | undefined
  cached?: true | undefined
  session: RelaySession
}

/** features/relay/service.ts:52-70 (RelayData, reduced). */
export interface RelayData {
  snapshot(): RelaySnapshot
  subscribe(listener: () => void): () => void
}

/** features/agents/service.ts:250-263 (Agent) and :1318-1323 (AgentsSnapshot), reduced. */
export interface AgentsSnapshot {
  agents: readonly { pubkey: string; place: 'here' | 'hosted' | 'elsewhere' }[]
}

/** features/agents/service.ts:1412,1514 (Agents.snapshot). */
export interface AgentsService {
  snapshot(): AgentsSnapshot
}

/** features/host/service.ts:280-283, :292 (prepareRemoteAgentAuthorization -> ['auth', owner, '', sig]). */
export interface Host {
  prepareRemoteAgentAuthorization(
    agentPubkey: string,
    signal?: AbortSignal,
  ): Promise<readonly string[]>
}

/** The slice of the plugin ctx the relay adapter touches (inject: relay, agents). */
export interface RelayCtx {
  relay: RelayData
  agents: AgentsService
}
