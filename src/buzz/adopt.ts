import { RUNTIME } from '../constants'
import {
  type AgentRecord,
  mergeAgentRecord,
  profileOwner,
  recordRuntime,
  verifyEvent,
} from '../core/events'
import type { Relay } from './relay'

export type AdoptState = 'ready' | 'unverified-owner' | 'local-key' | 'other-runtime' | 'already'

export type Adoptable = { pubkey: string; name: string; state: AdoptState }

export type AdoptableList = { ok: true; items: Adoptable[] } | { ok: false; error: string }

const NOT_FOUND = 'This agent has no record in this community'
const REFUSALS: Record<Exclude<AdoptState, 'ready'>, string> = {
  'unverified-owner': 'Cannot verify that you own this agent',
  'local-key': "This agent's key is held in this Buzz; it cannot be brought in",
  'other-runtime': 'Another runtime manages this agent',
  already: 'This agent is already a self-hosted agent',
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const nameOf = (record: AgentRecord): string => {
  const name = record.content.name
  return typeof name === 'string' ? name : ''
}

const stateOf = async (
  relay: Relay,
  viewer: string,
  pubkey: string,
  record: AgentRecord,
): Promise<AdoptState> => {
  // An empty runtime tag is no runtime, as Buzz reads it (agents/service.ts:2006,2022).
  const runtime = recordRuntime(record.tags) || undefined
  if (runtime === RUNTIME) return 'already'
  if (runtime !== undefined) return 'other-runtime'
  if (relay.isLocalIdentity(pubkey)) return 'local-key'
  if (nameOf(record).trim() === '') return 'unverified-owner'
  const profile = await relay.readProfile(pubkey)
  return profile !== undefined && verifyEvent(profile) && profileOwner(profile) === viewer
    ? 'ready'
    : 'unverified-owner'
}

/** The viewer's agent records in this community, each with whether it can be brought in. */
export const findAdoptable = async (relay: Relay): Promise<AdoptableList> => {
  try {
    const { viewer } = await relay.ready()
    const read = await relay.readOwnRecords()
    if (!read.ok) return read
    const items: Adoptable[] = []
    for (const [pubkey, record] of read.records)
      items.push({
        pubkey,
        name: nameOf(record).trim(),
        state: await stateOf(relay, viewer, pubkey, record),
      })
    return { ok: true, items }
  } catch (error) {
    return { ok: false, error: messageOf(error) }
  }
}

/** Republishes the agent's record with our runtime tag, after checking it afresh. */
export const adopt = async (relay: Relay, pubkey: string): Promise<void> => {
  const { viewer } = await relay.ready()
  const read = await relay.readOwnRecords()
  if (!read.ok) throw new Error(read.error)
  const prior = read.records.get(pubkey)
  if (prior === undefined) throw new Error(NOT_FOUND)
  const state = await stateOf(relay, viewer, pubkey, prior)
  if (state !== 'ready') throw new Error(REFUSALS[state])
  const picture = prior.content.picture
  await relay.publishRecord(
    mergeAgentRecord(prior, {
      pubkey,
      name: nameOf(prior),
      ...(typeof picture === 'string' ? { picture } : {}),
    }),
  )
}
