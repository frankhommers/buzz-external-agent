import { afterEach, beforeEach, expect, test } from 'bun:test'
import { encodeNpub } from '../src/core/keys'
import { createStore } from '../src/core/store'
import { apply, inject, type PluginCtx } from '../src/plugin'
import { fakeCtx } from './helpers/fake-session'
import { MemoryStorage } from './helpers/memory-storage'

let storage: MemoryStorage
beforeEach(() => {
  storage = new MemoryStorage()
  ;(globalThis as { localStorage?: Storage }).localStorage = storage
})
afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage
})

const pluginCtx = () => {
  const { ctx, viewer } = fakeCtx({ viewer: 'a'.repeat(64) })
  const registered: unknown[] = []
  const tabs: { id: string; title: string }[] = []
  const cards: Parameters<PluginCtx['settingsCards']['register']>[0][] = []
  const effects: (() => (() => void) | undefined)[] = []
  const value: PluginCtx = {
    react: {} as PluginCtx['react'],
    relay: ctx.relay,
    agents: {
      ...ctx.agents,
      subscribe: () => () => {},
      register: (type) => void registered.push(type),
      registerTab: (tab) => void tabs.push(tab),
    },
    host: {
      prepareRemoteAgentAuthorization: async () => {
        throw new Error('unused')
      },
    },
    settingsCards: { register: (card) => void cards.push(card) },
    effect: (start) => {
      effects.push(start)
      return () => {}
    },
  }
  const origin = ctx.relay.snapshot().origin ?? ''
  const setOperator = (pubkey: string): void =>
    createStore(storage, { origin, viewer }).setSettings({ operator: encodeNpub(pubkey) })
  return { value, registered, tabs, cards, effects, viewer, setOperator }
}

test('injects what the plugin uses', () => {
  expect([...inject].sort()).toEqual(['agents', 'host', 'react', 'relay', 'settingsCards'])
})

test('apply registers the self-hosted agent type once', () => {
  const { value, registered } = pluginCtx()
  apply(value)
  expect(registered).toHaveLength(1)
  expect(registered[0]).toMatchObject({ id: 'agent', title: 'Self-hosted agent' })
})

test('apply registers the owner and operator settings cards', () => {
  const { value, cards } = pluginCtx()
  apply(value)
  expect(cards.map((card) => card.id)).toEqual(['owner', 'operator'])
  expect(cards[0]).toMatchObject({ title: 'Self-hosted agents' })
  expect(cards[1]).toMatchObject({ title: 'Agent servers' })
  for (const card of cards) expect(typeof card.component).toBe('function')
  expect(cards[0]?.visibility).toBeUndefined()
})

test('the operator card is listed only while the viewer is the operator', () => {
  const { value, cards, viewer, setOperator } = pluginCtx()
  apply(value)
  const visibility = cards[1]?.visibility
  expect(visibility?.snapshot()).toBe(false)
  setOperator(viewer)
  expect(visibility?.snapshot()).toBe(true)
  setOperator('b'.repeat(64))
  expect(visibility?.snapshot()).toBe(false)
})

test('apply owns the owner and operator polls through one effect with a cleanup', () => {
  const { value, effects } = pluginCtx()
  apply(value)
  expect(effects).toHaveLength(1)
  const stop = effects[0]?.()
  expect(typeof stop).toBe('function')
  stop?.()
})

test('apply adds the Server status tab and the create configuration', () => {
  const { value, registered, tabs } = pluginCtx()
  apply(value)
  expect(tabs).toMatchObject([{ id: 'status', title: 'Server' }])
  expect(typeof (registered[0] as { CreateConfiguration?: unknown }).CreateConfiguration).toBe(
    'function',
  )
})
