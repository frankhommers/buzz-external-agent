import type { AgentStatusView, Owner } from '../buzz/owner'
import type { Agent, AgentAddedTab } from '../buzz/types'
import { RUNTIME } from '../constants'
import type { ReactLike } from './OwnerCard'

const LOADING_TEXT = 'Checking the server…'

export interface StatusViewProps {
  status: AgentStatusView | undefined
  busy: boolean
  notice: string
  onRetire(): void
  onCancelRetire(): void
}

/** Plain status text, Retire while it is offered, and Cancel retire request while one waits. */
export const StatusView = (react: ReactLike, props: StatusViewProps): unknown => {
  const h = react.createElement
  return h(
    'section',
    { style: { padding: 'var(--space-panel-inset)' } },
    h('p', null, props.status?.text ?? LOADING_TEXT),
    props.status?.canRetire === true
      ? h('button', { type: 'button', disabled: props.busy, onClick: props.onRetire }, 'Retire')
      : null,
    props.status?.canCancelRetire === true
      ? h(
          'button',
          { type: 'button', disabled: props.busy, onClick: props.onCancelRetire },
          'Cancel retire request',
        )
      : null,
    props.notice === '' ? null : h('p', { role: 'status' }, props.notice),
  )
}

export interface StatusTabDeps {
  react: ReactLike
  owner: Pick<Owner, 'agentStatus' | 'retire' | 'cancelRetire' | 'subscribe'>
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const statusTab = (deps: StatusTabDeps): AgentAddedTab => {
  const { react, owner } = deps
  return {
    id: 'status',
    title: 'Server',
    when: (agent) => agent.type === RUNTIME,
    component: function StatusTab(props: { agent: Agent }): unknown {
      const { pubkey } = props.agent
      const [status, setStatus] = react.useState<AgentStatusView | undefined>(undefined)
      const [busy, setBusy] = react.useState(false)
      const [notice, setNotice] = react.useState('')

      react.useEffect(() => {
        let live = true
        const refresh = (): void => {
          owner.agentStatus(pubkey).then(
            (next) => {
              if (live) setStatus(next)
            },
            (error: unknown) => {
              if (live) setNotice(messageOf(error))
            },
          )
        }
        refresh()
        const stop = owner.subscribe(refresh)
        return () => {
          live = false
          stop()
        }
      }, [pubkey])

      const run = (action: (key: string) => Promise<void>): void => {
        if (busy) return
        setBusy(true)
        setNotice('')
        action(pubkey).then(
          () => setBusy(false),
          (error: unknown) => {
            setNotice(messageOf(error))
            setBusy(false)
          },
        )
      }

      return StatusView(react, {
        status,
        busy,
        notice,
        onRetire: () => run((key) => owner.retire(key)),
        onCancelRetire: () => run((key) => owner.cancelRetire(key)),
      })
    },
  }
}
