import { BLOCK_INFO } from '../constants'
import { isHex64 } from './keys'
import { type NipOaTag, parseNipOaTag } from './nipoa'
import { parseHostKey } from './seal'

const AGE_ARMOR_HEADER = '-----BEGIN AGE ENCRYPTED FILE-----'
const MAX_SEALED_BYTES = 4096
const SECRET_MARKER = 'nsec1'
const SLOT_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/
const FENCE_PATTERN = new RegExp(
  `(?:^|\\n)\`\`\`${BLOCK_INFO}[ \\t]*\\r?\\n([\\s\\S]*?)\\r?\\n\`\`\``,
  'g',
)
const MAX_HOST_KEY_LENGTH = 512
const MAX_LABEL_LENGTH = 80
const MAX_NAME_LENGTH = 80
const NO_CONTROL_PATTERN = /^[^\p{Cc}]*$/u
const TITLE = 'Self-hosted agents'

export type SlotOffer = {
  v: 1
  type: 'slot-offer'
  slot: string
  label: string
  hostKey: string
  community: string
}
export type InstallRequest = {
  v: 1
  type: 'install-request'
  slot: string
  pubkey: string
  name: string
  auth: NipOaTag
  sealed: string
}
export type RetireRequest = { v: 1; type: 'retire-request'; slot: string; pubkey: string }
export type Retired = { v: 1; type: 'retired'; slot: string; pubkey: string }
export type Installed = { v: 1; type: 'installed'; slot: string; pubkey: string }
export type Block = SlotOffer | InstallRequest | RetireRequest | Retired | Installed

type Check = (value: unknown) => boolean

const isString = (value: unknown): value is string => typeof value === 'string'

// Unicode code points, as the previous schema library counted string lengths.
const codePoints = (value: string): number => [...value].length

const isValidHostKey = (value: string): boolean => {
  try {
    parseHostKey(value)
    return true
  } catch {
    return false
  }
}

const isWssUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'wss:'
  } catch {
    return false
  }
}

const isSlot: Check = (value) => isString(value) && SLOT_PATTERN.test(value)
const isPubkey: Check = (value) => isString(value) && isHex64(value)
const isLabel: Check = (value) => isString(value) && codePoints(value) <= MAX_LABEL_LENGTH
const isName: Check = (value) =>
  isString(value) &&
  codePoints(value) >= 1 &&
  codePoints(value) <= MAX_NAME_LENGTH &&
  NO_CONTROL_PATTERN.test(value)
const isHostKey: Check = (value) =>
  isString(value) && codePoints(value) <= MAX_HOST_KEY_LENGTH && isValidHostKey(value)
const isCommunity: Check = (value) => isString(value) && isWssUrl(value)
const isAuth: Check = (value) => parseNipOaTag(value) !== undefined
const isSealed: Check = (value) =>
  isString(value) &&
  value.startsWith(AGE_ARMOR_HEADER) &&
  new TextEncoder().encode(value).length <= MAX_SEALED_BYTES

// Every key besides `v` and `type`, per block type. Blocks are strict: no other keys.
const FIELDS: Record<Block['type'], Record<string, Check>> = {
  'slot-offer': { slot: isSlot, label: isLabel, hostKey: isHostKey, community: isCommunity },
  'install-request': {
    slot: isSlot,
    pubkey: isPubkey,
    name: isName,
    auth: isAuth,
    sealed: isSealed,
  },
  'retire-request': { slot: isSlot, pubkey: isPubkey },
  retired: { slot: isSlot, pubkey: isPubkey },
  installed: { slot: isSlot, pubkey: isPubkey },
}

const isBlockType = (value: unknown): value is Block['type'] =>
  isString(value) && Object.hasOwn(FIELDS, value)

const toBlock = (value: unknown): Block | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const input = value as Record<string, unknown>
  if (!Object.hasOwn(input, 'v') || input.v !== 1) return undefined
  if (!Object.hasOwn(input, 'type') || !isBlockType(input.type)) return undefined
  const fields = FIELDS[input.type]
  // Object.keys includes an own `__proto__` key as JSON.parse creates one.
  for (const key of Object.keys(input)) {
    if (key !== 'v' && key !== 'type' && !Object.hasOwn(fields, key)) return undefined
  }
  const block: Record<string, unknown> = { v: 1, type: input.type }
  for (const [key, check] of Object.entries(fields)) {
    if (!Object.hasOwn(input, key) || !check(input[key])) return undefined
    block[key] = input[key]
  }
  return block as Block
}

const shortKey = (pubkey: string): string => pubkey.slice(0, 8)

const humanLine = (block: Block): string => {
  switch (block.type) {
    case 'slot-offer':
      return `Server ${block.label} is ready for you (${TITLE}).`
    case 'install-request':
      return `Please install agent ${block.name} (${TITLE}).`
    case 'retire-request':
      return `Please retire agent ${shortKey(block.pubkey)} (${TITLE}).`
    case 'retired':
      return `Agent ${shortKey(block.pubkey)} has been retired.`
    case 'installed':
      return `Agent ${shortKey(block.pubkey)} has been installed.`
  }
}

const singleLine = (text: string): string => text.replace(/\s+/g, ' ').trim()

export const encodeBlock = (block: Block): string => {
  const json = JSON.stringify(block)
  if (json.includes(SECRET_MARKER)) throw new Error('Refusing to send secret material')
  return `${singleLine(humanLine(block))}\n\n\`\`\`${BLOCK_INFO}\n${json}\n\`\`\``
}

const parseOne = (raw: string): Block | undefined => {
  if (raw.includes(SECRET_MARKER)) return undefined
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return undefined
  }
  return toBlock(json)
}

export const parseBlocks = (text: string): Block[] =>
  Array.from(text.matchAll(FENCE_PATTERN), (match) => parseOne(match[1] ?? '')).filter(
    (block): block is Block => block !== undefined,
  )

export interface AcceptContext {
  operator: string
  viewer: string
}

export const acceptBlock = (block: Block, sender: string, ctx: AcceptContext): boolean => {
  const from = sender.toLowerCase()
  const operator = ctx.operator.toLowerCase()
  const viewer = ctx.viewer.toLowerCase()
  switch (block.type) {
    case 'slot-offer':
    case 'retired':
    case 'installed':
      return from === operator
    case 'install-request':
    case 'retire-request':
      return viewer === operator && from !== viewer
  }
}
