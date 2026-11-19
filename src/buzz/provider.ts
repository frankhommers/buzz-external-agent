import { TYPE_ID } from '../constants'
import { buildAgentProfile, verifyEvent } from '../core/events'
import { decodeNpub, generateSecretKey, isHex64, publicKeyHex } from '../core/keys'
import type { InstallRequest } from '../core/messages'
import { type NipOaTag, parseNipOaTag, verifyNipOa } from '../core/nipoa'
import { parseHostKey, sealSecret } from '../core/seal'
import type { PendingSetup, Store } from '../core/store'
import type { publishAsAgent } from './agent-publish'
import { receiveOwnRequest } from './operator'
import type { Relay } from './relay'
import type { AgentType, CreateConfigurationProps, Host, RemoteAgentType } from './types'

export type SelfHostedConfig = { slot: string }

export interface ProviderDeps {
  relay: Relay
  /** Plugin state for one community origin and viewer. */
  storeFor(scope: { origin: string; viewer: string }): Store
  host: Pick<Host, 'prepareRemoteAgentAuthorization'>
  /** Wall-clock Unix milliseconds. */
  now(): number
  /** Publishes an agent-signed event on a connection signed in as the agent. */
  publishAsAgent: typeof publishAsAgent
  /** The New agent dialog's server picker. */
  createConfiguration?: (props: CreateConfigurationProps<SelfHostedConfig>) => unknown
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
const OTHER_COMMUNITY = "Switch to this agent's community in Buzz, then try again"
const RETIRING = 'This agent is retired or being retired; it cannot be installed again'
const NOT_PUBLISHED = 'The agent profile could not be published; retire this agent and try again'
const SETTING_UP = 'This server is still being set up; wait for it to finish'
const SETUP_CHANGED = 'The setup for this server changed while it was being created; try again'

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

type ProvisionInput = Parameters<RemoteAgentType['provision']>[0]
type Provisioned = Awaited<ReturnType<RemoteAgentType['provision']>>

export const createProvider = (deps: ProviderDeps): RemoteAgentType => {
  /** Running provisions per community and slot: a second must not replace the first's setup. */
  const inFlight = new Map<string, { name: string; result: Promise<Provisioned> }>()

  const open = async (): Promise<{ viewer: string; store: Store }> => {
    const { origin, viewer } = await deps.relay.ready()
    return { viewer, store: deps.storeFor({ origin, viewer }) }
  }

  /**
   * The state of the agent's own community; refuses while another community is selected.
   * Waits briefly while Buzz reconnects, so a Delete or activation right then is not refused.
   */
  const openFor = async (
    community: string,
    signal: AbortSignal,
  ): Promise<{ viewer: string; store: Store }> => {
    const ready = await deps.relay.whenReady(signal)
    if (ready.community !== community) throw new Error(OTHER_COMMUNITY)
    return {
      viewer: ready.viewer,
      store: deps.storeFor({ origin: ready.origin, viewer: ready.viewer }),
    }
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

  const provisionOnce = async ({
    name,
    picture,
    community,
    config,
    signal,
  }: ProvisionInput): Promise<Provisioned> => {
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
      // A retry: the key was dropped after the first attempt, so the profile cannot be
      // published again as the agent. It counts only if that attempt reached the relay.
      const profile = await deps.relay.readProfile(existing.pubkey)
      if (profile !== undefined && profile.pubkey === existing.pubkey && verifyEvent(profile)) {
        return resultOf(existing)
      }
      if (status !== undefined) throw new Error(NOT_PUBLISHED)
    }
    if (!isValidName(name)) throw new Error(BAD_NAME)
    // Never published nor sent: only its local ciphertext existed, so start over with a new key.
    if (existing !== undefined) store.deletePending(existing.pubkey)

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
      const sealed = await sealSecret(secret, host)
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
      // Stored before the profile goes public, so a published key is always one we hold
      // sealed; if publishing fails, a retry checks whether the profile reached the relay.
      store.putPending(pending)
      await deps.publishAsAgent({ relay: community, secret, auth, event: profile, signal })
      // Buzz records the returned key; without its pending setup, activate would fail.
      if (store.pendingFor(slot)?.pubkey !== pubkey) throw new Error(SETUP_CHANGED)
      return resultOf(pending)
    } finally {
      // Only now: publishing signs the relay sign-in with the agent key.
      secret.fill(0)
    }
  }

  return {
    // Buzz may call again while the first call still publishes (dialog closed and reopened).
    provision: async (input) => {
      input.signal.throwIfAborted()
      const key = `${input.community}\n${slotOf(input.config) ?? ''}`
      const running = inFlight.get(key)
      if (running !== undefined) {
        if (running.name !== input.name) throw new Error(SETTING_UP)
        return running.result
      }
      const result = provisionOnce(input)
      inFlight.set(key, { name: input.name, result })
      try {
        return await result
      } finally {
        inFlight.delete(key)
      }
    },

    activate: async ({ pubkey, community, signal }) => {
      signal.throwIfAborted()
      const { viewer, store } = await openFor(community, signal)
      const pending = store.pending().find((p) => p.pubkey === pubkey)
      const auth = pending === undefined ? undefined : authOf(pending)
      if (pending === undefined || auth === undefined) throw new Error(UNKNOWN_SETUP)
      const status = store.statusOf(pubkey)
      if (status === 'retire-requested' || status === 'retired') throw new Error(RETIRING)
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
      // The owner is the operator too: list the request locally, no DM to self. A refused local
      // request was never listed anywhere, so it leaves no status behind.
      if (operator === viewer) {
        await receiveOwnRequest(store, request, {
          viewer,
          readProfile: (key) => deps.relay.readProfile(key),
        })
        if (status === undefined) store.setStatus(pubkey, 'awaiting-install')
        return
      }
      // Marked before sending: a send that fails or whose delivery is unknown may still have
      // reached the operator, so Delete must not treat this setup as never sent.
      if (status === undefined) store.setStatus(pubkey, 'awaiting-install')
      await deps.relay.sendBlock(operator, request)
    },

    profile: async () => {
      throw new Error(PROFILE_HELD)
    },

    remove: async ({ pubkey, community, signal }) => {
      signal.throwIfAborted()
      const { store } = await openFor(community, signal)
      // Set up on this device and no install-request ever attempted: the agent cannot be
      // running, so free its slot. Anything else (adopted, set up elsewhere, sent) must be retired.
      const unsent =
        store.statusOf(pubkey) === undefined && store.pending().some((p) => p.pubkey === pubkey)
      if (unsent) {
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
  ...(deps.createConfiguration === undefined
    ? {}
    : { CreateConfiguration: deps.createConfiguration }),
  remote: createProvider(deps),
})
