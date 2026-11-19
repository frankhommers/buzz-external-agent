import { ed25519 } from '@noble/curves/ed25519.js'

/** An `ssh-ed25519` public key line for a deterministic test key. */
export const hostKeyLine = (seed: number): string => {
  const part = (b: Uint8Array): Uint8Array => {
    const out = new Uint8Array(4 + b.length)
    new DataView(out.buffer).setUint32(0, b.length)
    out.set(b, 4)
    return out
  }
  const blob = new Uint8Array([
    ...part(new TextEncoder().encode('ssh-ed25519')),
    ...part(ed25519.getPublicKey(new Uint8Array(32).fill(seed))),
  ])
  return `ssh-ed25519 ${Buffer.from(blob).toString('base64')}`
}
