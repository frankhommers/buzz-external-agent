import { schnorr } from '@noble/curves/secp256k1.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { RUNTIME } from '../constants'
import { publicKeyHex } from './keys'
import { type NipOaTag, parseNipOaTag, verifyNipOa } from './nipoa'

export type SignedEvent = {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
}

export type AgentRecord = {
  content: Record<string, unknown>
  tags: string[][]
}

type RecordInput = { pubkey: string; name: string; picture?: string }

const PROFILE_KIND = 0
const AUTH_KIND = 22242
const OWNED_TAGS = new Set(['d', 'runtime', 'client-id'])

const eventId = (e: Omit<SignedEvent, 'id' | 'sig'>): string =>
  bytesToHex(
    sha256(
      new TextEncoder().encode(
        JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]),
      ),
    ),
  )

const signEvent = (secret: Uint8Array, unsigned: Omit<SignedEvent, 'id' | 'sig'>): SignedEvent => {
  const id = eventId(unsigned)
  const sig = bytesToHex(schnorr.sign(hexToBytes(id), secret))
  return { id, ...unsigned, sig }
}

/** NIP-42 sign-in for `relay`'s `challenge`, carrying the owner's NIP-OA proof. */
export const buildAuthEvent = (
  secret: Uint8Array,
  relay: string,
  challenge: string,
  auth: NipOaTag,
  createdAt: number,
): SignedEvent =>
  signEvent(secret, {
    pubkey: publicKeyHex(secret),
    created_at: createdAt,
    kind: AUTH_KIND,
    tags: [['relay', relay], ['challenge', challenge], [...auth]],
    content: '',
  })

export const buildAgentProfile = (input: {
  secret: Uint8Array
  name: string
  picture?: string
  auth: NipOaTag
  createdAt: number
}): SignedEvent => {
  const content = JSON.stringify({
    name: input.name,
    display_name: input.name,
    ...(input.picture === undefined ? {} : { picture: input.picture }),
    bot: true,
  })
  return signEvent(input.secret, {
    pubkey: publicKeyHex(input.secret),
    created_at: input.createdAt,
    kind: PROFILE_KIND,
    tags: [[...input.auth]],
    content,
  })
}

export const verifyEvent = (e: SignedEvent): boolean => {
  try {
    if (eventId(e) !== e.id) return false
    return schnorr.verify(hexToBytes(e.sig), hexToBytes(e.id), hexToBytes(e.pubkey))
  } catch {
    return false
  }
}

const satisfiesConditions = (conditions: string, e: SignedEvent): boolean =>
  conditions === '' ||
  conditions.split('&').every((clause) => {
    if (clause.startsWith('kind=')) return e.kind === Number(clause.slice(5))
    if (clause.startsWith('created_at<')) return e.created_at < Number(clause.slice(11))
    if (clause.startsWith('created_at>')) return e.created_at > Number(clause.slice(11))
    return false
  })

export const profileOwner = (e: SignedEvent): string | undefined => {
  const authTags = e.tags.filter((tag) => tag[0] === 'auth')
  if (authTags.length !== 1) return undefined
  const tag = parseNipOaTag(authTags[0])
  if (tag === undefined) return undefined
  if (!verifyNipOa(tag, e.pubkey)) return undefined
  return satisfiesConditions(tag[2], e) ? tag[1] : undefined
}

const ownedTags = (pubkey: string): string[][] => [
  ['d', pubkey],
  ['runtime', RUNTIME],
]

export const newAgentRecord = (i: RecordInput): AgentRecord => ({
  content: {
    parallelism: 1,
    respond_to: 'anyone',
    name: i.name,
    ...(i.picture === undefined || i.picture === '' ? {} : { picture: i.picture }),
  },
  tags: ownedTags(i.pubkey),
})

export const mergeAgentRecord = (prior: AgentRecord, i: RecordInput): AgentRecord => {
  const content: Record<string, unknown> = { ...prior.content, name: i.name }
  if (i.picture !== undefined) content.picture = i.picture
  if (content.picture === '') delete content.picture
  return {
    content,
    tags: [...ownedTags(i.pubkey), ...prior.tags.filter((tag) => !OWNED_TAGS.has(tag[0] ?? ''))],
  }
}

export const recordRuntime = (tags: string[][]): string | undefined =>
  tags.find((tag) => tag[0] === 'runtime')?.[1]
