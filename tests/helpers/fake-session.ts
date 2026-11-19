import type {
  AgentSummary,
  AgentsSnapshot,
  Delivery,
  DirectMessages,
  Messages,
  Outbox,
  OutgoingEvent,
  ReadFilter,
  ReadSettings,
  RelayCtx,
  RelaySession,
  RelaySnapshot,
  VisibleEvent,
} from '../../src/buzz/types'

export interface FakeOptions {
  viewer?: string
  origin?: string
  status?: RelaySnapshot['status']
  supported?: number[]
  deliveryOutcome?: Delivery
  events?: VisibleEvent[]
  readError?: Error
  dmAvailable?: boolean
  agents?: AgentSummary[]
  running?: AgentSummary[]
  agentsStatus?: AgentsSnapshot['status']
}

export const agentSummary = (
  pubkey: string,
  place: AgentSummary['place'],
  overrides: Partial<AgentSummary> = {},
): AgentSummary => ({ pubkey, place, name: 'Agent', type: 'other/type', ...overrides })

export const fakeCtx = (options: FakeOptions = {}) => {
  const viewer = options.viewer ?? 'v'.repeat(64)
  const queue: OutgoingEvent[] = []
  const listeners = new Set<() => void>()
  const sent: { kind: number; content: string; tags: string[][] }[] = []
  const messagesSent: { channelId: string; content: string }[] = []
  const dismissed: string[] = []
  const opened: string[][] = []
  const reads: ReadFilter[][] = []
  const readSettings: (ReadSettings | undefined)[] = []
  let counter = 0

  const outbox: Outbox = {
    snapshot: () => queue,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    supports: (kind) => (options.supported ?? [30177, 9]).includes(kind),
    ready: async () => {},
    send: (input) => {
      sent.push(input)
      return enqueue(`out-${++counter}`)
    },
    dismiss: async (id) => {
      dismissed.push(id)
    },
  }

  const enqueue = (id: string): string => {
    queue.push({ event: { id }, delivery: 'sending' })
    queueMicrotask(() => {
      const outcome = options.deliveryOutcome ?? 'accepted'
      queue.splice(0, queue.length, {
        event: { id },
        delivery: outcome,
        ...(outcome === 'failed' ? { error: 'relay refused' } : {}),
      })
      for (const listener of [...listeners]) listener()
    })
    return id
  }

  const directMessages: DirectMessages = {
    available: options.dmAvailable ?? true,
    open: async (pubkeys) => {
      opened.push([...pubkeys])
      return `dm-${[...pubkeys].sort().join('-')}`
    },
  }
  const messages: Messages = {
    send: (channelId, content) => {
      messagesSent.push({ channelId, content })
      return enqueue(`msg-${++counter}`)
    },
  }
  const session: RelaySession = {
    viewer,
    outbox,
    directMessages,
    messages,
    read: async (filters, settings) => {
      reads.push([...filters])
      readSettings.push(settings)
      if (options.readError) throw options.readError
      return (options.events ?? []).filter((e) =>
        filters.some(
          (f) =>
            (!f.kinds || f.kinds.includes(e.kind)) &&
            (!f.authors || f.authors.includes(e.pubkey)) &&
            (!f['#h'] || f['#h'].includes(e.tags.find((t) => t[0] === 'h')?.[1] ?? '')) &&
            (!f['#d'] || f['#d'].includes(e.tags.find((t) => t[0] === 'd')?.[1] ?? '')),
        ),
      )
    },
  }
  const snapshot: RelaySnapshot = {
    status: options.status ?? 'ready',
    origin: options.origin ?? 'https://relay.example.com',
    viewer,
    session,
  }
  const ctx: RelayCtx = {
    relay: { snapshot: () => snapshot, subscribe: () => () => {} },
    agents: {
      snapshot: () => ({
        status: options.agentsStatus ?? 'ready',
        agents: options.agents ?? [],
        running: options.running ?? [],
      }),
    },
  }
  return { ctx, viewer, sent, messagesSent, dismissed, opened, reads, readSettings }
}

export const event = (
  partial: Partial<VisibleEvent> & Pick<VisibleEvent, 'id' | 'pubkey' | 'kind'>,
): VisibleEvent => ({ created_at: 1, content: '', tags: [], ...partial })
