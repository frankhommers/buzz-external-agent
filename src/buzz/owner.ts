import { RUNTIME } from '../constants'
import { decodeNpub, isHex64 } from '../core/keys'
import { type AcceptContext, acceptBlock, type RetireRequest } from '../core/messages'
import type { AgentStatus, Store } from '../core/store'
import type { BlockMessage, Relay } from './relay'
import type { AgentSummary, AgentsSnapshot } from './types'

/** How often the owner's plugin reads the DM with the operator. */
export const POLL_INTERVAL_MS = 60_000

/** The retire-request slot for an agent brought into Buzz rather than set up here. */
const ADOPTED_SLOT = 'adopted'

const NO_OPERATOR = 'Set the operator first'
const BAD_OPERATOR = 'Enter the operator as an npub'
const NOT_RETIRABLE = 'This agent cannot be retired from here'

const STATUS_TEXT: Record<AgentStatus | 'none', string> = {
  none: 'Hosted on your server',
  'awaiting-install': 'Waiting for installation',
  installed: 'Installed by the operator',
  'retire-requested': 'Waiting for the operator',
  retired: 'Stopped by the operator — you can delete it now',
}

export type OfferRow = { slot: string; label: string }
export type AgentRow = { pubkey: string; name: string; status: string; canRetire: boolean }
export type OwnerView = { operator: string; offers: OfferRow[]; agents: AgentRow[] }

export interface OwnerDeps {
  relay: Relay
  /** Plugin state for one community origin and viewer. */
  storeFor(scope: { origin: string; viewer: string }): Store
  agents: { snapshot(): AgentsSnapshot }
}

export interface Owner {
  view(): Promise<OwnerView>
  /** Stores the operator npub; rejects anything that is not a valid npub. */
  saveOperator(input: string): Promise<void>
  retire(pubkey: string): Promise<void>
  /** Reads the DM with the operator and applies its blocks. No-op when offline or unset. */
  poll(): Promise<void>
  /** `poll`, logging a failure instead of rejecting; the next tick retries. */
  pollSafely(): Promise<void>
  /** Called after anything the view shows has changed. */
  subscribe(listener: () => void): () => void
}

const operatorHex = (store: Store): string | undefined => {
  const operator = store.settings().operator?.trim()
  if (!operator) return undefined
  if (isHex64(operator)) return operator
  try {
    return decodeNpub(operator)
  } catch {
    return undefined
  }
}

const isRetiring = (status: AgentStatus | undefined): boolean =>
  status === 'retire-requested' || status === 'retired'

/** Applies the operator's offers and status reports; a status never moves back from retiring. */
export const applyOperatorBlocks = (
  store: Store,
  messages: readonly BlockMessage[],
  context: AcceptContext & { community: string },
): void => {
  for (const { sender, block } of messages) {
    if (!acceptBlock(block, sender, context)) continue
    switch (block.type) {
      case 'slot-offer':
        if (block.community === context.community) store.addOffer(block)
        break
      case 'installed':
        if (!isRetiring(store.statusOf(block.pubkey))) store.markInstalled(block.pubkey)
        break
      case 'retired':
        store.markRetired(block.pubkey)
        break
      default:
        break
    }
  }
}

const ourAgents = (agents: readonly AgentSummary[]): AgentSummary[] =>
  agents.filter((agent) => agent.type === RUNTIME)

export const buildOwnerView = (
  store: Store,
  agents: readonly AgentSummary[],
  community: string,
): OwnerView => ({
  operator: store.settings().operator ?? '',
  offers: store
    .offers()
    .filter((offer) => offer.community === community && store.pendingFor(offer.slot) === undefined)
    .map(({ slot, label }) => ({ slot, label })),
  agents: ourAgents(agents).map((agent) => {
    const status = store.statusOf(agent.pubkey)
    return {
      pubkey: agent.pubkey,
      name: agent.name,
      status: STATUS_TEXT[status ?? 'none'],
      canRetire: !isRetiring(status),
    }
  }),
})

export const createOwner = (deps: OwnerDeps): Owner => {
  const listeners = new Set<() => void>()
  const notify = (): void => {
    for (const listener of [...listeners]) listener()
  }

  const open = async (): Promise<{ store: Store; viewer: string; community: string }> => {
    const { origin, viewer, community } = await deps.relay.ready()
    return { store: deps.storeFor({ origin, viewer }), viewer, community }
  }

  // A slow read must not overlap the next tick: callers join the poll in flight.
  let inFlight: Promise<void> | undefined
  const poll = (): Promise<void> => {
    inFlight ??= readOperator().finally(() => {
      inFlight = undefined
    })
    return inFlight
  }

  const readOperator = async (): Promise<void> => {
    let opened: Awaited<ReturnType<typeof open>>
    try {
      opened = await open()
    } catch {
      return // Not connected yet: nothing to read.
    }
    const { store, viewer, community } = opened
    const operator = operatorHex(store)
    if (operator === undefined) return
    const messages = await deps.relay.readBlocks(operator)
    applyOperatorBlocks(store, messages, { operator, viewer, community })
    notify()
  }

  return {
    view: async () => {
      const { store, community } = await open()
      return buildOwnerView(store, deps.agents.snapshot().agents, community)
    },

    saveOperator: async (input) => {
      const operator = input.trim()
      try {
        decodeNpub(operator)
      } catch {
        throw new Error(BAD_OPERATOR)
      }
      const { store } = await open()
      store.setSettings({ ...store.settings(), operator })
      notify()
    },

    retire: async (pubkey) => {
      const { store } = await open()
      const operator = operatorHex(store)
      if (operator === undefined) throw new Error(NO_OPERATOR)
      const ours = ourAgents(deps.agents.snapshot().agents).some((a) => a.pubkey === pubkey)
      if (!ours || isRetiring(store.statusOf(pubkey))) throw new Error(NOT_RETIRABLE)
      const slot = store.pending().find((p) => p.pubkey === pubkey)?.slot ?? ADOPTED_SLOT
      const request: RetireRequest = { v: 1, type: 'retire-request', slot, pubkey }
      await deps.relay.sendBlock(operator, request)
      store.setStatus(pubkey, 'retire-requested')
      notify()
    },

    poll,

    pollSafely: async () => {
      try {
        await poll()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`Self-hosted agents: reading operator messages failed: ${message}`)
      }
    },

    subscribe: (listener) => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}
