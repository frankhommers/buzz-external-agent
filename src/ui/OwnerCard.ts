import { type AdoptableList, type AdoptState, adopt, findAdoptable } from '../buzz/adopt'
import type { Owner, OwnerView } from '../buzz/owner'
import type { Relay } from '../buzz/relay'
import type { SettingsCardProps } from '../buzz/types'
import { encodeNpub } from '../core/keys'
import {
  buttonStyle,
  CARD,
  ERROR,
  HEADING,
  HINT,
  INPUT,
  LABEL,
  LIST,
  LIST_ROW,
  NO_NOTICE,
  type Notice,
  noticeProps,
  ROW,
  ROW_TEXT,
  SECTION,
  WIDE_FIELD,
} from './styles'

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
  ready: 'Can be shown in Buzz',
  'unverified-owner': 'Cannot verify owner',
  'local-key': 'Its key is held in this Buzz',
  'other-runtime': 'Managed by another runtime',
  already: 'Already a self-hosted agent',
}

export const TAKE_OVER_WARNING =
  'Take it over only if it runs on your own server and no other Buzz runs it; ' +
  'that runtime then no longer manages it.'

export const ADOPTED_NOTICE = 'It appears on the Agents page after Buzz reconnects or restarts.'

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
    const [notice, setNotice] = react.useState<Notice>(NO_NOTICE)
    const [busy, setBusy] = react.useState(false)
    const [adoptables, setAdoptables] = react.useState<AdoptableList | undefined>(undefined)
    const [takeOver, setTakeOver] = react.useState<string | undefined>(undefined)

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
      setNotice(NO_NOTICE)
      action().then(
        (done) => {
          setNotice({ text: done, error: false })
          setBusy(false)
        },
        (error: unknown) => {
          setNotice({ text: messageOf(error), error: true })
          setBusy(false)
        },
      )
    }
    const button = (label: string, onClick: () => void): unknown =>
      h('button', { type: 'button', disabled: busy, onClick, style: buttonStyle(busy) }, label)
    const heading = (text: string): unknown => h('h3', { style: HEADING }, text)
    const hint = (text: string): unknown => h('p', { style: HINT }, text)
    const item = (key: string, text: string, ...actions: unknown[]): unknown =>
      h('li', { key, style: LIST_ROW }, h('span', { style: ROW_TEXT }, text), ...actions)

    const operatorValue = operatorDraft ?? view?.operator ?? ''

    const operatorSection = h(
      'div',
      { style: SECTION },
      heading('Your server admin'),
      hint('The person who runs the servers your agents live on. Paste their npub.'),
      h(
        'label',
        { style: WIDE_FIELD },
        h('span', { style: LABEL }, 'Server admin (npub)'),
        h('input', {
          type: 'text',
          value: operatorValue,
          placeholder: 'npub1…',
          spellCheck: false,
          style: INPUT,
          onChange: (event: { target: { value: string } }) => setOperatorDraft(event.target.value),
        }),
      ),
      h(
        'div',
        { style: ROW },
        button('Save', () =>
          run(async () => {
            await owner.saveOperator(operatorValue)
            setOperatorDraft(undefined)
            return 'Server admin saved.'
          }),
        ),
      ),
    )

    const offers = view?.offers ?? []
    const offersSection = h(
      'div',
      { style: SECTION },
      heading('Servers you can use'),
      offers.length === 0
        ? hint('None yet.')
        : h(
            'ul',
            { style: LIST },
            ...offers.map((offer) =>
              item(
                offer.slot,
                `${offer.label} (${offer.slot}) — use it in New agent → Self-hosted agent.`,
              ),
            ),
          ),
      h(
        'div',
        { style: ROW },
        button('Check now', () =>
          run(async () => {
            await owner.poll()
            return 'Checked for messages from your server admin.'
          }),
        ),
      ),
    )

    const agents = view?.agents ?? []
    const agentsSection = h(
      'div',
      { style: SECTION },
      heading('Your self-hosted agents'),
      agents.length === 0
        ? hint('None in this community.')
        : h(
            'ul',
            { style: LIST },
            ...agents.map((agent) =>
              item(
                agent.pubkey,
                `${agent.name || shortNpub(agent.pubkey)} — ${agent.status}`,
                agent.canRetire
                  ? button('Retire', () =>
                      run(async () => {
                        await owner.retire(agent.pubkey)
                        return 'Asked your server admin to retire the agent.'
                      }),
                    )
                  : null,
                agent.canCancelRetire
                  ? button('Cancel retire request', () =>
                      run(async () => {
                        await owner.cancelRetire(agent.pubkey)
                        return 'Retire request cancelled.'
                      }),
                    )
                  : null,
              ),
            ),
          ),
    )

    const adoptList =
      adoptables === undefined
        ? hint('Looking for your agents…')
        : !adoptables.ok
          ? h(
              'p',
              { role: 'alert', style: ERROR },
              `Could not read your agents: ${adoptables.error}`,
            )
          : adoptables.items.length === 0
            ? hint('You have no agents in this community.')
            : h(
                'ul',
                { style: LIST },
                ...adoptables.items.map((adoptable) => {
                  const label = adoptable.name || shortNpub(adoptable.pubkey)
                  const bringIn = (options: { takeOver?: boolean }) =>
                    run(async () => {
                      await adopt(relay, adoptable.pubkey, options)
                      setTakeOver(undefined)
                      loadAdoptables()
                      return ADOPTED_NOTICE
                    })
                  if (adoptable.state === 'ready')
                    return item(
                      adoptable.pubkey,
                      `${label} — ${ADOPT_STATE_TEXT.ready}`,
                      button('Show in Buzz', () => bringIn({})),
                    )
                  if (adoptable.state !== 'other-runtime')
                    return item(adoptable.pubkey, `${label} — ${ADOPT_STATE_TEXT[adoptable.state]}`)
                  const managed = `${label} — Managed by ${adoptable.runtime ?? 'another runtime'}`
                  return takeOver === adoptable.pubkey
                    ? item(
                        adoptable.pubkey,
                        `${managed}. ${TAKE_OVER_WARNING}`,
                        button('Confirm take over', () => bringIn({ takeOver: true })),
                        button('Cancel', () => setTakeOver(undefined)),
                      )
                    : item(
                        adoptable.pubkey,
                        managed,
                        button('Take over', () => setTakeOver(adoptable.pubkey)),
                      )
                }),
              )
    const adoptSection = h(
      'div',
      { style: SECTION },
      heading('Agents already running on a server'),
      hint('Agents you already run elsewhere and own can be listed here as hosted.'),
      adoptList,
      h('div', { style: ROW }, button('Refresh', loadAdoptables)),
    )

    return h(
      'section',
      { className: 'ui-card', style: CARD },
      viewError === '' ? null : h('p', { role: 'alert', style: ERROR }, viewError),
      notice.text === '' ? null : h('p', noticeProps(notice), notice.text),
      operatorSection,
      offersSection,
      agentsSection,
      adoptSection,
    )
  }
