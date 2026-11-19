import { agentType } from './buzz/provider'
import { createRelay } from './buzz/relay'
import type { AgentsService, Host, RelayData } from './buzz/types'
import { createStore } from './core/store'

export interface PluginCtx {
  react: unknown
  agents: AgentsService
  relay: RelayData
  host: Host
  settingsCards: unknown
}

export const inject: readonly string[] = ['react', 'agents', 'relay', 'host', 'settingsCards']

export function apply(ctx: PluginCtx): void {
  ctx.agents.register(
    agentType({
      relay: createRelay(ctx),
      storeFor: (scope) => createStore(globalThis.localStorage, scope),
      host: ctx.host,
      now: () => Date.now(),
    }),
  )
}
