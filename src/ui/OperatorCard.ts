import type { Handoff, OfferInput, Operator, OperatorView, RequestId } from '../buzz/operator'
import type { SettingsCardProps } from '../buzz/types'
import type { ReactLike } from './OwnerCard'
import {
  buttonStyle,
  CARD,
  ERROR,
  FIELD,
  FIELD_ROW,
  HEADING,
  HINT,
  INPUT,
  LABEL,
  LIST,
  LIST_ITEM,
  LIST_ROW,
  NO_NOTICE,
  type Notice,
  noticeProps,
  OWNER_INPUT,
  PRE,
  ROW,
  ROW_TEXT,
  SECTION,
  TABLE,
  TABLE_WRAP,
  TD,
  TD_KEY,
  TD_OWNER_INPUT,
  TEXT,
  TEXTAREA,
  TH,
  WIDE_FIELD,
} from './styles'

export const TEMPLATE_HELP =
  'Placeholders: {name}, {slot}, {host}, {relay}, {pubkey}, {npub}, {auth_tag}, {file}. ' +
  "{host} = the slot's server label, {relay} = the community relay URL. " +
  'Do not put quotes around placeholders; values are shell-quoted automatically.'

/** Form fields being edited, by key (`add.slot`, `import`, `template`, `offer.<slot>`, …). */
export type Drafts = Record<string, string>

export interface OperatorPanelProps {
  view: OperatorView
  busy: boolean
  notice: Notice
  drafts: Drafts
  onDraft(key: string, value: string): void
  onOffer(input: OfferInput): void
  onOfferOpen(slot: string, owner: string): void
  onImport(text: string): void
  onSaveTemplate(template: string): void
  onSaveOwners(text: string): void
  onDownload(handoff: Handoff): void
  onCopy(text: string, what: string): void
  onConfirm(kind: 'installed' | 'retired', id: RequestId): void
  onCheck(): void
}

type ChangeEvent = { target: { value: string } }

/** The operator's slots, requests and template. Pure: all state comes in through props. */
export const OperatorPanel = (react: ReactLike, props: OperatorPanelProps): unknown => {
  const h = react.createElement
  const { view, busy, drafts } = props
  const draft = (key: string, fallback = ''): string => drafts[key] ?? fallback
  const input = (key: string, placeholder: string, extra: Record<string, unknown> = {}): unknown =>
    h('input', {
      type: 'text',
      value: draft(key),
      placeholder,
      spellCheck: false,
      style: INPUT,
      onChange: (event: ChangeEvent) => props.onDraft(key, event.target.value),
      ...extra,
    })
  /** A text input under a visible label; `wide` gives it a whole row (for a full npub). */
  const field = (key: string, label: string, placeholder: string, wide = false): unknown =>
    h(
      'label',
      { style: wide ? WIDE_FIELD : FIELD },
      h('span', { style: LABEL }, label),
      input(key, placeholder),
    )
  const area = (key: string, label: string, placeholder: string, fallback = ''): unknown =>
    h(
      'label',
      { style: WIDE_FIELD },
      h('span', { style: LABEL }, label),
      h('textarea', {
        value: draft(key, fallback),
        placeholder,
        rows: 3,
        spellCheck: false,
        style: TEXTAREA,
        onChange: (event: ChangeEvent) => props.onDraft(key, event.target.value),
      }),
    )
  const button = (label: string, onClick: () => void): unknown =>
    h('button', { type: 'button', disabled: busy, onClick, style: buttonStyle(busy) }, label)
  const actions = (...children: unknown[]): unknown => h('div', { style: ROW }, ...children)
  const heading = (text: string): unknown => h('h3', { style: HEADING }, text)
  const hint = (text: string): unknown => h('p', { style: HINT }, text)

  const slotsTable = h(
    'div',
    { style: TABLE_WRAP },
    h(
      'table',
      { style: TABLE },
      h(
        'thead',
        null,
        h(
          'tr',
          null,
          ...['Server', 'Slot', 'Host key', 'Owner', 'State', ''].map((title) =>
            h('th', { key: title, style: TH }, title),
          ),
        ),
      ),
      h(
        'tbody',
        null,
        ...view.slots.map((slot) =>
          h(
            'tr',
            { key: slot.slot },
            h('td', { style: TD }, slot.label),
            h('td', { style: TD }, slot.slot),
            h('td', { style: TD_KEY }, slot.fingerprint),
            slot.state === 'open'
              ? h(
                  'td',
                  { style: TD_OWNER_INPUT },
                  input(`offer.${slot.slot}`, 'npub1…', {
                    'aria-label': `Owner npub for ${slot.slot}`,
                    style: OWNER_INPUT,
                  }),
                )
              : h('td', { style: TD_KEY }, slot.owner),
            h('td', { style: TD }, slot.state),
            h(
              'td',
              { style: TD },
              slot.state === 'open'
                ? button('Offer', () => props.onOfferOpen(slot.slot, draft(`offer.${slot.slot}`)))
                : null,
            ),
          ),
        ),
      ),
    ),
  )

  const slotsSection = h(
    'div',
    { style: SECTION },
    heading('Servers'),
    view.slots.length === 0 ? hint('No servers yet. Add one below or import a list.') : slotsTable,
    actions(button('Check now', props.onCheck)),
  )

  const addSection = h(
    'div',
    { style: SECTION },
    heading('Offer a server'),
    hint(
      'Take the host key from your provisioning tool, or from ssh-keyscan checked against a ' +
        'known fingerprint. Only ssh-ed25519 keys are accepted.',
    ),
    h(
      'div',
      { style: FIELD_ROW },
      field('add.slot', 'Slot id', 'vps-1'),
      field('add.label', 'Server label', 'My server'),
      field('add.owner', 'Owner npub', 'npub1…', true),
      area('add.hostKey', 'SSH host public key', 'ssh-ed25519 AAAA…'),
    ),
    actions(
      button('Offer', () =>
        props.onOffer({
          slot: draft('add.slot'),
          label: draft('add.label'),
          hostKeyText: draft('add.hostKey'),
          owner: draft('add.owner'),
        }),
      ),
    ),
  )

  const importSection = h(
    'div',
    { style: SECTION },
    heading('Import servers'),
    hint('A JSON list of {"slot", "label", "hostKey"}; offer each one above.'),
    area(
      'import',
      'Servers as JSON',
      '[{"slot": "vps-1", "label": "…", "hostKey": "ssh-ed25519 …"}]',
    ),
    actions(button('Import', () => props.onImport(draft('import')))),
  )

  const installsSection = h(
    'div',
    { style: SECTION },
    heading('Install requests'),
    view.installs.length === 0
      ? hint('No open install requests.')
      : h(
          'ul',
          { style: LIST },
          ...view.installs.map((install) =>
            h(
              'li',
              { key: install.pubkey, style: LIST_ITEM },
              h(
                'p',
                { style: { ...TEXT, overflowWrap: 'anywhere' } },
                `${install.name} on ${install.label} (${install.slot}) for ${install.owner}`,
              ),
              actions(
                button(`Download ${install.handoff.filename}`, () =>
                  props.onDownload(install.handoff),
                ),
                button('Copy public data', () =>
                  props.onCopy(install.handoff.publicJson, 'Public data'),
                ),
                install.handoff.command === undefined
                  ? null
                  : button('Copy command', () =>
                      props.onCopy(install.handoff.command ?? '', 'Command'),
                    ),
                button('Installed', () => props.onConfirm('installed', install.id)),
              ),
              install.handoff.command === undefined
                ? null
                : h('pre', { style: PRE }, install.handoff.command),
              install.commandError === undefined
                ? null
                : h(
                    'p',
                    { role: 'alert', style: ERROR },
                    `Command template: ${install.commandError}`,
                  ),
            ),
          ),
        ),
  )

  const retireRow = (id: RequestId, text: string): unknown =>
    h(
      'li',
      { key: `${id.slot}:${id.pubkey}`, style: LIST_ROW },
      h('span', { style: ROW_TEXT }, text),
      button('Retired', () => props.onConfirm('retired', id)),
    )
  const noRetires = view.retires.length === 0 && view.adopted.length === 0
  const retiresSection = h(
    'div',
    { style: SECTION },
    heading('Retire requests'),
    noRetires
      ? hint('No open retire requests.')
      : h(
          'ul',
          { style: LIST },
          ...view.retires.map((retire) =>
            retireRow(
              retire.id,
              `Agent ${retire.pubkey.slice(0, 8)} on ${retire.label} (${retire.slot}) for ${retire.owner}`,
            ),
          ),
          ...view.adopted.map((retire) =>
            retireRow(retire.id, `Existing agent ${retire.name} — owner ${retire.owner}`),
          ),
        ),
  )

  const ownersSection = h(
    'div',
    { style: SECTION },
    heading('Known owners'),
    hint(
      'Owners whose existing agents you run. Their messages are read even without a server ' +
        'offered here, so they can ask you to retire an agent. One npub per line.',
    ),
    area('owners', 'Known owners', 'npub1…', view.owners.join('\n')),
    actions(
      button('Save owners', () => props.onSaveOwners(draft('owners', view.owners.join('\n')))),
    ),
  )

  const templateSection = h(
    'div',
    { style: SECTION },
    heading('Command template'),
    hint(TEMPLATE_HELP),
    area(
      'template',
      'Command template',
      'ansible-playbook deploy.yml -e host={host}',
      view.template,
    ),
    actions(button('Save template', () => props.onSaveTemplate(draft('template', view.template)))),
  )

  return h(
    'section',
    { className: 'ui-card', style: CARD },
    props.notice.text === '' ? null : h('p', noticeProps(props.notice), props.notice.text),
    slotsSection,
    addSection,
    importSection,
    installsSection,
    retiresSection,
    ownersSection,
    templateSection,
  )
}

export interface DownloadEnv {
  document: {
    createElement(tag: 'a'): { href: string; download: string; click(): void; remove(): void }
    body: { append(node: never): void }
  }
  URL: { createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void }
}

/** Saves text as a file through a temporary `<a download>`; call from a click handler. */
export const downloadFile = (
  filename: string,
  text: string,
  env: DownloadEnv = globalThis as unknown as DownloadEnv,
): void => {
  const url = env.URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }))
  const anchor = env.document.createElement('a')
  anchor.href = url
  anchor.download = filename
  env.document.body.append(anchor as never)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    env.URL.revokeObjectURL(url)
  }
}

export interface OperatorCardDeps {
  react: ReactLike
  operator: Operator
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** Shown only to the configured operator; renders nothing for anyone else. */
export const operatorCard = (deps: OperatorCardDeps) =>
  function OperatorCard(props: SettingsCardProps): unknown {
    const { react, operator } = deps
    const [view, setView] = react.useState<OperatorView | undefined>(undefined)
    const [drafts, setDrafts] = react.useState<Drafts>({})
    const [notice, setNotice] = react.useState<Notice>(NO_NOTICE)
    const [busy, setBusy] = react.useState(false)

    react.useEffect(() => {
      let live = true
      const refresh = (): void => {
        operator.view().then(
          (next) => {
            if (live) setView(next)
          },
          () => {
            if (live) setView(undefined)
          },
        )
      }
      refresh()
      const stop = operator.subscribe(refresh)
      void operator.pollSafely()
      return () => {
        live = false
        stop()
      }
    }, [])

    if (view === undefined) return null

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
    const clearDrafts = (...keys: string[]): void =>
      setDrafts((previous) =>
        Object.fromEntries(Object.entries(previous).filter(([key]) => !keys.includes(key))),
      )

    return OperatorPanel(react, {
      view,
      busy,
      notice,
      drafts,
      onDraft: (key, value) => setDrafts((previous) => ({ ...previous, [key]: value })),
      onOffer: (input) =>
        run(async () => {
          await operator.offer(input)
          clearDrafts('add.slot', 'add.label', 'add.hostKey', 'add.owner')
          return `Offered ${input.slot} to the owner.`
        }),
      onOfferOpen: (slot, owner) =>
        run(async () => {
          await operator.offerOpen(slot, owner)
          clearDrafts(`offer.${slot}`)
          return `Offered ${slot} to the owner.`
        }),
      onImport: (text) =>
        run(async () => {
          const count = await operator.importSlots(text)
          clearDrafts('import')
          return `Imported ${count} server${count === 1 ? '' : 's'}.`
        }),
      onSaveOwners: (text) =>
        run(async () => {
          await operator.saveOwners(text)
          clearDrafts('owners')
          return 'Known owners saved.'
        }),
      onSaveTemplate: (template) =>
        run(async () => {
          await operator.saveTemplate(template)
          clearDrafts('template')
          return 'Template saved.'
        }),
      onDownload: (handoff) => {
        try {
          downloadFile(handoff.filename, handoff.fileText)
        } catch (error) {
          setNotice({ text: messageOf(error), error: true })
        }
      },
      onCopy: (text, what) =>
        run(async () => {
          await globalThis.navigator.clipboard.writeText(text)
          return `${what} copied.`
        }),
      onConfirm: (kind, id) =>
        run(async () => {
          await operator.confirm(kind, id)
          return kind === 'installed'
            ? 'Told the owner it is installed.'
            : 'Told the owner it is retired.'
        }),
      onCheck: () =>
        run(async () => {
          await operator.poll()
          return 'Checked for messages from owners.'
        }),
    })
  }
