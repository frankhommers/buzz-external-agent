import { createOwner, POLL_INTERVAL_MS } from './buzz/owner'
import { agentType } from './buzz/provider'
import { createRelay } from './buzz/relay'
import type { AgentsService, Host, RelayData, SettingsCards } from './buzz/types'
import { createStore, type Store } from './core/store'
import { ownerCard, type ReactLike } from './ui/OwnerCard'

export interface PluginCtx {
  react: ReactLike
  agents: AgentsService
  relay: RelayData
  host: Host
  settingsCards: SettingsCards
  /** Owns a resource until the plugin is disabled or replaced (Cordis `ctx.effect`). */
  effect(start: () => (() => void) | undefined): () => void
}

export const inject: readonly string[] = ['react', 'agents', 'relay', 'host', 'settingsCards']

export function apply(ctx: PluginCtx): void {
  const relay = createRelay(ctx)
  const storeFor = (scope: { origin: string; viewer: string }): Store =>
    createStore(globalThis.localStorage, scope)
  ctx.agents.register(agentType({ relay, storeFor, host: ctx.host, now: () => Date.now() }))

  const owner = createOwner({ relay, storeFor, agents: ctx.agents })
  ctx.effect(() => {
    const timer = setInterval(() => void owner.pollSafely(), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  })
  ctx.settingsCards.register({
    id: 'owner',
    title: 'Self-hosted agents',
    component: ownerCard({ react: ctx.react, owner, relay, agents: ctx.agents }),
  })
}
