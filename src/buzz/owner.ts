import { ADOPTED_SLOT, RUNTIME } from '../constants'
import { decodeNpub } from '../core/keys'
import { type AcceptContext, acceptBlock, type RetireRequest } from '../core/messages'
import { type AgentStatus, operatorPubkey, type Store } from '../core/store'
import { receiveOwnRequest } from './operator'
import { createPoll } from './poll'
import type { BlockMessage, Relay } from './relay'
import type { AgentSummary, AgentsSnapshot } from './types'

const NO_OPERATOR = 'Set the operator first'
const BAD_OPERATOR = 'Enter the operator as an npub'
const NOT_RETIRABLE = 'This agent cannot be retired from here'
const NO_RETIRE_REQUEST = 'There is no retire request to cancel'

const STATUS_TEXT: Record<AgentStatus | 'none', string> = {
  none: 'Hosted on your server',
  'awaiting-install': 'Waiting for installation',
  installed: 'Installed by the operator',
  'retire-requested': 'Waiting for the operator',
  retired: 'Stopped by the operator — you can delete it now',
}

/** The wording on an agent's own Server tab. */
const TAB_STATUS_TEXT: Record<AgentStatus | 'none', string> = {
  none: 'Unknown — set up outside this device',
  'awaiting-install': 'Waiting for installation',
  installed: 'Installed',
  'retire-requested': 'Retirement requested — waiting for the operator',
  retired: 'Stopped by the operator — you can delete it now',
}

export type AgentStatusView = { text: string; canRetire: boolean; canCancelRetire: boolean }

export type OfferRow = { slot: string; label: string }
export type AgentRow = {
  pubkey: string
  name: string
  status: string
  canRetire: boolean
  canCancelRetire: boolean
}
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
  /** Takes back a retire request locally: the agent shows its earlier status again. */
  cancelRetire(pubkey: string): Promise<void>
  /** One agent's status in plain words, and whether it can still be retired. */
  agentStatus(pubkey: string): Promise<AgentStatusView>
  /** Reads the DM with the operator and applies its blocks. No-op when offline or unset. */
  poll(): Promise<void>
  /** `poll`, logging a failure instead of rejecting; the next tick retries. */
  pollSafely(): Promise<void>
  /** Called after anything the view shows has changed. */
  subscribe(listener: () => void): () => void
}

const operatorHex = (store: Store): string | undefined => operatorPubkey(store.settings())

const isRetiring = (status: AgentStatus | undefined): boolean =>
  status === 'retire-requested' || status === 'retired'

/**
 * Retire is offered unless the agent is retiring, or it is a setup on this device whose
 * install-request was never attempted: nothing can run it, and Delete frees it instead.
 */
const canRetire = (store: Store, pubkey: string, status: AgentStatus | undefined): boolean =>
  !isRetiring(status) && !(status === undefined && store.pending().some((p) => p.pubkey === pubkey))

const statusView = (
  store: Store,
  pubkey: string,
  texts: Record<AgentStatus | 'none', string>,
): AgentStatusView => {
  const status = store.statusOf(pubkey)
  return {
    text: texts[status ?? 'none'],
    canRetire: canRetire(store, pubkey, status),
    canCancelRetire: status === 'retire-requested',
  }
}

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

/** A slot whose setup was never sent stays offered, so the owner can retry or delete it. */
const isSent = (store: Store, slot: string): boolean => {
  const pending = store.pendingFor(slot)
  return pending !== undefined && store.statusOf(pending.pubkey) !== undefined
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
    .filter((offer) => offer.community === community && !isSent(store, offer.slot))
    .map(({ slot, label }) => ({ slot, label })),
  agents: ourAgents(agents).map((agent) => {
    const { text, ...actions } = statusView(store, agent.pubkey, STATUS_TEXT)
    return { pubkey: agent.pubkey, name: agent.name, status: text, ...actions }
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

  const readOperator = async (): Promise<void> => {
    let opened: Awaited<ReturnType<typeof open>>
    try {
      opened = await open()
    } catch {
      return // Not connected yet: nothing to read.
    }
    const { store, viewer, community } = opened
    const operator = operatorHex(store)
    // The operator's own blocks are applied locally; Buzz 1.0.5 has no DM with oneself.
    if (operator === undefined || operator === viewer) return
    const messages = await deps.relay.readBlocks(operator)
    applyOperatorBlocks(store, messages, { operator, viewer, community })
    notify()
  }
  const { poll, pollSafely } = createPoll(readOperator, 'reading operator messages')

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

    agentStatus: async (pubkey) => {
      const { store } = await open()
      return statusView(store, pubkey, TAB_STATUS_TEXT)
    },

    retire: async (pubkey) => {
      const { store, viewer } = await open()
      const operator = operatorHex(store)
      if (operator === undefined) throw new Error(NO_OPERATOR)
      const ours = ourAgents(deps.agents.snapshot().agents).some((a) => a.pubkey === pubkey)
      if (!ours || !canRetire(store, pubkey, store.statusOf(pubkey))) throw new Error(NOT_RETIRABLE)
      const slot = store.pending().find((p) => p.pubkey === pubkey)?.slot ?? ADOPTED_SLOT
      const request: RetireRequest = { v: 1, type: 'retire-request', slot, pubkey }
      // The owner is the operator too: list the request locally, no DM to self.
      if (operator === viewer)
        await receiveOwnRequest(store, request, {
          viewer,
          readProfile: (key) => deps.relay.readProfile(key),
        })
      else await deps.relay.sendBlock(operator, request)
      store.requestRetire(pubkey)
      notify()
    },

    cancelRetire: async (pubkey) => {
      const { store } = await open()
      if (store.statusOf(pubkey) !== 'retire-requested') throw new Error(NO_RETIRE_REQUEST)
      store.cancelRetire(pubkey)
      notify()
    },

    poll,
    pollSafely,

    subscribe: (listener) => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}
