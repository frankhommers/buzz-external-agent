import { type AdoptableList, type AdoptState, adopt, findAdoptable } from '../buzz/adopt'
import type { Owner, OwnerView } from '../buzz/owner'
import type { Relay } from '../buzz/relay'
import type { SettingsCardProps } from '../buzz/types'
import { encodeNpub } from '../core/keys'

/** The slice of the host React (`ctx.react`) this card uses. */
export interface ReactLike {
  createElement(
    type: unknown,
    props?: Record<string, unknown> | null,
    ...children: unknown[]
  ): unknown
  useState<T>(initial: T): [T, (next: T | ((previous: T) => T)) => void]
  useEffect(effect: () => undefined | (() => void), deps?: readonly unknown[]): void
}

export interface OwnerCardDeps {
  react: ReactLike
  owner: Owner
  relay: Relay
  agents: { subscribe(listener: () => void): () => void }
}

export const ADOPT_STATE_TEXT: Record<AdoptState, string> = {
  ready: 'Can be brought into Buzz',
  'unverified-owner': 'Cannot verify owner',
  'local-key': 'Its key is held in this Buzz',
  'other-runtime': 'Managed by another runtime',
  already: 'Already a self-hosted agent',
}

export const ADOPTED_NOTICE = 'It appears on the Agents page after Buzz reconnects or restarts.'

const PANEL_STYLE = { padding: 'var(--space-panel-inset)' }
const ROW_STYLE = { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const shortNpub = (pubkey: string): string => `${encodeNpub(pubkey).slice(0, 16)}…`

export const ownerCard = (deps: OwnerCardDeps) =>
  function OwnerCard(props: SettingsCardProps): unknown {
    const { react, owner, relay } = deps
    const h = react.createElement
    const [view, setView] = react.useState<OwnerView | undefined>(undefined)
    const [viewError, setViewError] = react.useState('')
    const [operatorDraft, setOperatorDraft] = react.useState<string | undefined>(undefined)
    const [notice, setNotice] = react.useState('')
    const [busy, setBusy] = react.useState(false)
    const [adoptables, setAdoptables] = react.useState<AdoptableList | undefined>(undefined)

    react.useEffect(() => {
      let live = true
      const refresh = (): void => {
        owner.view().then(
          (next) => {
            if (!live) return
            setView(next)
            setViewError('')
          },
          (error: unknown) => {
            if (live) setViewError(messageOf(error))
          },
        )
      }
      refresh()
      const stopOwner = owner.subscribe(refresh)
      const stopAgents = deps.agents.subscribe(refresh)
      void owner.pollSafely()
      return () => {
        live = false
        stopOwner()
        stopAgents()
      }
    }, [])

    const loadAdoptables = (): void => {
      setAdoptables(undefined)
      findAdoptable(relay).then(setAdoptables, (error: unknown) =>
        setAdoptables({ ok: false, error: messageOf(error) }),
      )
    }
    react.useEffect(() => {
      loadAdoptables()
      return undefined
    }, [])

    const run = (action: () => Promise<string>): void => {
      if (busy || !props.active()) return
      setBusy(true)
      setNotice('')
      action().then(
        (done) => {
          setNotice(done)
          setBusy(false)
        },
        (error: unknown) => {
          setNotice(messageOf(error))
          setBusy(false)
        },
      )
    }

    const operatorValue = operatorDraft ?? view?.operator ?? ''

    const operatorSection = h(
      'div',
      null,
      h('h3', null, 'Operator'),
      h('p', null, 'The Buzz account that runs your servers. Paste their npub.'),
      h(
        'div',
        { style: ROW_STYLE },
        h('input', {
          type: 'text',
          value: operatorValue,
          placeholder: 'npub1…',
          'aria-label': 'Operator npub',
          onChange: (event: { target: { value: string } }) => setOperatorDraft(event.target.value),
        }),
        h(
          'button',
          {
            type: 'button',
            disabled: busy,
            onClick: () =>
              run(async () => {
                await owner.saveOperator(operatorValue)
                setOperatorDraft(undefined)
                return 'Operator saved.'
              }),
          },
          'Save',
        ),
      ),
    )

    const offers = view?.offers ?? []
    const offersSection = h(
      'div',
      null,
      h('h3', null, 'Servers offered to you'),
      offers.length === 0
        ? h('p', null, 'No servers offered yet.')
        : h(
            'ul',
            null,
            ...offers.map((offer) =>
              h(
                'li',
                { key: offer.slot },
                `${offer.label} (${offer.slot}) — use it in New agent → Self-hosted agent.`,
              ),
            ),
          ),
      h(
        'button',
        {
          type: 'button',
          disabled: busy,
          onClick: () =>
            run(async () => {
              await owner.poll()
              return 'Checked for messages from the operator.'
            }),
        },
        'Check now',
      ),
    )

    const agents = view?.agents ?? []
    const agentsSection = h(
      'div',
      null,
      h('h3', null, 'Your self-hosted agents'),
      agents.length === 0
        ? h('p', null, 'None in this community.')
        : h(
            'ul',
            null,
            ...agents.map((agent) =>
              h(
                'li',
                { key: agent.pubkey, style: ROW_STYLE },
                h('span', null, `${agent.name || shortNpub(agent.pubkey)} — ${agent.status}`),
                agent.canRetire
                  ? h(
                      'button',
                      {
                        type: 'button',
                        disabled: busy,
                        onClick: () =>
                          run(async () => {
                            await owner.retire(agent.pubkey)
                            return 'Asked the operator to retire the agent.'
                          }),
                      },
                      'Retire',
                    )
                  : null,
                agent.canCancelRetire
                  ? h(
                      'button',
                      {
                        type: 'button',
                        disabled: busy,
                        onClick: () =>
                          run(async () => {
                            await owner.cancelRetire(agent.pubkey)
                            return 'Retire request cancelled.'
                          }),
                      },
                      'Cancel retire request',
                    )
                  : null,
              ),
            ),
          ),
    )

    const adoptList =
      adoptables === undefined
        ? h('p', null, 'Looking for your agents…')
        : !adoptables.ok
          ? h('p', null, `Could not read your agents: ${adoptables.error}`)
          : adoptables.items.length === 0
            ? h('p', null, 'You have no agents in this community.')
            : h(
                'ul',
                null,
                ...adoptables.items.map((item) =>
                  h(
                    'li',
                    { key: item.pubkey, style: ROW_STYLE },
                    h(
                      'span',
                      null,
                      `${item.name || shortNpub(item.pubkey)} — ${ADOPT_STATE_TEXT[item.state]}`,
                    ),
                    item.state === 'ready'
                      ? h(
                          'button',
                          {
                            type: 'button',
                            disabled: busy,
                            onClick: () =>
                              run(async () => {
                                await adopt(relay, item.pubkey)
                                loadAdoptables()
                                return ADOPTED_NOTICE
                              }),
                          },
                          'Bring into Buzz',
                        )
                      : null,
                  ),
                ),
              )
    const adoptSection = h(
      'div',
      null,
      h('h3', null, 'Bring into Buzz'),
      h('p', null, 'Agents you already run elsewhere and own can be listed here as hosted.'),
      adoptList,
      h('button', { type: 'button', disabled: busy, onClick: loadAdoptables }, 'Refresh'),
    )

    return h(
      'section',
      { className: 'ui-card', style: PANEL_STYLE },
      viewError === '' ? null : h('p', { role: 'alert' }, viewError),
      notice === '' ? null : h('p', { role: 'status' }, notice),
      operatorSection,
      offersSection,
      agentsSection,
      adoptSection,
    )
  }
