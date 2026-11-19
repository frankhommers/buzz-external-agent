import { z } from 'zod'
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
const NO_CONTROL_PATTERN = /^[^\p{Cc}]*$/u
const TITLE = 'Self-hosted agents'

const isValidHostKey = (value: string): boolean => {
  try {
    parseHostKey(value)
    return true
  } catch {
    return false
  }
}

const buildBlockSchema = () => {
  z.config({ jitless: true })
  const slotSchema = z.string().regex(SLOT_PATTERN)
  const pubkeySchema = z.string().refine(isHex64)
  const authSchema = z.custom<NipOaTag>((value) => parseNipOaTag(value) !== undefined)
  const sealedSchema = z
    .string()
    .startsWith(AGE_ARMOR_HEADER)
    .refine((value) => new TextEncoder().encode(value).length <= MAX_SEALED_BYTES)
  const communitySchema = z.string().refine((value) => {
    try {
      return new URL(value).protocol === 'wss:'
    } catch {
      return false
    }
  })

  const slotOfferSchema = z.strictObject({
    v: z.literal(1),
    type: z.literal('slot-offer'),
    slot: slotSchema,
    label: z.string().max(80),
    hostKey: z.string().max(MAX_HOST_KEY_LENGTH).refine(isValidHostKey),
    community: communitySchema,
  })

  const installRequestSchema = z.strictObject({
    v: z.literal(1),
    type: z.literal('install-request'),
    slot: slotSchema,
    pubkey: pubkeySchema,
    name: z.string().min(1).max(80).regex(NO_CONTROL_PATTERN),
    auth: authSchema,
    sealed: sealedSchema,
  })

  const retireRequestSchema = z.strictObject({
    v: z.literal(1),
    type: z.literal('retire-request'),
    slot: slotSchema,
    pubkey: pubkeySchema,
  })

  const retiredSchema = z.strictObject({
    v: z.literal(1),
    type: z.literal('retired'),
    slot: slotSchema,
    pubkey: pubkeySchema,
  })

  const installedSchema = z.strictObject({
    v: z.literal(1),
    type: z.literal('installed'),
    slot: slotSchema,
    pubkey: pubkeySchema,
  })

  const block = z.discriminatedUnion('type', [
    slotOfferSchema,
    installRequestSchema,
    retireRequestSchema,
    retiredSchema,
    installedSchema,
  ])
  return block
}

let cachedSchema: ReturnType<typeof buildBlockSchema> | undefined
// Built lazily so module evaluation stays pure; jitless avoids `new Function` under a strict CSP.
const blockSchema = () => (cachedSchema ??= buildBlockSchema())

type BlockSchema = ReturnType<typeof buildBlockSchema>
export type Block = z.infer<BlockSchema>
export type SlotOffer = Extract<Block, { type: 'slot-offer' }>
export type InstallRequest = Extract<Block, { type: 'install-request' }>
export type RetireRequest = Extract<Block, { type: 'retire-request' }>
export type Retired = Extract<Block, { type: 'retired' }>
export type Installed = Extract<Block, { type: 'installed' }>

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
  const result = blockSchema().safeParse(json)
  return result.success ? result.data : undefined
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
