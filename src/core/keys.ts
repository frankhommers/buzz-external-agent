import { schnorr } from '@noble/curves/secp256k1.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { bech32 } from '@scure/base'

const HEX64_PATTERN = /^[0-9a-f]{64}$/
const BECH32_LIMIT = 1023

export const isHex64 = (value: string): boolean => HEX64_PATTERN.test(value)

export const generateSecretKey = (): Uint8Array => schnorr.utils.randomSecretKey()

export const publicKeyHex = (secret: Uint8Array): string => bytesToHex(schnorr.getPublicKey(secret))

export const encodeNsec = (secret: Uint8Array): string =>
  bech32.encode('nsec', bech32.toWords(secret), BECH32_LIMIT)

export const encodeNpub = (pubHex: string): string => {
  if (!isHex64(pubHex)) throw new Error('public key must be 64 lowercase hex characters')
  return bech32.encode('npub', bech32.toWords(hexToBytes(pubHex)), BECH32_LIMIT)
}

export const decodeNpub = (npub: string): string => {
  const decoded = bech32.decode(npub as `${string}1${string}`, BECH32_LIMIT)
  if (decoded.prefix !== 'npub') throw new Error('not an npub')
  const bytes = bech32.fromWords(decoded.words)
  if (bytes.length !== 32) throw new Error('npub must encode 32 bytes')
  return bytesToHex(bytes)
}
