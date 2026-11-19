import { expect, test } from 'bun:test'
import type { Owner } from '../../src/buzz/owner'
import type { Relay } from '../../src/buzz/relay'
import { ownerCard, type ReactLike } from '../../src/ui/OwnerCard'

type Node = { type: unknown; props: Record<string, unknown> | null; children: unknown[] }

/** Renders once: state keeps its initial value and effects are collected, not run. */
const fakeReact = () => {
  const effects: (() => undefined | (() => void))[] = []
  const react: ReactLike = {
    createElement: (type, props, ...children) => ({ type, props: props ?? null, children }),
    useState: <T>(initial: T): [T, () => void] => [initial, () => {}],
    useEffect: (effect) => void effects.push(effect),
  }
  return { react, effects }
}

const textOf = (node: unknown): string => {
  if (typeof node === 'string') return node
  if (node === null || typeof node !== 'object') return ''
  return (node as Node).children.map(textOf).join(' ')
}

test('renders a host card with the owner sections and no side effects during render', () => {
  const { react, effects } = fakeReact()
  let calls = 0
  const owner = new Proxy({} as Owner, {
    get: () => () => {
      calls++
      return Promise.resolve()
    },
  })
  const component = ownerCard({
    react,
    owner,
    relay: {} as Relay,
    agents: { subscribe: () => () => {} },
  })
  const tree = component({ active: () => true }) as Node
  expect(tree.type).toBe('section')
  expect(tree.props).toMatchObject({ className: 'ui-card' })
  const text = textOf(tree)
  for (const heading of [
    'Operator',
    'Servers offered to you',
    'Your self-hosted agents',
    'Bring into Buzz',
  ])
    expect(text).toContain(heading)
  expect(effects).toHaveLength(2)
  expect(calls).toBe(0)
})

test('a retire-requested agent offers Cancel retire request, which calls the owner', async () => {
  const view = {
    operator: '',
    offers: [],
    agents: [
      {
        pubkey: 'd'.repeat(64),
        name: 'Robo',
        status: 'Waiting for the operator',
        canRetire: false,
        canCancelRetire: true,
      },
    ],
  }
  let first = true
  const react: ReactLike = {
    createElement: (type, props, ...children) => ({ type, props: props ?? null, children }),
    // The first state is the owner view; every other state keeps its initial value.
    useState: <T>(initial: T): [T, () => void] => {
      const value = first ? (view as T) : initial
      first = false
      return [value, () => {}]
    },
    useEffect: () => {},
  }
  const cancelled: string[] = []
  const owner = {
    cancelRetire: async (pubkey: string) => void cancelled.push(pubkey),
  } as unknown as Owner
  const component = ownerCard({
    react,
    owner,
    relay: {} as Relay,
    agents: { subscribe: () => () => {} },
  })
  const tree = component({ active: () => true })
  const buttons: Node[] = []
  const collect = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return
    const n = node as Node
    if (n.type === 'button') buttons.push(n)
    for (const child of n.children) collect(child)
  }
  collect(tree)
  expect(buttons.some((b) => b.children.includes('Retire'))).toBe(false)
  const cancel = buttons.find((b) => b.children.includes('Cancel retire request'))
  const onClick = cancel?.props?.onClick
  if (typeof onClick !== 'function') throw new Error('no Cancel retire request button')
  onClick()
  await Promise.resolve()
  expect(cancelled).toEqual(['d'.repeat(64)])
})
