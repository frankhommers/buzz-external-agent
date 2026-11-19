// TEST-ONLY helper (not shipped): publish an old-Buzz style kind 30177 record (only a `d` tag,
// no runtime) for an existing agent, signed by its owner, to simulate a pre-1.0 registration.
// Usage: bun scripts/legacy-record.ts <relay wss url> <owner nsec file> <agent hex> <name>

import { schnorr } from '@noble/curves/secp256k1.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { bech32 } from '@scure/base'

const [relay, nsecFile, agent, name] = process.argv.slice(2)
if (!relay || !nsecFile || !agent || !name) throw new Error('usage')
const nsec = (await Bun.file(nsecFile).text()).trim()
const secret = new Uint8Array(
  bech32.fromWords(bech32.decode(nsec as `${string}1${string}`, 1000).words),
)
const pubkey = bytesToHex(schnorr.getPublicKey(secret))
const sign = (kind: number, tags: string[][], content: string) => {
  const created_at = Math.floor(Date.now() / 1000)
  const id = bytesToHex(
    sha256(new TextEncoder().encode(JSON.stringify([0, pubkey, created_at, kind, tags, content]))),
  )
  return {
    id,
    pubkey,
    created_at,
    kind,
    tags,
    content,
    sig: bytesToHex(schnorr.sign(hexToBytes(id), secret)),
  }
}
const record = sign(
  30177,
  [['d', agent]],
  JSON.stringify({ name, parallelism: 1, respond_to: 'anyone' }),
)
const ws = new WebSocket(relay)
const done = new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('timeout')), 15000)
  ws.onmessage = (m) => {
    const msg = JSON.parse(String(m.data))
    if (msg[0] === 'AUTH') {
      const auth = sign(
        22242,
        [
          ['relay', relay],
          ['challenge', msg[1]],
        ],
        '',
      )
      ws.send(JSON.stringify(['AUTH', auth]))
    } else if (msg[0] === 'OK' && msg[2] !== true) {
      clearTimeout(timer)
      reject(new Error(`refused: ${msg[3]}`))
    } else if (msg[0] === 'OK' && msg[1] !== record.id) {
      ws.send(JSON.stringify(['EVENT', record]))
    } else if (msg[0] === 'OK' && msg[1] === record.id) {
      clearTimeout(timer)
      resolve()
    }
  }
  ws.onerror = () => {
    clearTimeout(timer)
    reject(new Error('socket error'))
  }
})
await done
ws.close()
console.log('published legacy 30177 for', agent, 'by', pubkey)
