import { ADOPTED_SLOT } from '../constants'
import { profileOwner, type SignedEvent, verifyEvent } from '../core/events'
import { decodeNpub, encodeNpub } from '../core/keys'
import {
  type AcceptContext,
  acceptBlock,
  type Block,
  type Installed,
  type InstallRequest,
  isSlotId,
  isSlotLabel,
  type Retired,
  type RetireRequest,
  type SlotOffer,
} from '../core/messages'
import { verifyNipOa } from '../core/nipoa'
import { parseHostKey } from '../core/seal'
import {
  type OperatorRetireRequest,
  type OperatorSlot,
  operatorPubkey,
  type Store,
} from '../core/store'
import { renderTemplate, type TemplateVars } from '../core/template'
import { createPoll } from './poll'
import type { BlockMessage, Relay } from './relay'

const BAD_OWNER = 'Enter the owner as an npub'
const BAD_SLOT_ID = 'The slot id may only use lowercase letters, digits and dashes'
const RESERVED_SLOT_ID = `The slot id "${ADOPTED_SLOT}" is reserved`
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
/** Which request a confirmation is for: its slot, agent and owner (hex). */
export type RequestId = { slot: string; pubkey: string; owner: string }

export type InstallRow = {
  id: RequestId
  pubkey: string
  name: string
  slot: string
  label: string
  owner: string
  handoff: Handoff
  commandError?: string
}
export type RetireRow = {
  id: RequestId
  pubkey: string
  slot: string
  label: string
  owner: string
}
/** A retire request for an existing agent brought into Buzz (no slot). */
export type AdoptedRetireRow = { id: RequestId; pubkey: string; name: string; owner: string }
export type OperatorView = {
  template: string
  /** Known owners (npubs) whose DMs are read besides slot owners. */
  owners: string[]
  slots: SlotRow[]
  installs: InstallRow[]
  retires: RetireRow[]
  adopted: AdoptedRetireRow[]
}

export interface OwnerBlocksContext extends AcceptContext {
  /** The owner whose DM the messages come from. */
  owner: string
  readProfile(pubkey: string): Promise<SignedEvent | undefined>
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const slotNamed = (store: Store, slot: string): OperatorSlot | undefined =>
  store.slots().find((s) => s.slot === slot)

/**
 * Sends an operator → owner block. When that owner is the operator itself, there is no DM:
 * the block is applied locally the way the owner side applies it (applyOperatorBlocks).
 */
const deliver = async (
  relay: Pick<Relay, 'ready' | 'sendBlock'>,
  store: Store,
  to: string,
  block: SlotOffer | Installed | Retired,
): Promise<void> => {
  const { viewer } = await relay.ready()
  if (to !== viewer) return relay.sendBlock(to, block)
  if (block.type === 'slot-offer') store.addOffer(block)
  else if (block.type === 'retired') store.markRetired(block.pubkey)
  else {
    // A late installed never downgrades an agent that is being retired.
    const status = store.statusOf(block.pubkey)
    if (status !== 'retire-requested' && status !== 'retired') store.markInstalled(block.pubkey)
  }
}

const checkSlotId = (slot: string): void => {
  if (!isSlotId(slot)) throw new Error(BAD_SLOT_ID)
  if (slot === ADOPTED_SLOT) throw new Error(RESERVED_SLOT_ID)
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
  await deliver(relay, store, owner, offer)
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

/** Tells the request's owner the agent is installed or retired, then records that. */
export const confirm = async (
  relay: Pick<Relay, 'ready' | 'sendBlock'>,
  store: Store,
  kind: 'installed' | 'retired',
  id: RequestId,
): Promise<void> => {
  const { slot: slotId, pubkey, owner } = id
  if (kind === 'installed') {
    const request = store.requests().find((r) => r.slot === slotId && r.pubkey === pubkey)
    const slot = request === undefined ? undefined : slotNamed(store, slotId)
    if (slot?.owner !== owner || slot.state !== 'requested') throw new Error(UNKNOWN_REQUEST)
    const block: Installed = { v: 1, type: 'installed', slot: slotId, pubkey }
    await deliver(relay, store, owner, block)
    store.putSlot({ ...slot, state: 'installed' })
    return
  }
  const request = store
    .retireRequests()
    .find(
      (r) => r.slot === slotId && r.pubkey === pubkey && r.owner === owner && r.retired !== true,
    )
  if (request === undefined) throw new Error(UNKNOWN_REQUEST)
  const block: Retired = { v: 1, type: 'retired', slot: slotId, pubkey }
  if (slotId === ADOPTED_SLOT) {
    // No slot: the request's verified sender is the agent's owner.
    await deliver(relay, store, owner, block)
  } else {
    const slot = slotNamed(store, slotId)
    if (slot?.owner !== owner || !RETIRABLE.has(slot.state)) throw new Error(UNKNOWN_REQUEST)
    await deliver(relay, store, owner, block)
    store.putSlot({ ...slot, state: 'retired' })
  }
  store.addRetireRequest({ ...request, retired: true })
}

const offeredTo = (slot: OperatorSlot | undefined, owner: string): slot is OperatorSlot =>
  slot !== undefined && slot.owner === owner

const profileName = (profile: SignedEvent): string | undefined => {
  try {
    const content: unknown = JSON.parse(profile.content)
    if (typeof content !== 'object' || content === null) return undefined
    const name = (content as Record<string, unknown>).name
    return typeof name === 'string' && name.trim() !== '' ? name.trim() : undefined
  } catch {
    return undefined
  }
}

/** The owner named by the agent's own signed profile, if it verifies. */
const verifiedProfileOwner = (
  profile: SignedEvent | undefined,
  pubkey: string,
): string | undefined =>
  profile !== undefined && profile.pubkey === pubkey && verifyEvent(profile)
    ? profileOwner(profile)
    : undefined

interface RequestContext {
  /** The owner the request comes from (the DM peer, or the operator itself). */
  owner: string
  readProfile(pubkey: string): Promise<SignedEvent | undefined>
}

/**
 * Lists one owner request, or returns why it was refused. An install-request is listed only when
 * its owner proof verifies and names the sender, the agent's own signed profile names the sender as
 * owner, its slot was offered to that sender and is still open for it, and the agent is not
 * requested on another slot; it replaces older requests for its slot. A retire-request needs a slot offered to the sender with that agent requested on it or, for
 * an adopted agent, an agent profile whose verified owner is the sender.
 * Requests already listed for this sender are skipped silently.
 */
const applyRequest = async (
  store: Store,
  sender: string,
  block: InstallRequest | RetireRequest,
  context: RequestContext,
): Promise<string | undefined> => {
  if (block.type === 'install-request') {
    if (store.requests().some((r) => r.pubkey === block.pubkey && r.slot === block.slot)) return
  } else if (
    store
      .retireRequests()
      .some((r) => r.pubkey === block.pubkey && r.slot === block.slot && r.owner === sender)
  )
    return
  if (sender !== context.owner) return 'not sent by this owner'
  const slot = slotNamed(store, block.slot)
  if (block.type === 'install-request') {
    if (!verifyNipOa(block.auth, block.pubkey)) return 'owner proof does not verify'
    if (block.auth[1] !== sender) return 'owner proof names someone else'
    // An agent key is public from its profile on: anyone can sign a proof for it. Only the owner
    // named by the agent's own signed profile may request it. Not stored, so retried next poll.
    const profileOwnerOf = verifiedProfileOwner(
      await context.readProfile(block.pubkey),
      block.pubkey,
    )
    if (profileOwnerOf === undefined) return 'agent profile missing or unverified'
    if (profileOwnerOf !== sender) return 'agent is owned by someone else'
    if (!offeredTo(slot, sender) || !REQUESTABLE.has(slot.state))
      return 'not a server offered to this owner'
    // A new key per setup: the same agent on another slot is someone else's request.
    if (store.requests().some((r) => r.pubkey === block.pubkey && r.slot !== block.slot))
      return 'agent already requested on another server'
    store.putSlotRequest(block)
    store.putSlot({ ...slot, state: 'requested' })
    return
  }
  if (block.slot === ADOPTED_SLOT) {
    const profile = await context.readProfile(block.pubkey)
    const owner = verifiedProfileOwner(profile, block.pubkey)
    if (owner === undefined) return 'agent profile missing or unverified'
    if (owner !== sender) return 'agent is owned by someone else'
    const name = profile === undefined ? undefined : profileName(profile)
    store.addRetireRequest({ ...block, owner: sender, ...(name === undefined ? {} : { name }) })
    return
  }
  if (!offeredTo(slot, sender) || !RETIRABLE.has(slot.state))
    return 'not a server offered to this owner'
  if (!store.requests().some((r) => r.pubkey === block.pubkey && r.slot === slot.slot))
    return 'not an agent requested on this server'
  store.addRetireRequest({ ...block, owner: sender })
  return
}

/**
 * Applies requests from one owner's DM (see applyRequest); only the newest install-request per
 * slot counts. Returns what was refused.
 */
export const applyOwnerBlocks = async (
  store: Store,
  messages: readonly BlockMessage[],
  context: OwnerBlocksContext,
): Promise<Rejection[]> => {
  const rejected: Rejection[] = []
  const accepted = messages.filter(({ sender, block }) => acceptBlock(block, sender, context))
  // An owner who set a slot up again (new key) superseded the earlier request for it.
  const newestInstall = new Map<string, Block>()
  for (const { block } of accepted)
    if (block.type === 'install-request') newestInstall.set(block.slot, block)

  for (const { sender, block } of accepted) {
    if (block.type !== 'install-request' && block.type !== 'retire-request') continue
    if (block.type === 'install-request' && newestInstall.get(block.slot) !== block) continue
    const reason = await applyRequest(store, sender, block, context)
    if (reason !== undefined)
      rejected.push({ type: block.type, slot: block.slot, pubkey: block.pubkey, reason })
  }
  return rejected
}

/**
 * The operator's own request as owner: no DM to self, the same gates as a received request.
 * Throws the refusal.
 */
export const receiveOwnRequest = async (
  store: Store,
  block: InstallRequest | RetireRequest,
  context: { viewer: string; readProfile(pubkey: string): Promise<SignedEvent | undefined> },
): Promise<void> => {
  const reason = await applyRequest(store, context.viewer, block, {
    owner: context.viewer,
    readProfile: context.readProfile,
  })
  if (reason !== undefined) throw new Error(`The request was refused: ${reason}`)
}

const npubOf = (pubkey: string | undefined): string =>
  pubkey === undefined ? '' : encodeNpub(pubkey)

const isOpenAdopted = (request: OperatorRetireRequest): boolean =>
  request.slot === ADOPTED_SLOT && request.retired !== true

export const buildOperatorView = (store: Store): OperatorView => {
  const settings = store.settings()
  const template = settings.template ?? ''
  const slots = store.slots()
  const byId = new Map(slots.map((s) => [s.slot, s]))
  const installs: InstallRow[] = []
  for (const request of store.requests()) {
    const slot = byId.get(request.slot)
    if (slot?.state !== 'requested') continue
    const row = {
      id: { slot: slot.slot, pubkey: request.pubkey, owner: slot.owner ?? '' },
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
  const retireRequests = store.retireRequests()
  for (const request of retireRequests) {
    const slot = request.slot === ADOPTED_SLOT ? undefined : byId.get(request.slot)
    if (slot === undefined || !RETIRABLE.has(slot.state) || request.retired === true) continue
    retires.push({
      id: { slot: slot.slot, pubkey: request.pubkey, owner: request.owner },
      pubkey: request.pubkey,
      slot: slot.slot,
      label: slot.label,
      owner: npubOf(request.owner),
    })
  }
  return {
    template,
    owners: (settings.owners ?? []).map(encodeNpub),
    slots: slots.map((s) => ({
      slot: s.slot,
      label: s.label,
      fingerprint: s.host.fingerprint,
      owner: npubOf(s.owner),
      state: s.state,
    })),
    installs,
    retires,
    adopted: retireRequests.filter(isOpenAdopted).map((request) => ({
      id: { slot: request.slot, pubkey: request.pubkey, owner: request.owner },
      pubkey: request.pubkey,
      name: request.name ?? encodeNpub(request.pubkey),
      owner: encodeNpub(request.owner),
    })),
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
  /** Saves known owners from npubs separated by spaces, commas or lines; rejects anything else. */
  saveOwners(text: string): Promise<void>
  /** Saves the command template; rejects unknown placeholders. */
  saveTemplate(template: string): Promise<void>
  confirm(kind: 'installed' | 'retired', id: RequestId): Promise<void>
  /**
   * Reads the DM with every owner of an active slot and every known owner.
   * No-op unless the viewer is the operator.
   */
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
    const owners = new Set([
      ...store
        .slots()
        .filter((s) => ACTIVE.has(s.state))
        .flatMap((s) => (s.owner === undefined ? [] : [s.owner])),
      ...(store.settings().owners ?? []),
    ])
    // The operator's own requests are listed locally (receiveOwnRequest): no DM with itself.
    owners.delete(viewer)
    const failures: string[] = []
    for (const owner of owners) {
      try {
        const messages = await deps.relay.readBlocks(owner)
        const context = {
          operator: viewer,
          viewer,
          owner,
          readProfile: (pubkey: string) => deps.relay.readProfile(pubkey),
        }
        for (const r of await applyOwnerBlocks(store, messages, context)) {
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

    saveOwners: async (text) => {
      const store = await openAsOperator()
      const owners: string[] = []
      for (const token of text.split(/[\s,]+/).filter((t) => t !== '')) {
        let owner: string
        try {
          owner = decodeNpub(token)
        } catch {
          throw new Error(`Not an npub: ${token}`)
        }
        if (!owners.includes(owner)) owners.push(owner)
      }
      store.setSettings({ ...store.settings(), owners })
      notify()
    },

    saveTemplate: async (template) => {
      const store = await openAsOperator()
      renderTemplate(template, SAMPLE_VARS)
      store.setSettings({ ...store.settings(), template })
      notify()
    },

    confirm: async (kind, id) => {
      const store = await openAsOperator()
      await confirm(deps.relay, store, kind, id)
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
