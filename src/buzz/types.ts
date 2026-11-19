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
  /** Set on the viewer's own outbox events merged in by `read` (projection.ts:51-61). */
  delivery?: Delivery
}

/** features/relay/outbox.ts:21 */
export type Delivery = 'sending' | 'accepted' | 'unknown' | 'failed' | 'seen'

/** features/relay/reader.ts:12-17 (ReadOptions, reduced). */
export interface ReadSettings {
  signal?: AbortSignal
  priority?: 'foreground' | 'background'
  /** Start a new read instead of joining an older in-flight one. */
  fresh?: boolean
}

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
  read(filters: readonly ReadFilter[], settings?: ReadSettings): Promise<readonly VisibleEvent[]>
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

/** features/agents/service.ts:250-262 (Agent), reduced to what the snapshot readers use. */
export interface AgentSummary {
  pubkey: string
  name: string
  /** The agent type's key, `pluginId/typeId` (our runtime tag for ours). */
  type: string
  place: 'here' | 'hosted' | 'elsewhere'
}

/** features/agents/service.ts:1318-1330 (AgentsSnapshot), reduced. */
export interface AgentsSnapshot {
  status: 'unavailable' | 'loading' | 'ready' | 'error'
  /** The selected community's agents. */
  agents: readonly AgentSummary[]
  /** Every agent kept running here, whichever community is selected. */
  running: readonly AgentSummary[]
}

/** features/agents/service.ts:1514-1515 (snapshot, subscribe) and :3042 (register). */
export interface AgentsService {
  snapshot(): AgentsSnapshot
  subscribe(listener: () => void): () => void
  register<Config>(type: AgentType<Config>): void
  registerTab(tab: AgentAddedTab): void
}

/** features/agents/service.ts:400-415 (AgentAddedTab), reduced; `open`/`canOpen` are unused. */
export interface AgentAddedTab {
  id: string
  title: string
  component: (props: { agent: Agent }) => unknown
  when?: (agent: Agent) => boolean
  subscribe?: (listener: () => void) => () => void
}

/**
 * features/agents/service.ts:367-385 (AgentCreateProps): the starting config comes in as `config`
 * and the choice goes back through `onChange(config)`; `disabled` locks the controls.
 */
export interface AgentCreateProps<Config> {
  config: Config
  onChange(config: Config, options?: { suggested?: boolean }): void
  disabled: boolean
}

/**
 * features/agents/service.ts:996-1001 (CreateConfiguration props): `harnessControl` is the host's
 * Harness row, placed by the type; `onReadyChange(ready)` gates the dialog's create button
 * (usage: bundled/claude-code/tabs.tsx:704-717). The props carry no community or relay.
 */
export type CreateConfigurationProps<Config> = AgentCreateProps<Config> & {
  harnessControl: unknown
  onReadyChange?: (ready: boolean) => void
}

/** features/settings/service.ts:10-20 (SettingsCard component props, reduced). */
export interface SettingsCardProps {
  active(): boolean
  community?: { id: string; name: string }
}

/** features/settings/service.ts:10-40 (SettingsCard, SettingsCards.register), reduced. */
export interface SettingsCards {
  register(card: {
    id: string
    title: string
    component: (props: SettingsCardProps) => unknown
  }): void
}

/** features/host/service.ts:92-97 (NipOaAuthorization). */
export type NipOaAuthorization = readonly [
  'auth',
  ownerPubkey: string,
  conditions: string,
  signature: string,
]

/** features/host/service.ts:280-283, :292 (prepareRemoteAgentAuthorization -> ['auth', owner, '', sig]). */
export interface Host {
  prepareRemoteAgentAuthorization(
    agentPubkey: string,
    signal?: AbortSignal,
  ): Promise<readonly string[]>
}

/** features/agents/service.ts:250-293 (Agent), reduced to the members this plugin reads. */
export type Agent<Config = unknown> = Readonly<{
  pubkey: string
  name: string
  picture?: string
  type: string
  owner: string
  relay: string
  place: 'here' | 'hosted' | 'elsewhere'
  config: Config
}>

/** features/agents/service.ts:1123-1196 (RemoteAgentType), without the optional interrupt/instructions. */
export type RemoteAgentType = Readonly<{
  provision(
    input: Readonly<{
      name: string
      picture?: string
      community: string
      config?: unknown
      signal: AbortSignal
    }>,
  ): Promise<Readonly<{ pubkey: string; picture?: string }>>
  activate(
    input: Readonly<{
      pubkey: string
      name: string
      community: string
      auth: NipOaAuthorization
      config?: unknown
      signal: AbortSignal
    }>,
  ): Promise<void>
  profile(
    input: Readonly<{
      pubkey: string
      community: string
      name: string
      picture?: string
      signal: AbortSignal
    }>,
  ): Promise<void>
  remove(input: Readonly<{ pubkey: string; community: string; signal: AbortSignal }>): Promise<void>
}>

/**
 * features/agents/service.ts:932-1118 (AgentType), reduced to the members this plugin sets.
 * A remote type must not set run, models or timeoutMs (service.ts:3042-3073, Agents.register).
 */
export type AgentType<Config = unknown> = {
  id: string
  title: string
  description?: string
  defaults(): Readonly<{ config: Config }>
  summary?(agent: Agent<Config>): string
  /** service.ts:996 (ComponentType; here a plain function component). */
  CreateConfiguration?: (props: CreateConfigurationProps<Config>) => unknown
  remote?: RemoteAgentType
}

/** The slice of the plugin ctx the relay adapter touches (inject: relay, agents). */
export interface RelayCtx {
  relay: RelayData
  agents: Pick<AgentsService, 'snapshot'>
}
