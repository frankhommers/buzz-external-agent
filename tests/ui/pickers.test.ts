import { expect, test } from 'bun:test'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Owner } from '../../src/buzz/owner'
import type { Agent } from '../../src/buzz/types'
import {
  createConfiguration,
  isReady,
  NO_OFFERS_TEXT,
  OfferList,
} from '../../src/ui/CreateConfiguration'
import type { ReactLike } from '../../src/ui/OwnerCard'
import { StatusView, statusTab } from '../../src/ui/StatusTab'

const react = React as unknown as ReactLike
const html = (element: unknown): string => renderToStaticMarkup(element as React.ReactElement)

test('with no offers the picker says to ask the operator', () => {
  const out = html(OfferList(react, { offers: [], slot: '', disabled: false, onChoose: () => {} }))
  expect(out).toContain('No server is ready for you yet. Ask your server admin.')
  expect(NO_OFFERS_TEXT).toBe('No server is ready for you yet. Ask your server admin.')
  expect(out).not.toContain('radio')
})

test('an offer is listed with its label and slot, and the chosen one is checked', () => {
  const offers = [
    { slot: 'vps-1', label: 'My VPS' },
    { slot: 'vps-2', label: 'Other' },
  ]
  const out = html(OfferList(react, { offers, slot: 'vps-2', disabled: false, onChoose: () => {} }))
  expect(out).toContain('My VPS')
  expect(out).toContain('vps-1')
  expect(out).toContain('Other')
  expect(out.match(/type="radio"/g)).toHaveLength(2)
  expect(out.match(/checked=""/g)).toHaveLength(1)
})

test('isReady needs the chosen slot to be a listed offer', () => {
  const offers = [{ slot: 'vps-1', label: 'My VPS' }]
  expect(isReady([], 'vps-1')).toBe(false)
  expect(isReady(offers, 'gone')).toBe(false)
  expect(isReady(offers, '')).toBe(false)
  expect(isReady(offers, 'vps-1')).toBe(true)
})

test('CreateConfiguration renders the harness row and a loading state', () => {
  const owner = { view: () => new Promise(() => {}) } as unknown as Owner
  const Component = createConfiguration({ react, owner })
  const out = html(
    React.createElement(Component as never, {
      config: { slot: '' },
      onChange: () => {},
      disabled: false,
      harnessControl: React.createElement('div', null, 'Harness row'),
    }),
  )
  expect(out).toContain('Harness row')
  expect(out).toContain('Looking for your servers')
})

type Node = { type: unknown; props: Record<string, unknown> | null; children: unknown[] }

/** useState/useEffect run synchronously; each render re-runs effects whose deps changed. */
const syncReact = () => {
  const states: unknown[] = []
  const depsSeen: (readonly unknown[] | undefined)[] = []
  const cleanups: ((() => void) | undefined)[] = []
  let cursorState = 0
  let cursorEffect = 0
  let rerender = (): void => {}
  const api: ReactLike = {
    createElement: (type, props, ...children) => ({ type, props: props ?? null, children }),
    useState: <T>(initial: T): [T, (next: T | ((previous: T) => T)) => void] => {
      const i = cursorState++
      if (!(i in states)) states[i] = initial
      return [
        states[i] as T,
        (next) => {
          states[i] = typeof next === 'function' ? (next as (p: T) => T)(states[i] as T) : next
          rerender()
        },
      ]
    },
    useEffect: (effect, deps) => {
      const i = cursorEffect++
      const previous = depsSeen[i]
      const same =
        deps !== undefined && previous !== undefined && deps.every((d, n) => d === previous[n])
      if (same) return
      cleanups[i]?.()
      depsSeen[i] = deps
      cleanups[i] = effect()
    },
  }
  const render = (component: () => unknown): void => {
    rerender = () => {
      cursorState = 0
      cursorEffect = 0
      component()
    }
    rerender()
  }
  return { api, render }
}

const find = (node: unknown, test: (n: Node) => boolean): Node | undefined => {
  if (node === null || typeof node !== 'object') return undefined
  const n = node as Node
  if (test(n)) return n
  for (const child of n.children) {
    const found = find(child, test)
    if (found !== undefined) return found
  }
  return undefined
}

test('onReadyChange follows the chosen offer: false, true once chosen, false when it vanishes', async () => {
  const readiness: boolean[] = []
  let offers = [{ slot: 'vps-1', label: 'My VPS' }]
  const owner = { view: async () => ({ operator: '', offers, agents: [] }) }
  const { api, render } = syncReact()
  const Component = createConfiguration({ react: api, owner })
  let config = { slot: '' }
  let tree: unknown
  const draw = (): unknown =>
    (tree = Component({
      config,
      onChange: (next: { slot: string }) => {
        config = next
        render(draw)
      },
      disabled: false,
      harnessControl: null,
      onReadyChange: (ready: boolean) => readiness.push(ready),
    }))
  render(draw)
  await Promise.resolve()
  await Promise.resolve()
  expect(readiness.at(-1)).toBe(false)
  expect(readiness).not.toContain(true)

  const radio = find(tree, (n) => n.type === 'input' && n.props?.value === 'vps-1')
  expect(radio).toBeDefined()
  ;(radio?.props?.onChange as () => void)?.()
  expect(readiness.at(-1)).toBe(true)

  // The offer disappears while it is still the chosen slot: a fresh mount reports not ready.
  offers = []
  const second = syncReact()
  const Remounted = createConfiguration({ react: second.api, owner })
  second.render(() =>
    Remounted({
      config,
      onChange: () => {},
      disabled: false,
      harnessControl: null,
      onReadyChange: (ready: boolean) => readiness.push(ready),
    }),
  )
  await Promise.resolve()
  await Promise.resolve()
  expect(readiness.at(-1)).toBe(false)
})

const agent = (pubkey: string): Agent =>
  ({
    pubkey,
    name: 'Robo',
    type: 'x',
    owner: 'o',
    relay: 'r',
    place: 'hosted',
    config: {},
  }) as Agent

test.each([
  ['Waiting for installation', true, false],
  ['Installed', true, false],
  ['Retirement requested — waiting for your server admin', false, true],
  ['Stopped by your server admin — you can delete it now', false, false],
  ['Unknown — set up outside this device', true, false],
])('status view shows %s, retire hidden when retiring', (text, canRetire, canCancelRetire) => {
  const out = html(
    StatusView(react, {
      status: { text, canRetire, canCancelRetire },
      busy: false,
      notice: '',
      onRetire: () => {},
      onCancelRetire: () => {},
    }),
  )
  expect(out).toContain(text)
  expect(out.includes('>Retire</button>')).toBe(canRetire)
  expect(out.includes('>Cancel retire request</button>')).toBe(canCancelRetire)
})

test('status tab applies to our runtime only', () => {
  const owner = {} as Owner
  const tab = statusTab({ react, owner })
  expect(tab.id).toBe('status')
  expect(tab.title).toBe('Server')
  expect(
    tab.when?.({ ...agent('a'), type: 'io.github.frankhommers.selfhosted-agents/agent' }),
  ).toBe(true)
  expect(tab.when?.(agent('a'))).toBe(false)
})
