import { expect, test } from 'bun:test'
import { apply, inject, type PluginCtx } from '../src/plugin'
import { fakeCtx } from './helpers/fake-session'

const pluginCtx = () => {
  const { ctx } = fakeCtx()
  const registered: unknown[] = []
  const tabs: { id: string; title: string }[] = []
  const cards: { id: string; title: string; component: unknown }[] = []
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
  return { value, registered, tabs, cards, effects }
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

test('apply registers the owner settings card', () => {
  const { value, cards } = pluginCtx()
  apply(value)
  expect(cards).toHaveLength(1)
  expect(cards[0]).toMatchObject({ id: 'owner', title: 'Self-hosted agents' })
  expect(typeof cards[0]?.component).toBe('function')
})

test('apply owns the operator poll through one effect with a cleanup', () => {
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
