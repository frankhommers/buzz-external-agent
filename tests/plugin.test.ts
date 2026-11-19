import { expect, test } from 'bun:test'
import { apply, inject, type PluginCtx } from '../src/plugin'
import { fakeCtx } from './helpers/fake-session'

test('injects what the plugin uses', () => {
  expect([...inject].sort()).toEqual(['agents', 'host', 'react', 'relay', 'settingsCards'])
})

test('apply registers the self-hosted agent type once', () => {
  const { ctx } = fakeCtx()
  const registered: unknown[] = []
  const pluginCtx: PluginCtx = {
    react: {},
    relay: ctx.relay,
    agents: { ...ctx.agents, register: (type) => void registered.push(type) },
    host: {
      prepareRemoteAgentAuthorization: async () => {
        throw new Error('unused')
      },
    },
    settingsCards: {},
  }
  apply(pluginCtx)
  expect(registered).toHaveLength(1)
  expect(registered[0]).toMatchObject({ id: 'agent', title: 'Self-hosted agent' })
})
