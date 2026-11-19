import { chacha20poly1305 } from '@noble/ciphers/chacha.js'
import { ed25519, x25519 } from '@noble/curves/ed25519.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { base64, base64nopad } from '@scure/base'
import { armor, Encrypter, type Recipient, Stanza } from 'age-encryption'
import { encodeNsec } from './keys'

export type HostKey = { line: string; fingerprint: string }

const SSH_ED25519 = 'ssh-ed25519'
const AGE_SSH_ED25519_LABEL = new TextEncoder().encode('age-encryption.org/v1/ssh-ed25519')
const KEY_TYPE_BYTES = new TextEncoder().encode(SSH_ED25519)
// uint32 length + "ssh-ed25519" + uint32 length + 32-byte key
const BLOB_LENGTH = 4 + KEY_TYPE_BYTES.length + 4 + 32

const ZERO_NONCE = new Uint8Array(12)

const decodeBlob = (encoded: string): Uint8Array => {
  let blob: Uint8Array
  try {
    blob = base64.decode(encoded)
  } catch {
    throw new Error('Not a valid SSH public key')
  }
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
  const isValid =
    blob.length === BLOB_LENGTH &&
    view.getUint32(0) === KEY_TYPE_BYTES.length &&
    KEY_TYPE_BYTES.every((byte, index) => blob[4 + index] === byte) &&
    view.getUint32(4 + KEY_TYPE_BYTES.length) === 32
  if (!isValid) throw new Error('Not a valid SSH public key')
  return blob
}

export const parseHostKey = (text: string): HostKey => {
  const [type, encoded] = text.trim().split(/\s+/)
  if (type !== SSH_ED25519) throw new Error('Only ssh-ed25519 host keys are supported')
  if (!encoded) throw new Error('Not a valid SSH public key')
  const blob = decodeBlob(encoded)
  return {
    line: `${SSH_ED25519} ${encoded}`,
    fingerprint: `SHA256:${base64nopad.encode(sha256(blob))}`,
  }
}

// Implements the age "ssh-ed25519" recipient stanza (C2SP age; filippo.io/age/agessh).
class SshEd25519Recipient implements Recipient {
  readonly #blob: Uint8Array
  readonly #montgomeryKey: Uint8Array

  constructor(blob: Uint8Array) {
    this.#blob = blob
    this.#montgomeryKey = ed25519.utils.toMontgomery(blob.slice(BLOB_LENGTH - 32))
  }

  wrapFileKey(fileKey: Uint8Array): Stanza[] {
    const ephemeral = x25519.utils.randomSecretKey()
    const ephemeralShare = x25519.getPublicKey(ephemeral)
    const tweak = hkdf(sha256, new Uint8Array(0), this.#blob, AGE_SSH_ED25519_LABEL, 32)
    const shared = x25519.getSharedSecret(
      tweak,
      x25519.getSharedSecret(ephemeral, this.#montgomeryKey),
    )
    const salt = new Uint8Array([...ephemeralShare, ...this.#montgomeryKey])
    const wrapKey = hkdf(sha256, shared, salt, AGE_SSH_ED25519_LABEL, 32)
    const body = chacha20poly1305(wrapKey, ZERO_NONCE).encrypt(fileKey)
    const tag = base64nopad.encode(sha256(this.#blob).slice(0, 4))
    return [new Stanza([SSH_ED25519, tag, base64nopad.encode(ephemeralShare)], body)]
  }
}

export const sealSecret = async (secret: Uint8Array, host: HostKey): Promise<string> => {
  const [, encoded] = host.line.split(' ')
  const encrypter = new Encrypter()
  encrypter.addRecipient(new SshEd25519Recipient(decodeBlob(encoded ?? '')))
  const ciphertext = await encrypter.encrypt(`${encodeNsec(secret)}\n`)
  return armor.encode(ciphertext)
}
