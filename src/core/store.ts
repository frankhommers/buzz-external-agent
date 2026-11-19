import { STORAGE_PREFIX } from '../constants'
import type { SignedEvent } from './events'
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

export type Settings = { operator?: string; template?: string }

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
  slots(): OperatorSlot[]
  putSlot(slot: OperatorSlot): void
  requests(): InstallRequest[]
  addRequest(request: InstallRequest): void
  retireRequests(): RetireRequest[]
  addRetireRequest(request: RetireRequest): void
}

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
        upsert(readList<InstallRequest>('requests'), request, (r) => r.pubkey === request.pubkey),
      ),
    retireRequests: () => readList<RetireRequest>('retire-requests'),
    addRetireRequest: (request) =>
      write(
        'retire-requests',
        upsert(
          readList<RetireRequest>('retire-requests'),
          request,
          (r) => r.pubkey === request.pubkey,
        ),
      ),
  }
}
