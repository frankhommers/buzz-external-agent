import { describe, expect, test } from 'bun:test'
import { renderTemplate } from '../../src/core/template'

const vars = {
  name: 'Robo',
  slot: 'vps-1',
  host: 'h.example',
  pubkey: 'a'.repeat(64),
  npub: 'npub1xyz',
  auth_tag: '["auth","x","","y"]',
  file: '/tmp/key.age',
}

describe('renderTemplate', () => {
  test('renders all placeholders and leaves literal text', () => {
    const out = renderTemplate(
      'ssh {host} {slot} {name} {pubkey} {npub} {auth_tag} {file} $HOME "q" }',
      vars,
    )
    expect(out).toBe(
      `ssh h.example vps-1 Robo ${vars.pubkey} npub1xyz ${vars.auth_tag} /tmp/key.age $HOME "q" }`,
    )
  })

  test('throws on unknown placeholder', () => {
    expect(() => renderTemplate('run {oops}', vars)).toThrow('Unknown placeholder {oops}')
  })

  test('inserts values verbatim without re-expanding', () => {
    expect(renderTemplate('{name}', { ...vars, name: '{slot}' })).toBe('{slot}')
  })
})
