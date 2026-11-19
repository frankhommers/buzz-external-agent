import { publishAsAgent } from './buzz/agent-publish'
import { createOperator } from './buzz/operator'
import { operatorCardVisibility } from './buzz/operator-visibility'
import { createOwner } from './buzz/owner'
import { POLL_INTERVAL_MS } from './buzz/poll'
import { agentType } from './buzz/provider'
import { createRelay } from './buzz/relay'
import type { AgentsService, Host, RelayData, SettingsCards } from './buzz/types'
import { createStore, type Store } from './core/store'
import { createConfiguration } from './ui/CreateConfiguration'
import { operatorCard } from './ui/OperatorCard'
import { ownerCard, type ReactLike } from './ui/OwnerCard'
import { statusTab } from './ui/StatusTab'

export interface PluginCtx {
  react: ReactLike
  agents: AgentsService
  relay: RelayData
  host: Host
  settingsCards: SettingsCards
  /** Owns a resource until the plugin is disabled or replaced (Cordis `ctx.effect`). */
  effect(start: () => (() => void) | undefined): () => void
}

const OPERATOR_CARD_TITLE = 'Self-hosted agents — operator'

export const inject: readonly string[] = ['react', 'agents', 'relay', 'host', 'settingsCards']

export function apply(ctx: PluginCtx): void {
  const relay = createRelay(ctx)
  const storeFor = (scope: { origin: string; viewer: string }): Store =>
    createStore(globalThis.localStorage, scope)
  const owner = createOwner({ relay, storeFor, agents: ctx.agents })
  const operator = createOperator({ relay, storeFor })
  ctx.agents.register(
    agentType({
      relay,
      storeFor,
      host: ctx.host,
      now: () => Date.now(),
      publishAsAgent,
      createConfiguration: createConfiguration({ react: ctx.react, owner }),
    }),
  )
  ctx.agents.registerTab(statusTab({ react: ctx.react, owner }))
  ctx.effect(() => {
    const timer = setInterval(() => {
      void owner.pollSafely()
      void operator.pollSafely()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  })
  ctx.settingsCards.register({
    id: 'owner',
    title: 'Self-hosted agents',
    component: ownerCard({ react: ctx.react, owner, relay, agents: ctx.agents }),
  })
  // Only the community's operator sees the operator card, also in the Settings list.
  ctx.settingsCards.register({
    id: 'operator',
    title: OPERATOR_CARD_TITLE,
    component: operatorCard({ react: ctx.react, operator }),
    visibility: operatorCardVisibility({ relay: ctx.relay, owner, storeFor }),
  })
}
