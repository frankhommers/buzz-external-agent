import { expect, test } from 'bun:test'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { InstallRow, Operator, OperatorView } from '../../src/buzz/operator'
import {
  downloadFile,
  OperatorPanel,
  type OperatorPanelProps,
  operatorCard,
  TEMPLATE_HELP,
} from '../../src/ui/OperatorCard'
import type { ReactLike } from '../../src/ui/OwnerCard'

const react = React as unknown as ReactLike
const html = (element: unknown): string => renderToStaticMarkup(element as React.ReactElement)

const view: OperatorView = {
  template: 'deploy {name}',
  owners: ['npub1known'],
  slots: [
    {
      slot: 'vps-1',
      label: 'One',
      fingerprint: 'SHA256:aaa',
      owner: 'npub1owner',
      state: 'requested',
    },
    { slot: 'vps-2', label: 'Two', fingerprint: 'SHA256:bbb', owner: '', state: 'open' },
  ],
  installs: [
    {
      pubkey: 'a'.repeat(64),
      name: 'Robo',
      slot: 'vps-1',
      label: 'One',
      owner: 'npub1owner',
      handoff: {
        filename: 'vps-1.age',
        fileText: 'sealed',
        publicJson: '{}',
        command: "deploy 'Robo'",
      },
    },
  ],
  retires: [{ pubkey: 'b'.repeat(64), slot: 'vps-3', label: 'Three', owner: 'npub1owner' }],
  adopted: [{ pubkey: 'c'.repeat(64), name: 'Old agent', owner: 'npub1owner' }],
}

const noop = (): void => {}
const props = (overrides: Partial<OperatorPanelProps> = {}): OperatorPanelProps => ({
  view,
  busy: false,
  notice: '',
  drafts: {},
  onDraft: noop,
  onOffer: noop,
  onOfferOpen: noop,
  onImport: noop,
  onSaveTemplate: noop,
  onSaveOwners: noop,
  onDownload: noop,
  onCopy: noop,
  onConfirm: noop,
  onCheck: noop,
  ...overrides,
})

test('the template help says placeholders must not be quoted', () => {
  expect(TEMPLATE_HELP).toContain(
    'Do not put quotes around placeholders; values are shell-quoted automatically.',
  )
  expect(html(OperatorPanel(react, props()))).toContain(
    'Do not put quotes around placeholders; values are shell-quoted automatically.',
  )
})

test('lists slots with their state, requests with handoff actions, and retire requests', () => {
  const out = html(OperatorPanel(react, props()))
  for (const text of [
    'vps-1',
    'requested',
    'SHA256:aaa',
    'vps-2',
    'open',
    'Robo',
    'Download vps-1.age',
    'Copy public data',
    'deploy &#x27;Robo&#x27;',
    'Installed',
    'Three',
    'Retired',
    'Offer',
    'Import',
  ])
    expect(out).toContain(text)
})

test('lists known owners and adopted retire requests with a Retired button', () => {
  const retired: string[] = []
  const out = html(OperatorPanel(react, props()))
  expect(out).toContain('Known owners')
  expect(out).toContain('npub1known')
  expect(out).toContain('Existing agent Old agent — owner npub1owner')
  const tree = OperatorPanel(
    { ...react, createElement: (type, p, ...children) => ({ type, props: p, children }) },
    props({ onConfirm: (kind, pubkey) => void retired.push(`${kind} ${pubkey}`) }),
  )
  const buttons: { props: { onClick(): void }; children: unknown[] }[] = []
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return
    const n = node as { type: unknown; props: { onClick(): void }; children: unknown[] }
    if (n.type === 'button') buttons.push(n)
    for (const child of n.children ?? []) walk(child)
  }
  walk(tree)
  for (const b of buttons.filter((b) => b.children.includes('Retired'))) b.props.onClick()
  expect(retired).toEqual([`retired ${'b'.repeat(64)}`, `retired ${'c'.repeat(64)}`])
})

test('a template error is shown instead of the command', () => {
  const install: InstallRow = {
    pubkey: 'a'.repeat(64),
    name: 'Robo',
    slot: 'vps-1',
    label: 'One',
    owner: 'npub1owner',
    handoff: { filename: 'vps-1.age', fileText: 's', publicJson: '{}' },
    commandError: 'Unknown placeholder {x}',
  }
  const out = html(OperatorPanel(react, props({ view: { ...view, installs: [install] } })))
  expect(out).toContain('Unknown placeholder {x}')
  expect(out).not.toContain('Copy command')
})

test('the card renders nothing until the operator view is loaded, without side effects', () => {
  const effects: unknown[] = []
  let calls = 0
  const fake: ReactLike = {
    createElement: (type, p, ...children) => ({ type, props: p, children }),
    useState: <T>(initial: T): [T, () => void] => [initial, () => {}],
    useEffect: (effect) => void effects.push(effect),
  }
  const operator = new Proxy({} as Operator, {
    get: () => () => {
      calls++
      return Promise.resolve()
    },
  })
  const component = operatorCard({ react: fake, operator })
  expect(component({ active: () => true })).toBeNull()
  expect(effects).toHaveLength(1)
  expect(calls).toBe(0)
})

test('downloadFile clicks a temporary link and revokes its blob URL', async () => {
  const events: string[] = []
  let blob: Blob | undefined
  const anchor = {
    href: '',
    download: '',
    click: () => events.push(`click ${anchor.download} ${anchor.href}`),
    remove: () => events.push('remove'),
  }
  downloadFile('vps-1.age', 'sealed text', {
    document: {
      createElement: () => anchor,
      body: { append: () => events.push('append') },
    },
    URL: {
      createObjectURL: (value: Blob) => {
        blob = value
        return 'blob:1'
      },
      revokeObjectURL: (url: string) => events.push(`revoke ${url}`),
    },
  })
  expect(events).toEqual(['append', 'click vps-1.age blob:1', 'remove', 'revoke blob:1'])
  expect(await blob?.text()).toBe('sealed text')
})
