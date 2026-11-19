import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Owner } from '../../src/buzz/owner'
import type { Relay } from '../../src/buzz/relay'
import { createConfiguration, OfferList } from '../../src/ui/CreateConfiguration'
import { OperatorPanel, type OperatorPanelProps } from '../../src/ui/OperatorCard'
import { ownerCard, type ReactLike } from '../../src/ui/OwnerCard'
import { StatusView } from '../../src/ui/StatusTab'

type Node = { type: unknown; props: Record<string, unknown> | null; children: unknown[] }
type StyleProp = Record<string, unknown> | undefined

/** Renders to a plain tree once: state keeps its initial value, effects do not run. */
const treeReact = (states: unknown[] = []): ReactLike => {
  let index = 0
  return {
    createElement: (type, props, ...children) => ({ type, props: props ?? null, children }),
    useState: <T>(initial: T): [T, () => void] => {
      const i = index++
      return [(i < states.length ? states[i] : initial) as T, () => {}]
    },
    useEffect: () => {},
  }
}

const findAll = (node: unknown, match: (n: Node) => boolean): Node[] => {
  if (node === null || typeof node !== 'object') return []
  const n = node as Node
  if (!('children' in n)) return []
  return [...(match(n) ? [n] : []), ...n.children.flatMap((child) => findAll(child, match))]
}

const textOf = (node: unknown): string => {
  if (typeof node === 'string') return node
  if (node === null || typeof node !== 'object' || !('children' in node)) return ''
  return (node as Node).children.map(textOf).join('')
}

const styleOf = (node: Node | undefined): StyleProp => node?.props?.style as StyleProp

const expectBorderedField = (node: Node): void => {
  const style = styleOf(node)
  expect(String(style?.border)).toContain('var(--border-standard)')
  expect(style?.borderRadius).toBeDefined()
  expect(style?.padding).toBeDefined()
  expect(style?.width).toBe('100%')
}

/** A list row: text then actions in a wrapping row; the text has no fixed flex basis. */
const expectHorizontalRow = (row: Node): void => {
  expect(styleOf(row)?.display).toBe('flex')
  expect(styleOf(row)?.flexDirection).toBe('row')
  expect(styleOf(row)?.flexWrap).toBe('wrap')
  const text = row.children.find((c) => (c as Node)?.type === 'span') as Node | undefined
  expect(text).toBeDefined()
  expect(styleOf(text)?.flex).toBe('1 1 auto')
  expect(row.children.some((c) => (c as Node)?.type === 'button')).toBe(true)
}

const VERTICAL_SIZING = ['height', 'minHeight', 'flexBasis', 'flexGrow', 'flex'] as const

/**
 * Lists and their items stay compact and left-aligned: no height, minimum height or flex
 * sizing that could stretch them vertically, start-aligned text, never centred. A child of a
 * column-direction item must not flex either (that would grow it vertically).
 */
const expectCompactLists = (tree: unknown): void => {
  const lists = findAll(tree, (n) => n.type === 'ul')
  const items = findAll(tree, (n) => n.type === 'li')
  expect(lists.length).toBeGreaterThan(0)
  expect(items.length).toBeGreaterThan(0)
  for (const node of [...lists, ...items]) {
    const style = styleOf(node)
    for (const key of VERTICAL_SIZING) expect(style?.[key]).toBeUndefined()
    expect(['start', 'left']).toContain(String(style?.textAlign))
    expect(style?.justifyContent ?? 'flex-start').toBe('flex-start')
  }
  for (const list of lists) expect(styleOf(list)?.flexDirection).toBe('column')
  for (const item of items) {
    const style = styleOf(item)
    if (style?.flexDirection === 'row') {
      expect(style?.alignItems).toBe('center')
      continue
    }
    for (const child of item.children) {
      const childStyle = styleOf(child as Node)
      for (const key of VERTICAL_SIZING) expect(childStyle?.[key]).toBeUndefined()
    }
  }
}

const expectHostButtons = (tree: unknown): void => {
  const buttons = findAll(tree, (n) => n.type === 'button')
  expect(buttons.length).toBeGreaterThan(0)
  for (const button of buttons) {
    expect(button.props?.type).toBe('button')
    expect(String(styleOf(button)?.border)).toContain('var(--border-standard)')
    expect(styleOf(button)?.padding).toBeDefined()
  }
}

const expectStyledHeadings = (tree: unknown, count: number): void => {
  const headings = findAll(tree, (n) => n.type === 'h3')
  expect(headings).toHaveLength(count)
  for (const heading of headings) expect(styleOf(heading)?.fontSize).toBe('var(--text-label)')
}

// Checked by hand against block/buzz-app desktop-v1.0.5:
// src/shared/design-system/styles/{tokens,typography}.css and src/shared/styles/globals.css.
const BUZZ_1_0_5_TOKENS = new Set([
  '--space-panel-inset',
  '--space-1',
  '--space-1h',
  '--space-2',
  '--space-3',
  '--space-4',
  '--space-6',
  '--text-label',
  '--text-body',
  '--text-body-sm',
  '--text-caption',
  '--type-weight-medium',
  '--text-standard',
  '--text-subtle',
  '--text-danger',
  '--border-standard',
  '--radius-control',
  '--radius-row',
  '--radius-pill',
  '--surface-inset',
  '--surface-panel',
  '--font-mono',
])

test('the UI uses only design tokens that exist in Buzz 1.0.5', () => {
  const dir = resolve(import.meta.dir, '../../src/ui')
  const used = new Set<string>()
  for (const file of readdirSync(dir))
    for (const match of readFileSync(resolve(dir, file), 'utf8').matchAll(/var\((--[a-z0-9-]+)/g))
      if (match[1] !== undefined) used.add(match[1])
  expect(used.size).toBeGreaterThan(0)
  expect([...used].filter((token) => !BUZZ_1_0_5_TOKENS.has(token))).toEqual([])
})

const noop = (): void => {}
const operatorProps = (overrides: Partial<OperatorPanelProps> = {}): OperatorPanelProps => ({
  view: {
    template: '',
    owners: [],
    slots: [
      { slot: 'vps-1', label: 'One', fingerprint: 'SHA256:aaa', owner: 'npub1x', state: 'offered' },
      { slot: 'vps-2', label: 'Two', fingerprint: 'SHA256:bbb', owner: '', state: 'open' },
    ],
    installs: [],
    retires: [],
    adopted: [],
  },
  busy: false,
  notice: { text: '', error: false },
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

describe('operator card', () => {
  const tree = OperatorPanel(treeReact(), operatorProps())

  test('is a host card with padding and section headings', () => {
    const card = tree as Node
    expect(card.props?.className).toBe('ui-card')
    expect(styleOf(card)?.padding).toBe('var(--space-panel-inset)')
    expectStyledHeadings(tree, 7)
  })

  test('text inputs and textareas are bordered, padded and full width', () => {
    const fields = findAll(
      tree,
      (n) => (n.type === 'input' && n.props?.type === 'text') || n.type === 'textarea',
    )
    expect(fields.length).toBeGreaterThanOrEqual(7)
    for (const field of fields) expectBorderedField(field)
  })

  test('the add-server fields carry visible labels, the owner npub a whole row', () => {
    const labels = findAll(tree, (n) => n.type === 'label')
    for (const text of ['Slot id', 'Server label', 'Owner npub', 'SSH host public key'])
      expect(labels.some((label) => textOf(label).startsWith(text))).toBe(true)
    const owner = labels.find((label) => textOf(label).startsWith('Owner npub'))
    expect(styleOf(owner)?.flex).toBe('1 1 100%')
  })

  test('buttons are host button elements with a border', () => {
    expectHostButtons(tree)
  })

  test('the servers table has a header row and keeps short words whole', () => {
    const headers = findAll(tree, (n) => n.type === 'th')
    expect(headers.map(textOf)).toEqual(['Server', 'Slot', 'Host key', 'Owner', 'State', ''])
    for (const header of headers) expect(styleOf(header)?.whiteSpace).toBe('nowrap')
    const cells = findAll(tree, (n) => n.type === 'td')
    const cell = (text: string) => cells.find((c) => textOf(c) === text)
    for (const text of ['One', 'vps-1', 'offered'])
      expect(styleOf(cell(text))?.whiteSpace).toBe('nowrap')
    expect(styleOf(cell('SHA256:aaa'))?.overflowWrap).toBe('anywhere')
    expect(styleOf(cell('npub1x'))?.overflowWrap).toBe('anywhere')
  })

  test('the open slot owner input is wide enough for a full npub', () => {
    const input = findAll(tree, (n) => n.props?.['aria-label'] === 'Owner npub for vps-2')[0]
    expect(input).toBeDefined()
    if (input !== undefined) expectBorderedField(input)
    // A full 63-character npub fits: monospaced caption text in a cell of at least 32rem.
    expect(styleOf(input)?.fontFamily).toBe('var(--font-mono)')
    expect(styleOf(input)?.fontSize).toBe('var(--text-caption)')
    const cell = findAll(tree, (n) => n.type === 'td' && findAll(n, (c) => c === input).length > 0)
    expect(Number.parseFloat(String(styleOf(cell[0])?.minWidth))).toBeGreaterThanOrEqual(32)
    expect(String(styleOf(cell[0])?.minWidth)).toEndWith('rem')
  })

  test('a narrow card scrolls the servers table instead of clipping it', () => {
    const wrap = findAll(
      tree,
      (n) => n.type === 'div' && findAll(n, (c) => c.type === 'table').length > 0,
    )
    const direct = wrap.find((n) => n.children.some((c) => (c as Node)?.type === 'table'))
    expect(styleOf(direct)?.overflowX).toBe('auto')
    expect(styleOf(direct)?.maxWidth).toBe('100%')
  })

  test('retire rows lay out text then action side by side, wrapping when narrow', () => {
    const withRetires = OperatorPanel(
      treeReact(),
      operatorProps({
        view: {
          ...operatorProps().view,
          retires: [
            {
              id: { slot: 'vps-1', pubkey: 'b'.repeat(64), owner: 'f'.repeat(64) },
              pubkey: 'b'.repeat(64),
              slot: 'vps-1',
              label: 'One',
              owner: 'npub1x',
            },
          ],
        },
      }),
    )
    const rows = findAll(withRetires, (n) => n.type === 'li')
    expect(rows).toHaveLength(1)
    for (const row of rows) expectHorizontalRow(row)
  })

  test('install and retire requests are compact, left-aligned list items', () => {
    const base = operatorProps().view
    const tree = OperatorPanel(
      treeReact(),
      operatorProps({
        view: {
          ...base,
          installs: [
            {
              id: { slot: 'vps-1', pubkey: 'a'.repeat(64), owner: 'f'.repeat(64) },
              pubkey: 'a'.repeat(64),
              name: 'Robo',
              slot: 'vps-1',
              label: 'One',
              owner: 'npub1x',
              handoff: { filename: 'vps-1.age', fileText: 's', publicJson: '{}', command: 'x' },
            },
          ],
          adopted: [
            {
              id: { slot: 'adopted', pubkey: 'c'.repeat(64), owner: 'f'.repeat(64) },
              pubkey: 'c'.repeat(64),
              name: 'Old',
              owner: 'npub1x',
            },
          ],
        },
      }),
    )
    expect(findAll(tree, (n) => n.type === 'li')).toHaveLength(2)
    expectCompactLists(tree)
  })

  test('an error line uses the danger colour, a result line does not', () => {
    const failed = OperatorPanel(
      treeReact(),
      operatorProps({ notice: { text: 'Bad key', error: true } }),
    )
    const alert = findAll(failed, (n) => n.props?.role === 'alert')[0]
    expect(textOf(alert)).toBe('Bad key')
    expect(styleOf(alert)?.color).toBe('var(--text-danger)')
    const done = OperatorPanel(
      treeReact(),
      operatorProps({ notice: { text: 'Saved', error: false } }),
    )
    const status = findAll(done, (n) => n.props?.role === 'status')[0]
    expect(textOf(status)).toBe('Saved')
    expect(styleOf(status)?.color).toBe('var(--text-subtle)')
  })
})

describe('owner card', () => {
  const card = (states: unknown[] = []) =>
    ownerCard({
      react: treeReact(states),
      owner: {} as Owner,
      relay: {} as Relay,
      agents: { subscribe: () => () => {} },
    })({ active: () => true })

  test('is a host card with styled section headings', () => {
    const tree = card()
    expect(styleOf(tree as Node)?.padding).toBe('var(--space-panel-inset)')
    expectStyledHeadings(tree, 4)
  })

  test('the operator npub input is labelled, bordered and has a whole row', () => {
    const tree = card()
    const label = findAll(tree, (n) => n.type === 'label')[0]
    expect(textOf(label)).toContain('Operator npub')
    expect(styleOf(label)?.flex).toBe('1 1 100%')
    const input = findAll(tree, (n) => n.type === 'input')[0]
    expect(input).toBeDefined()
    if (input !== undefined) expectBorderedField(input)
  })

  test('buttons are host button elements with a border', () => {
    expectHostButtons(card())
  })

  test('a failed action shows in the danger colour', () => {
    // States in order: view, viewError, operatorDraft, notice.
    const tree = card([
      undefined,
      '',
      undefined,
      { text: 'Enter the operator as an npub', error: true },
    ])
    const alert = findAll(tree, (n) => n.props?.role === 'alert')[0]
    expect(textOf(alert)).toBe('Enter the operator as an npub')
    expect(styleOf(alert)?.color).toBe('var(--text-danger)')
  })

  test('agent rows lay out text then actions side by side, wrapping when narrow', () => {
    const view = {
      operator: '',
      offers: [],
      agents: [
        {
          pubkey: 'd'.repeat(64),
          name: 'Robo',
          status: 'Installed',
          canRetire: true,
          canCancelRetire: false,
        },
      ],
    }
    const rows = findAll(card([view]), (n) => n.type === 'li')
    expect(rows).toHaveLength(1)
    for (const row of rows) expectHorizontalRow(row)
  })

  test('offer, agent and adopt rows are compact, left-aligned rows', () => {
    const view = {
      operator: '',
      offers: [{ slot: 'buzztest-2', label: 'buzztest' }],
      agents: [
        {
          pubkey: 'd'.repeat(64),
          name: 'Robo',
          status: 'Installed',
          canRetire: true,
          canCancelRetire: false,
        },
      ],
    }
    const adoptables = {
      ok: true,
      items: [{ pubkey: 'e'.repeat(64), name: 'Old', state: 'ready' }],
    }
    // States in order: view, viewError, operatorDraft, notice, busy, adoptables.
    const tree = card([view, '', undefined, { text: '', error: false }, false, adoptables])
    expect(findAll(tree, (n) => n.type === 'li')).toHaveLength(3)
    expectCompactLists(tree)
    const offer = findAll(tree, (n) => n.type === 'li')[0]
    expect(styleOf(offer)?.flexDirection).toBe('row')
  })

  test('a view error shows in the danger colour', () => {
    const tree = card([undefined, 'Not connected to a community yet'])
    const alert = findAll(tree, (n) => n.props?.role === 'alert')[0]
    expect(styleOf(alert)?.color).toBe('var(--text-danger)')
  })
})

describe('create picker and status tab', () => {
  test('offers are spaced rows with their label beside the radio', () => {
    const tree = OfferList(treeReact(), {
      offers: [{ slot: 'vps-1', label: 'My VPS' }],
      slot: '',
      disabled: false,
      onChoose: noop,
    })
    const row = findAll(tree, (n) => n.type === 'label')[0]
    expect(styleOf(row)?.display).toBe('flex')
    expect(styleOf(row)?.gap).toBe('var(--space-2)')
  })

  test('a read error in the picker shows in the danger colour', () => {
    const component = createConfiguration({
      react: treeReact([undefined, 'offline']),
      owner: {} as Owner,
    })
    const tree = component({
      config: { slot: '' },
      onChange: noop,
      disabled: false,
      harnessControl: null,
    })
    const alert = findAll(tree, (n) => n.props?.role === 'alert')[0]
    expect(textOf(alert)).toContain('offline')
    expect(styleOf(alert)?.color).toBe('var(--text-danger)')
  })

  test('the status tab has host buttons and shows a failure in the danger colour', () => {
    const tree = StatusView(treeReact(), {
      status: { text: 'Installed', canRetire: true, canCancelRetire: false },
      busy: false,
      notice: 'Set the operator first',
      onRetire: noop,
      onCancelRetire: noop,
    })
    expect(styleOf(tree as Node)?.padding).toBe('var(--space-panel-inset)')
    expectHostButtons(tree)
    const alert = findAll(tree, (n) => n.props?.role === 'alert')[0]
    expect(textOf(alert)).toBe('Set the operator first')
    expect(styleOf(alert)?.color).toBe('var(--text-danger)')
  })
})
