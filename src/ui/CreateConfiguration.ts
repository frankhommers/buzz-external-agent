import type { OfferRow, Owner } from '../buzz/owner'
import type { SelfHostedConfig } from '../buzz/provider'
import type { CreateConfigurationProps } from '../buzz/types'
import type { ReactLike } from './OwnerCard'

export const NO_OFFERS_TEXT = 'No server is ready for you yet. Ask your operator.'
const LOADING_TEXT = 'Looking for your servers…'
const ERROR_TEXT = 'Could not read your servers: '

const LIST_STYLE = { display: 'flex', flexDirection: 'column', gap: '0.5rem' }
const ROW_STYLE = { display: 'flex', gap: '0.5rem', alignItems: 'center' }

export interface OfferListProps {
  offers: readonly OfferRow[]
  slot: string
  disabled: boolean
  onChoose(slot: string): void
}

/** The open offers as a single-choice list, or the reason there is nothing to choose. */
export const OfferList = (react: ReactLike, props: OfferListProps): unknown => {
  const h = react.createElement
  if (props.offers.length === 0) return h('p', null, NO_OFFERS_TEXT)
  return h(
    'div',
    { role: 'radiogroup', 'aria-label': 'Server', style: LIST_STYLE },
    ...props.offers.map((offer) =>
      h(
        'label',
        { key: offer.slot, style: ROW_STYLE },
        h('input', {
          type: 'radio',
          name: 'selfhosted-agents-slot',
          value: offer.slot,
          checked: props.slot === offer.slot,
          disabled: props.disabled,
          onChange: () => props.onChoose(offer.slot),
        }),
        h('span', null, `${offer.label} (${offer.slot})`),
      ),
    ),
  )
}

/** Ready only when the chosen slot is one of the offers shown. */
export const isReady = (offers: readonly OfferRow[], slot: string): boolean =>
  offers.some((offer) => offer.slot === slot)

export interface CreateConfigurationDeps {
  react: ReactLike
  owner: Pick<Owner, 'view'>
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const createConfiguration = (deps: CreateConfigurationDeps) =>
  function CreateConfiguration(props: CreateConfigurationProps<SelfHostedConfig>): unknown {
    const { react, owner } = deps
    const h = react.createElement
    const [offers, setOffers] = react.useState<readonly OfferRow[] | undefined>(undefined)
    const [error, setError] = react.useState('')
    const { onReadyChange } = props

    react.useEffect(() => {
      let live = true
      owner.view().then(
        (view) => {
          if (live) setOffers(view.offers)
        },
        (failure: unknown) => {
          if (live) setError(messageOf(failure))
        },
      )
      return () => {
        live = false
      }
    }, [])

    const ready = offers !== undefined && isReady(offers, props.config.slot)
    react.useEffect(() => {
      onReadyChange?.(ready)
      return undefined
    }, [onReadyChange, ready])

    const list =
      error !== ''
        ? h('p', { role: 'alert' }, `${ERROR_TEXT}${error}`)
        : offers === undefined
          ? h('p', null, LOADING_TEXT)
          : OfferList(react, {
              offers,
              slot: props.config.slot,
              disabled: props.disabled,
              onChoose: (slot) => props.onChange({ slot }),
            })

    return h('div', null, props.harnessControl, list)
  }
