import type { Handoff, OfferInput, Operator, OperatorView } from '../buzz/operator'
import type { SettingsCardProps } from '../buzz/types'
import type { ReactLike } from './OwnerCard'

export const TEMPLATE_HELP =
  'Placeholders: {name}, {slot}, {host}, {pubkey}, {npub}, {auth_tag}, {file}. ' +
  'Do not put quotes around placeholders; values are shell-quoted automatically.'

const PANEL_STYLE = { padding: 'var(--space-panel-inset)' }
const ROW_STYLE = { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }
const PRE_STYLE = { whiteSpace: 'pre-wrap', wordBreak: 'break-all' }

/** Form fields being edited, by key (`add.slot`, `import`, `template`, `offer.<slot>`, …). */
export type Drafts = Record<string, string>

export interface OperatorPanelProps {
  view: OperatorView
  busy: boolean
  notice: string
  drafts: Drafts
  onDraft(key: string, value: string): void
  onOffer(input: OfferInput): void
  onOfferOpen(slot: string, owner: string): void
  onImport(text: string): void
  onSaveTemplate(template: string): void
  onDownload(handoff: Handoff): void
  onCopy(text: string, what: string): void
  onConfirm(kind: 'installed' | 'retired', pubkey: string): void
  onCheck(): void
}

type ChangeEvent = { target: { value: string } }

/** The operator's slots, requests and template. Pure: all state comes in through props. */
export const OperatorPanel = (react: ReactLike, props: OperatorPanelProps): unknown => {
  const h = react.createElement
  const { view, busy, drafts } = props
  const draft = (key: string, fallback = ''): string => drafts[key] ?? fallback
  const field = (key: string, label: string, placeholder: string, fallback = ''): unknown =>
    h('input', {
      type: 'text',
      value: draft(key, fallback),
      placeholder,
      'aria-label': label,
      onChange: (event: ChangeEvent) => props.onDraft(key, event.target.value),
    })
  const area = (key: string, label: string, placeholder: string, fallback = ''): unknown =>
    h('textarea', {
      value: draft(key, fallback),
      placeholder,
      'aria-label': label,
      rows: 3,
      onChange: (event: ChangeEvent) => props.onDraft(key, event.target.value),
    })
  const button = (label: string, onClick: () => void): unknown =>
    h('button', { type: 'button', disabled: busy, onClick }, label)

  const slotsSection = h(
    'div',
    null,
    h('h3', null, 'Servers'),
    view.slots.length === 0
      ? h('p', null, 'No servers yet. Add one below or import a list.')
      : h(
          'table',
          null,
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              ...['Server', 'Slot', 'Host key', 'Owner', 'State', ''].map((title) =>
                h('th', { key: title }, title),
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
                h('td', null, slot.label),
                h('td', null, slot.slot),
                h('td', null, slot.fingerprint),
                h(
                  'td',
                  null,
                  slot.state === 'open'
                    ? field(`offer.${slot.slot}`, `Owner npub for ${slot.slot}`, 'npub1…')
                    : slot.owner,
                ),
                h('td', null, slot.state),
                h(
                  'td',
                  null,
                  slot.state === 'open'
                    ? button('Offer', () =>
                        props.onOfferOpen(slot.slot, draft(`offer.${slot.slot}`)),
                      )
                    : null,
                ),
              ),
            ),
          ),
        ),
    button('Check now', props.onCheck),
  )

  const addSection = h(
    'div',
    null,
    h('h3', null, 'Offer a server'),
    h(
      'p',
      null,
      'Take the host key from your provisioning tool, or from ssh-keyscan checked against a ' +
        'known fingerprint. Only ssh-ed25519 keys are accepted.',
    ),
    h(
      'div',
      { style: ROW_STYLE },
      field('add.slot', 'Slot id', 'vps-1'),
      field('add.label', 'Server label', 'My server'),
      field('add.owner', 'Owner npub', 'npub1…'),
    ),
    area('add.hostKey', 'SSH host public key', 'ssh-ed25519 AAAA…'),
    button('Offer', () =>
      props.onOffer({
        slot: draft('add.slot'),
        label: draft('add.label'),
        hostKeyText: draft('add.hostKey'),
        owner: draft('add.owner'),
      }),
    ),
    h('h3', null, 'Import servers'),
    h('p', null, 'A JSON list of {"slot", "label", "hostKey"}; offer each one above.'),
    area(
      'import',
      'Servers as JSON',
      '[{"slot": "vps-1", "label": "…", "hostKey": "ssh-ed25519 …"}]',
    ),
    button('Import', () => props.onImport(draft('import'))),
  )

  const installsSection = h(
    'div',
    null,
    h('h3', null, 'Install requests'),
    view.installs.length === 0
      ? h('p', null, 'No open install requests.')
      : h(
          'ul',
          null,
          ...view.installs.map((install) =>
            h(
              'li',
              { key: install.pubkey },
              h(
                'p',
                null,
                `${install.name} on ${install.label} (${install.slot}) for ${install.owner}`,
              ),
              h(
                'div',
                { style: ROW_STYLE },
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
                button('Installed', () => props.onConfirm('installed', install.pubkey)),
              ),
              install.handoff.command === undefined
                ? null
                : h('pre', { style: PRE_STYLE }, install.handoff.command),
              install.commandError === undefined
                ? null
                : h('p', { role: 'alert' }, `Command template: ${install.commandError}`),
            ),
          ),
        ),
  )

  const retiresSection = h(
    'div',
    null,
    h('h3', null, 'Retire requests'),
    view.retires.length === 0
      ? h('p', null, 'No open retire requests.')
      : h(
          'ul',
          null,
          ...view.retires.map((retire) =>
            h(
              'li',
              { key: retire.pubkey, style: ROW_STYLE },
              h(
                'span',
                null,
                `Agent ${retire.pubkey.slice(0, 8)} on ${retire.label} (${retire.slot}) for ${retire.owner}`,
              ),
              button('Retired', () => props.onConfirm('retired', retire.pubkey)),
            ),
          ),
        ),
  )

  const templateSection = h(
    'div',
    null,
    h('h3', null, 'Command template'),
    h('p', null, TEMPLATE_HELP),
    area(
      'template',
      'Command template',
      'ansible-playbook deploy.yml -e host={host}',
      view.template,
    ),
    button('Save template', () => props.onSaveTemplate(draft('template', view.template))),
  )

  return h(
    'section',
    { className: 'ui-card', style: PANEL_STYLE },
    props.notice === '' ? null : h('p', { role: 'status' }, props.notice),
    slotsSection,
    addSection,
    installsSection,
    retiresSection,
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
    const [notice, setNotice] = react.useState('')
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
          setNotice(messageOf(error))
        }
      },
      onCopy: (text, what) =>
        run(async () => {
          await globalThis.navigator.clipboard.writeText(text)
          return `${what} copied.`
        }),
      onConfirm: (kind, pubkey) =>
        run(async () => {
          await operator.confirm(kind, pubkey)
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
