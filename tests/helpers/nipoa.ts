import { schnorr } from '@noble/curves/secp256k1.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import type { NipOaTag } from '../../src/core/nipoa'

export const signNipOaForTests = (
  ownerSecret: Uint8Array,
  agentPubkey: string,
  conditions = '',
): NipOaTag => {
  const message = sha256(new TextEncoder().encode(`nostr:agent-auth:${agentPubkey}:${conditions}`))
  const signature = bytesToHex(schnorr.sign(message, ownerSecret))
  return ['auth', bytesToHex(schnorr.getPublicKey(ownerSecret)), conditions, signature]
}
