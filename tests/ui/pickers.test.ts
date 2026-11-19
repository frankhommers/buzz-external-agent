import { expect, test } from 'bun:test'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Owner } from '../../src/buzz/owner'
import type { Agent } from '../../src/buzz/types'
import { createConfiguration, NO_OFFERS_TEXT, OfferList } from '../../src/ui/CreateConfiguration'
import type { ReactLike } from '../../src/ui/OwnerCard'
import { StatusView, statusTab } from '../../src/ui/StatusTab'

const react = React as unknown as ReactLike
const html = (element: unknown): string => renderToStaticMarkup(element as React.ReactElement)

test('with no offers the picker says to ask the operator', () => {
  const out = html(OfferList(react, { offers: [], slot: '', disabled: false, onChoose: () => {} }))
  expect(out).toContain('No server is ready for you yet. Ask your operator.')
  expect(NO_OFFERS_TEXT).toBe('No server is ready for you yet. Ask your operator.')
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

test('CreateConfiguration renders the harness row and starts not ready', () => {
  const readiness: boolean[] = []
  const owner = { view: () => new Promise(() => {}) } as unknown as Owner
  const Component = createConfiguration({ react, owner })
  const out = html(
    React.createElement(Component as never, {
      config: { slot: '' },
      onChange: () => {},
      disabled: false,
      harnessControl: React.createElement('div', null, 'Harness row'),
      onReadyChange: (ready: boolean) => readiness.push(ready),
    }),
  )
  expect(out).toContain('Harness row')
  expect(out).toContain('Looking for your servers')
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
  ['Waiting for installation', true],
  ['Installed', true],
  ['Retirement requested — waiting for the operator', false],
  ['Stopped by the operator — you can delete it now', false],
  ['Unknown — set up outside this device', true],
])('status view shows %s, retire hidden when retiring', (text, canRetire) => {
  const out = html(
    StatusView(react, { status: { text, canRetire }, busy: false, notice: '', onRetire: () => {} }),
  )
  expect(out).toContain(text)
  expect(out.includes('Retire</button>')).toBe(canRetire)
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
