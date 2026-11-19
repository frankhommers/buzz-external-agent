import { decodeNpub, encodeNpub } from '../core/keys'
import {
  type AcceptContext,
  acceptBlock,
  type Installed,
  type InstallRequest,
  isSlotId,
  isSlotLabel,
  type Retired,
  type SlotOffer,
} from '../core/messages'
import { verifyNipOa } from '../core/nipoa'
import { parseHostKey } from '../core/seal'
import { type OperatorSlot, operatorPubkey, type Store } from '../core/store'
import { renderTemplate, type TemplateVars } from '../core/template'
import { createPoll } from './poll'
import type { BlockMessage, Relay } from './relay'

const BAD_OWNER = 'Enter the owner as an npub'
const BAD_SLOT_ID = 'The slot id may only use lowercase letters, digits and dashes'
const BAD_LABEL = 'Give the server a label of at most 80 characters'
const ALREADY_OFFERED = 'This server was already offered'
const BAD_IMPORT = 'Import must be a JSON list of {"slot", "label", "hostKey"} objects'
const UNKNOWN_REQUEST = 'There is no open request for this agent'

/** Slot states in which the owner may still send an install-request. */
const REQUESTABLE: ReadonlySet<OperatorSlot['state']> = new Set(['offered', 'requested'])
/** Slot states whose owner the operator still reads requests from. */
const ACTIVE: ReadonlySet<OperatorSlot['state']> = new Set(['offered', 'requested', 'installed'])
/** Slot states in which an agent may be on the server. */
const RETIRABLE: ReadonlySet<OperatorSlot['state']> = new Set(['requested', 'installed'])

/** Sample values that make every placeholder resolve, to check a template before saving. */
const SAMPLE_VARS: TemplateVars = {
  name: 'name',
  slot: 'slot',
  host: 'host',
  pubkey: 'pubkey',
  npub: 'npub',
  auth_tag: 'auth_tag',
  file: 'file',
}

export type OfferInput = { slot: string; label: string; hostKeyText: string; owner: string }

export type Handoff = { filename: string; fileText: string; publicJson: string; command?: string }

export type Rejection = {
  type: 'install-request' | 'retire-request'
  slot: string
  pubkey: string
  reason: string
}

export type SlotRow = {
  slot: string
  label: string
  fingerprint: string
  /** The owner's npub, or '' while the slot is not offered. */
  owner: string
  state: OperatorSlot['state']
}
export type InstallRow = {
  pubkey: string
  name: string
  slot: string
  label: string
  owner: string
  handoff: Handoff
  commandError?: string
}
export type RetireRow = { pubkey: string; slot: string; label: string; owner: string }
export type OperatorView = {
  template: string
  slots: SlotRow[]
  installs: InstallRow[]
  retires: RetireRow[]
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const slotNamed = (store: Store, slot: string): OperatorSlot | undefined =>
  store.slots().find((s) => s.slot === slot)

const checkSlotId = (slot: string): void => {
  if (!isSlotId(slot)) throw new Error(BAD_SLOT_ID)
}

const checkLabel = (label: string): void => {
  if (label === '' || !isSlotLabel(label)) throw new Error(BAD_LABEL)
}

/** Stores the slot and sends a `slot-offer` to the owner; a slot is offered once. */
export const offerSlot = async (
  relay: Pick<Relay, 'ready' | 'sendBlock'>,
  store: Store,
  input: OfferInput,
): Promise<void> => {
  const slot = input.slot.trim()
  const label = input.label.trim()
  checkSlotId(slot)
  checkLabel(label)
  const host = parseHostKey(input.hostKeyText)
  let owner: string
  try {
    owner = decodeNpub(input.owner.trim())
  } catch {
    throw new Error(BAD_OWNER)
  }
  const existing = slotNamed(store, slot)
  if (existing !== undefined && existing.state !== 'open') throw new Error(ALREADY_OFFERED)
  const { community } = await relay.ready()
  store.putSlot({ slot, label, host, state: 'open' })
  const offer: SlotOffer = { v: 1, type: 'slot-offer', slot, label, hostKey: host.line, community }
  await relay.sendBlock(owner, offer)
  store.putSlot({ slot, label, host, owner, state: 'offered' })
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Parses a JSON list of `{slot, label, hostKey}` into open slots; does not save them. */
export const importSlots = (
  text: string,
  existing: readonly OperatorSlot[] = [],
): OperatorSlot[] => {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(BAD_IMPORT)
  }
  if (!Array.isArray(parsed)) throw new Error(BAD_IMPORT)
  const taken = new Set(existing.map((s) => s.slot))
  const seen = new Set<string>()
  return parsed.map((item: unknown, index): OperatorSlot => {
    if (
      !isRecord(item) ||
      typeof item.slot !== 'string' ||
      typeof item.label !== 'string' ||
      typeof item.hostKey !== 'string'
    )
      throw new Error(`Item ${index + 1}: ${BAD_IMPORT}`)
    const slot = item.slot.trim()
    const label = item.label.trim()
    try {
      checkSlotId(slot)
      checkLabel(label)
    } catch (error) {
      throw new Error(`Item ${index + 1}: ${messageOf(error)}`)
    }
    if (seen.has(slot)) throw new Error(`Duplicate slot id "${slot}"`)
    if (taken.has(slot)) throw new Error(`Slot "${slot}" already exists`)
    seen.add(slot)
    let host: OperatorSlot['host']
    try {
      host = parseHostKey(item.hostKey)
    } catch (error) {
      throw new Error(`Slot "${slot}": ${messageOf(error)}`)
    }
    return { slot, label, host, state: 'open' }
  })
}

/**
 * What the operator needs to install an agent: the sealed key file, the public data and,
 * with a template, the rendered command. Template values are shell-quoted by renderTemplate.
 */
export const handoff = (
  request: InstallRequest,
  slot: OperatorSlot,
  template?: string,
): Handoff => {
  const { name, pubkey, auth } = request
  const filename = `${slot.slot}.age`
  const result: Handoff = {
    filename,
    fileText: request.sealed,
    publicJson: JSON.stringify({ name, host: slot.label, pubkey, auth_tag: auth }, null, 2),
  }
  if (template === undefined || template.trim() === '') return result
  result.command = renderTemplate(template, {
    name,
    slot: slot.slot,
    host: slot.label,
    pubkey,
    npub: encodeNpub(pubkey),
    auth_tag: JSON.stringify(auth),
    file: filename,
  })
  return result
}

/** Tells the agent's owner it is installed or retired, then records that on the slot. */
export const confirm = async (
  relay: Pick<Relay, 'sendBlock'>,
  store: Store,
  kind: 'installed' | 'retired',
  pubkey: string,
): Promise<void> => {
  const requests = kind === 'installed' ? store.requests() : store.retireRequests()
  const request = requests.find((r) => r.pubkey === pubkey)
  const slot = request === undefined ? undefined : slotNamed(store, request.slot)
  const allowed =
    kind === 'installed' ? slot?.state === 'requested' : RETIRABLE.has(slot?.state ?? 'open')
  if (request === undefined || slot?.owner === undefined || !allowed)
    throw new Error(UNKNOWN_REQUEST)
  const block: Installed | Retired = { v: 1, type: kind, slot: slot.slot, pubkey }
  await relay.sendBlock(slot.owner, block)
  store.putSlot({ ...slot, state: kind })
}

const offeredTo = (slot: OperatorSlot | undefined, owner: string): slot is OperatorSlot =>
  slot !== undefined && slot.owner === owner

/**
 * Applies requests from one owner's DM. An install-request is listed only when its owner proof
 * verifies, names the sender, and its slot was offered to that sender and is still open for it.
 * Returns what was refused; requests already listed are skipped silently.
 */
export const applyOwnerBlocks = (
  store: Store,
  messages: readonly BlockMessage[],
  context: AcceptContext & { owner: string },
): Rejection[] => {
  const rejected: Rejection[] = []
  for (const { sender, block } of messages) {
    if (!acceptBlock(block, sender, context)) continue
    if (block.type !== 'install-request' && block.type !== 'retire-request') continue
    const refuse = (reason: string): void => {
      rejected.push({ type: block.type, slot: block.slot, pubkey: block.pubkey, reason })
    }
    const known = (
      block.type === 'install-request' ? store.requests() : store.retireRequests()
    ).some((r) => r.pubkey === block.pubkey && r.slot === block.slot)
    if (known) continue
    if (sender !== context.owner) {
      refuse('not sent by this owner')
      continue
    }
    const slot = slotNamed(store, block.slot)
    if (block.type === 'install-request') {
      if (!verifyNipOa(block.auth, block.pubkey)) refuse('owner proof does not verify')
      else if (block.auth[1] !== sender) refuse('owner proof names someone else')
      else if (!offeredTo(slot, sender) || !REQUESTABLE.has(slot.state))
        refuse('not a server offered to this owner')
      else {
        store.addRequest(block)
        store.putSlot({ ...slot, state: 'requested' })
      }
    } else if (!offeredTo(slot, sender) || !RETIRABLE.has(slot.state)) {
      refuse('not a server offered to this owner')
    } else if (!store.requests().some((r) => r.pubkey === block.pubkey && r.slot === slot.slot)) {
      refuse('not an agent requested on this server')
    } else {
      store.addRetireRequest(block)
    }
  }
  return rejected
}

const npubOf = (pubkey: string | undefined): string =>
  pubkey === undefined ? '' : encodeNpub(pubkey)

export const buildOperatorView = (store: Store): OperatorView => {
  const template = store.settings().template ?? ''
  const slots = store.slots()
  const byId = new Map(slots.map((s) => [s.slot, s]))
  const installs: InstallRow[] = []
  for (const request of store.requests()) {
    const slot = byId.get(request.slot)
    if (slot?.state !== 'requested') continue
    const row = {
      pubkey: request.pubkey,
      name: request.name,
      slot: slot.slot,
      label: slot.label,
      owner: npubOf(slot.owner),
    }
    try {
      installs.push({ ...row, handoff: handoff(request, slot, template) })
    } catch (error) {
      installs.push({ ...row, handoff: handoff(request, slot), commandError: messageOf(error) })
    }
  }
  const retires: RetireRow[] = []
  for (const request of store.retireRequests()) {
    const slot = byId.get(request.slot)
    if (slot === undefined || !RETIRABLE.has(slot.state)) continue
    retires.push({
      pubkey: request.pubkey,
      slot: slot.slot,
      label: slot.label,
      owner: npubOf(slot.owner),
    })
  }
  return {
    template,
    slots: slots.map((s) => ({
      slot: s.slot,
      label: s.label,
      fingerprint: s.host.fingerprint,
      owner: npubOf(s.owner),
      state: s.state,
    })),
    installs,
    retires,
  }
}

export interface OperatorDeps {
  relay: Relay
  /** Plugin state for one community origin and viewer. */
  storeFor(scope: { origin: string; viewer: string }): Store
}

export interface Operator {
  /** The operator's view, or undefined when the viewer is not the configured operator. */
  view(): Promise<OperatorView | undefined>
  offer(input: OfferInput): Promise<void>
  /** Offers an imported (open) slot to the owner npub. */
  offerOpen(slot: string, owner: string): Promise<void>
  /** Saves the slots from a JSON list as open; returns how many were added. */
  importSlots(text: string): Promise<number>
  /** Saves the command template; rejects unknown placeholders. */
  saveTemplate(template: string): Promise<void>
  confirm(kind: 'installed' | 'retired', pubkey: string): Promise<void>
  /** Reads the DM with every owner of an active slot. No-op unless the viewer is the operator. */
  poll(): Promise<void>
  /** `poll`, logging a failure instead of rejecting; the next tick retries. */
  pollSafely(): Promise<void>
  /** Called after anything the view shows has changed. */
  subscribe(listener: () => void): () => void
}

export const createOperator = (deps: OperatorDeps): Operator => {
  const listeners = new Set<() => void>()
  const notify = (): void => {
    for (const listener of [...listeners]) listener()
  }
  // Each refusal is logged once per session, not on every poll.
  const warned = new Set<string>()

  const open = async (): Promise<{ store: Store; viewer: string; isOperator: boolean }> => {
    const { origin, viewer } = await deps.relay.ready()
    const store = deps.storeFor({ origin, viewer })
    return { store, viewer, isOperator: operatorPubkey(store.settings()) === viewer }
  }

  const openAsOperator = async (): Promise<Store> => {
    const { store, isOperator } = await open()
    if (!isOperator) throw new Error('Only the operator can do this')
    return store
  }

  const readOwners = async (): Promise<void> => {
    let opened: Awaited<ReturnType<typeof open>>
    try {
      opened = await open()
    } catch {
      return // Not connected yet: nothing to read.
    }
    const { store, viewer, isOperator } = opened
    if (!isOperator) return
    const owners = new Set(
      store
        .slots()
        .filter((s) => ACTIVE.has(s.state))
        .flatMap((s) => (s.owner === undefined ? [] : [s.owner])),
    )
    const failures: string[] = []
    for (const owner of owners) {
      try {
        const messages = await deps.relay.readBlocks(owner)
        const context = { operator: viewer, viewer, owner }
        for (const r of applyOwnerBlocks(store, messages, context)) {
          const key = `${r.type}:${r.slot}:${r.pubkey}:${r.reason}`
          if (warned.has(key)) continue
          warned.add(key)
          console.warn(
            `Self-hosted agents: ignored ${r.type} for slot ${r.slot}, agent ${r.pubkey}: ${r.reason}`,
          )
        }
      } catch (error) {
        failures.push(messageOf(error))
      }
    }
    notify()
    if (failures.length > 0) throw new Error(failures.join('; '))
  }
  const { poll, pollSafely } = createPoll(readOwners, 'reading owner messages')

  return {
    view: async () => {
      const { store, isOperator } = await open()
      return isOperator ? buildOperatorView(store) : undefined
    },

    offer: async (input) => {
      const store = await openAsOperator()
      await offerSlot(deps.relay, store, input)
      notify()
    },

    offerOpen: async (slotId, owner) => {
      const store = await openAsOperator()
      const slot = slotNamed(store, slotId)
      if (slot?.state !== 'open') throw new Error(ALREADY_OFFERED)
      await offerSlot(deps.relay, store, {
        slot: slot.slot,
        label: slot.label,
        hostKeyText: slot.host.line,
        owner,
      })
      notify()
    },

    importSlots: async (text) => {
      const store = await openAsOperator()
      const slots = importSlots(text, store.slots())
      for (const slot of slots) store.putSlot(slot)
      notify()
      return slots.length
    },

    saveTemplate: async (template) => {
      const store = await openAsOperator()
      renderTemplate(template, SAMPLE_VARS)
      store.setSettings({ ...store.settings(), template })
      notify()
    },

    confirm: async (kind, pubkey) => {
      const store = await openAsOperator()
      await confirm(deps.relay, store, kind, pubkey)
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
