import { TYPE_ID } from '../constants'
import { buildAgentProfile } from '../core/events'
import { decodeNpub, generateSecretKey, isHex64, publicKeyHex } from '../core/keys'
import type { InstallRequest } from '../core/messages'
import { type NipOaTag, parseNipOaTag, verifyNipOa } from '../core/nipoa'
import { parseHostKey, sealSecret } from '../core/seal'
import type { PendingSetup, Store } from '../core/store'
import type { Relay } from './relay'
import type { AgentType, Host, RemoteAgentType } from './types'

export type SelfHostedConfig = { slot: string }

export interface ProviderDeps {
  relay: Relay
  /** Plugin state for one community origin and viewer. */
  storeFor(scope: { origin: string; viewer: string }): Store
  host: Pick<Host, 'prepareRemoteAgentAuthorization'>
  /** Wall-clock Unix milliseconds. */
  now(): number
}

const TITLE = 'Self-hosted agent'
// Mirrors the install-request name rule in core/messages.ts, so the operator accepts it.
const MAX_NAME_LENGTH = 80
const NO_CONTROL_PATTERN = /^[^\p{Cc}]*$/u
const MS_PER_SECOND = 1000

const NO_OPERATOR = 'Set the operator in Settings → Self-hosted agents first'
const NO_SLOT = 'Choose a server offered to you for this community'
const SLOT_TAKEN = 'This server is already being set up for another agent'
const SLOT_IN_USE = 'This server already runs an agent'
const BAD_NAME = `Use a name of 1 to ${MAX_NAME_LENGTH} characters`
const BAD_AUTH = 'Buzz did not return a valid owner proof for this agent'
const UNKNOWN_SETUP = 'Unknown agent setup'
const PROFILE_HELD = "Change the name or avatar on the server; this agent's key is not held in Buzz"
const RETIRE_FIRST = 'Retire this agent first, then delete it again'

const operatorOf = (store: Store): string => {
  const operator = store.settings().operator?.trim()
  if (!operator) throw new Error(NO_OPERATOR)
  if (isHex64(operator)) return operator
  try {
    return decodeNpub(operator)
  } catch {
    throw new Error(NO_OPERATOR)
  }
}

const slotOf = (config: unknown): string | undefined => {
  if (typeof config !== 'object' || config === null) return undefined
  const slot = (config as Record<string, unknown>).slot
  return typeof slot === 'string' && slot !== '' ? slot : undefined
}

const isValidName = (name: string): boolean =>
  name.length >= 1 && name.length <= MAX_NAME_LENGTH && NO_CONTROL_PATTERN.test(name)

const withPicture = (picture: string | undefined): { picture?: string } =>
  picture === undefined ? {} : { picture }

const resultOf = (pending: PendingSetup): { pubkey: string; picture?: string } => ({
  pubkey: pending.pubkey,
  ...withPicture(pending.picture),
})

const authOf = (pending: PendingSetup): NipOaTag | undefined =>
  parseNipOaTag(pending.profile.tags.find((tag) => tag[0] === 'auth'))

export const createProvider = (deps: ProviderDeps): RemoteAgentType => {
  const open = async (): Promise<{ viewer: string; store: Store }> => {
    const { origin, viewer } = await deps.relay.ready()
    return { viewer, store: deps.storeFor({ origin, viewer }) }
  }

  const authorize = async (
    pubkey: string,
    viewer: string,
    signal: AbortSignal,
  ): Promise<NipOaTag> => {
    const tag = parseNipOaTag(await deps.host.prepareRemoteAgentAuthorization(pubkey, signal))
    if (tag === undefined || tag[1] !== viewer || !verifyNipOa(tag, pubkey)) {
      throw new Error(BAD_AUTH)
    }
    return tag
  }

  return {
    provision: async ({ name, picture, community, config, signal }) => {
      signal.throwIfAborted()
      const { viewer, store } = await open()
      operatorOf(store)
      const slot = slotOf(config)
      const offer = store.offers().find((o) => o.slot === slot && o.community === community)
      if (slot === undefined || offer === undefined) throw new Error(NO_SLOT)
      const host = parseHostKey(offer.hostKey)

      const existing = store.pendingFor(slot)
      if (existing !== undefined) {
        if (existing.community !== community || existing.hostFingerprint !== host.fingerprint) {
          throw new Error(SLOT_TAKEN)
        }
        const status = store.statusOf(existing.pubkey)
        if (status !== undefined && status !== 'awaiting-install') throw new Error(SLOT_IN_USE)
        return resultOf(existing)
      }
      if (!isValidName(name)) throw new Error(BAD_NAME)

      signal.throwIfAborted()
      const secret = generateSecretKey()
      try {
        const pubkey = publicKeyHex(secret)
        const auth = await authorize(pubkey, viewer, signal)
        signal.throwIfAborted()
        const profile = buildAgentProfile({
          secret,
          name,
          ...withPicture(picture),
          auth,
          createdAt: Math.floor(deps.now() / MS_PER_SECOND),
        })
        await deps.relay.publishSigned(profile)
        // The profile is public now: finish persisting so a retry reuses this key.
        const sealed = await sealSecret(secret, host)
        secret.fill(0)
        const pending: PendingSetup = {
          slot,
          community,
          owner: viewer,
          hostFingerprint: host.fingerprint,
          pubkey,
          sealed,
          profile,
          name,
          ...withPicture(picture),
        }
        store.putPending(pending)
        return resultOf(pending)
      } finally {
        secret.fill(0)
      }
    },

    activate: async ({ pubkey, signal }) => {
      signal.throwIfAborted()
      const { store } = await open()
      const pending = store.pending().find((p) => p.pubkey === pubkey)
      const auth = pending === undefined ? undefined : authOf(pending)
      if (pending === undefined || auth === undefined) throw new Error(UNKNOWN_SETUP)
      const operator = operatorOf(store)
      const request: InstallRequest = {
        v: 1,
        type: 'install-request',
        slot: pending.slot,
        pubkey,
        name: pending.name,
        auth,
        sealed: pending.sealed,
      }
      signal.throwIfAborted()
      await deps.relay.sendBlock(operator, request)
      if (store.statusOf(pubkey) === undefined) store.setStatus(pubkey, 'awaiting-install')
    },

    profile: async () => {
      throw new Error(PROFILE_HELD)
    },

    remove: async ({ pubkey, signal }) => {
      signal.throwIfAborted()
      const { store } = await open()
      // No install-request was ever sent, so the agent cannot be running: free its slot.
      if (store.statusOf(pubkey) === undefined) {
        store.deletePending(pubkey)
        return
      }
      if (!store.isRetired(pubkey)) throw new Error(RETIRE_FIRST)
    },
  }
}

export const agentType = (deps: ProviderDeps): AgentType<SelfHostedConfig> => ({
  id: TYPE_ID,
  title: TITLE,
  defaults: () => ({ config: { slot: '' } }),
  summary: () => 'Runs on your own server',
  remote: createProvider(deps),
})
