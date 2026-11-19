import { STORAGE_PREFIX } from '../constants'
import type { SignedEvent } from './events'
import { decodeNpub, isHex64 } from './keys'
import type { InstallRequest, RetireRequest, SlotOffer } from './messages'
import type { HostKey } from './seal'

export type PendingSetup = {
  slot: string
  community: string
  owner: string
  hostFingerprint: string
  pubkey: string
  sealed: string
  profile: SignedEvent
  name: string
  picture?: string
}

export type OperatorSlot = {
  slot: string
  label: string
  host: HostKey
  owner?: string
  state: 'open' | 'offered' | 'requested' | 'installed' | 'retired'
}

export type AgentStatus = 'awaiting-install' | 'installed' | 'retire-requested' | 'retired'

/** A retire request as the operator keeps it: with its sender and, for adopted agents, name. */
export type OperatorRetireRequest = RetireRequest & {
  owner: string
  name?: string
  /** Set once the operator confirmed it (for adopted agents, which have no slot state). */
  retired?: true
}

/** `owners`: known owner pubkeys (hex) whose DMs the operator reads besides slot owners. */
export type Settings = { operator?: string; template?: string; owners?: string[] }

/** The configured operator as hex, or undefined when unset or not a valid key. */
export const operatorPubkey = (settings: Settings): string | undefined => {
  const operator = settings.operator?.trim()
  if (!operator) return undefined
  if (isHex64(operator)) return operator
  try {
    return decodeNpub(operator)
  } catch {
    return undefined
  }
}

export interface Store {
  settings(): Settings
  setSettings(settings: Settings): void
  offers(): SlotOffer[]
  addOffer(offer: SlotOffer): void
  pending(): PendingSetup[]
  putPending(pending: PendingSetup): void
  pendingFor(slot: string): PendingSetup | undefined
  deletePending(pubkey: string): void
  markInstalled(pubkey: string): void
  markRetired(pubkey: string): void
  isRetired(pubkey: string): boolean
  statusOf(pubkey: string): AgentStatus | undefined
  setStatus(pubkey: string, status: AgentStatus): void
  /** Marks the agent retire-requested, remembering its status from before. */
  requestRetire(pubkey: string): void
  /**
   * Undoes a local retire-requested: back to the remembered status (none for an agent that had
   * none), or installed when nothing was remembered. Any other status is left alone.
   */
  cancelRetire(pubkey: string): void
  slots(): OperatorSlot[]
  putSlot(slot: OperatorSlot): void
  requests(): InstallRequest[]
  /** Upserts by slot and agent pubkey. */
  addRequest(request: InstallRequest): void
  /** Stores the request as the only one for its slot; other slots are untouched. */
  putSlotRequest(request: InstallRequest): void
  retireRequests(): OperatorRetireRequest[]
  /** Upserts by owner and agent pubkey. */
  addRetireRequest(request: OperatorRetireRequest): void
}

/** What `prior-status` remembers for an agent that had no status before its retire request. */
const NO_STATUS = 'none'

const SECRET_PATTERN = /nsec1[02-9ac-hj-np-z]{20,}/i
const STATUSES: ReadonlySet<string> = new Set([
  'awaiting-install',
  'installed',
  'retire-requested',
  'retired',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const upsert = <T>(list: T[], item: T, same: (a: T) => boolean): T[] => {
  const index = list.findIndex(same)
  return index < 0 ? [...list, item] : list.map((existing, i) => (i === index ? item : existing))
}

export const createStore = (storage: Storage, scope: { origin: string; viewer: string }): Store => {
  const keyFor = (name: string): string =>
    `${STORAGE_PREFIX}${encodeURIComponent(scope.origin)}:${scope.viewer}:${name}`

  const read = (name: string): unknown => {
    try {
      const raw = storage.getItem(keyFor(name))
      return raw === null ? undefined : JSON.parse(raw)
    } catch {
      return undefined
    }
  }

  const write = (name: string, value: unknown): void => {
    const serialized = JSON.stringify(value)
    if (SECRET_PATTERN.test(serialized)) {
      throw new Error('Refusing to store secret material')
    }
    storage.setItem(keyFor(name), serialized)
  }

  const readList = <T>(name: string): T[] => {
    const value = read(name)
    return Array.isArray(value) ? (value.filter(isRecord) as T[]) : []
  }

  const readStatuses = (): Record<string, AgentStatus> => {
    const value = read('status')
    if (!isRecord(value)) {
      return {}
    }
    const result: Record<string, AgentStatus> = {}
    for (const [pubkey, status] of Object.entries(value)) {
      if (typeof status === 'string' && STATUSES.has(status)) {
        result[pubkey] = status as AgentStatus
      }
    }
    return result
  }

  const setStatus = (pubkey: string, status: AgentStatus): void =>
    write('status', { ...readStatuses(), [pubkey]: status })

  const readPriors = (): Record<string, string> => {
    const value = read('prior-status')
    if (!isRecord(value)) return {}
    const result: Record<string, string> = {}
    for (const [pubkey, prior] of Object.entries(value))
      if (prior === NO_STATUS || (typeof prior === 'string' && STATUSES.has(prior)))
        result[pubkey] = prior
    return result
  }

  const withoutKey = <T>(record: Record<string, T>, key: string): Record<string, T> =>
    Object.fromEntries(Object.entries(record).filter(([k]) => k !== key))

  return {
    settings: () => {
      const value = read('settings')
      if (!isRecord(value)) {
        return {}
      }
      const settings: Settings = {}
      if (typeof value.operator === 'string') {
        settings.operator = value.operator
      }
      if (typeof value.template === 'string') {
        settings.template = value.template
      }
      if (Array.isArray(value.owners)) {
        settings.owners = value.owners.filter(
          (owner): owner is string => typeof owner === 'string' && isHex64(owner),
        )
      }
      return settings
    },
    setSettings: (settings) => write('settings', settings),
    offers: () => readList<SlotOffer>('offers'),
    addOffer: (offer) =>
      write(
        'offers',
        upsert(readList<SlotOffer>('offers'), offer, (o) => o.slot === offer.slot),
      ),
    pending: () => readList<PendingSetup>('pending'),
    putPending: (pending) =>
      write(
        'pending',
        upsert(readList<PendingSetup>('pending'), pending, (p) => p.slot === pending.slot),
      ),
    pendingFor: (slot) => readList<PendingSetup>('pending').find((p) => p.slot === slot),
    deletePending: (pubkey) =>
      write(
        'pending',
        readList<PendingSetup>('pending').filter((p) => p.pubkey !== pubkey),
      ),
    markInstalled: (pubkey) => setStatus(pubkey, 'installed'),
    markRetired: (pubkey) => setStatus(pubkey, 'retired'),
    isRetired: (pubkey) => readStatuses()[pubkey] === 'retired',
    statusOf: (pubkey) => readStatuses()[pubkey],
    setStatus,
    requestRetire: (pubkey) => {
      write('prior-status', { ...readPriors(), [pubkey]: readStatuses()[pubkey] ?? NO_STATUS })
      setStatus(pubkey, 'retire-requested')
    },
    cancelRetire: (pubkey) => {
      const statuses = readStatuses()
      if (statuses[pubkey] !== 'retire-requested') return
      const priors = readPriors()
      const prior = priors[pubkey] ?? 'installed'
      write(
        'status',
        prior === NO_STATUS
          ? withoutKey(statuses, pubkey)
          : { ...statuses, [pubkey]: prior as AgentStatus },
      )
      write('prior-status', withoutKey(priors, pubkey))
    },
    slots: () => readList<OperatorSlot>('slots'),
    putSlot: (slot) =>
      write(
        'slots',
        upsert(readList<OperatorSlot>('slots'), slot, (s) => s.slot === slot.slot),
      ),
    requests: () => readList<InstallRequest>('requests'),
    addRequest: (request) =>
      write(
        'requests',
        upsert(
          readList<InstallRequest>('requests'),
          request,
          (r) => r.slot === request.slot && r.pubkey === request.pubkey,
        ),
      ),
    putSlotRequest: (request) =>
      write('requests', [
        ...readList<InstallRequest>('requests').filter((r) => r.slot !== request.slot),
        request,
      ]),
    retireRequests: () => readList<OperatorRetireRequest>('retire-requests'),
    addRetireRequest: (request) =>
      write(
        'retire-requests',
        upsert(
          readList<OperatorRetireRequest>('retire-requests'),
          request,
          (r) => r.owner === request.owner && r.pubkey === request.pubkey,
        ),
      ),
  }
}
