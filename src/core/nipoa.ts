import { schnorr } from '@noble/curves/secp256k1.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { hexToBytes } from '@noble/hashes/utils.js'

export type NipOaTag = readonly ['auth', string, string, string]

const HEX64_PATTERN = /^[0-9a-f]{64}$/
const HEX128_PATTERN = /^[0-9a-f]{128}$/
const CANONICAL_NUMBER_PATTERN = /^(0|[1-9][0-9]*)$/
const MAX_KIND = 65535
const MAX_CREATED_AT = 4294967295
const MESSAGE_PREFIX = 'nostr:agent-auth:'

const isBoundedNumber = (digits: string, max: number): boolean =>
  CANONICAL_NUMBER_PATTERN.test(digits) && Number(digits) <= max

const isValidClause = (clause: string): boolean => {
  if (clause.startsWith('kind=')) return isBoundedNumber(clause.slice(5), MAX_KIND)
  if (clause.startsWith('created_at<') || clause.startsWith('created_at>')) {
    return isBoundedNumber(clause.slice(11), MAX_CREATED_AT)
  }
  return false
}

const isValidConditions = (conditions: string): boolean =>
  conditions === '' || conditions.split('&').every(isValidClause)

export const parseNipOaTag = (value: unknown): NipOaTag | undefined => {
  if (!Array.isArray(value) || value.length !== 4) return undefined
  const [name, owner, conditions, signature] = value as unknown[]
  if (name !== 'auth') return undefined
  if (typeof owner !== 'string' || !HEX64_PATTERN.test(owner)) return undefined
  if (typeof conditions !== 'string' || !isValidConditions(conditions)) return undefined
  if (typeof signature !== 'string' || !HEX128_PATTERN.test(signature)) return undefined
  return ['auth', owner, conditions, signature]
}

export const verifyNipOa = (tag: NipOaTag, agentPubkey: string): boolean => {
  const [, owner, conditions, signature] = tag
  if (!HEX64_PATTERN.test(owner) || !HEX64_PATTERN.test(agentPubkey)) return false
  if (!HEX128_PATTERN.test(signature) || !isValidConditions(conditions)) return false
  if (owner === agentPubkey) return false
  const message = sha256(new TextEncoder().encode(`${MESSAGE_PREFIX}${agentPubkey}:${conditions}`))
  try {
    return schnorr.verify(hexToBytes(signature), message, hexToBytes(owner))
  } catch {
    return false
  }
}
