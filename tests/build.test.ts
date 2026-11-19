import { beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PLUGIN_ID } from '../src/constants'

const root = resolve(import.meta.dir, '..')
const pluginDir = resolve(root, 'dist/plugin')
const ALLOWED_KEYS = ['id', 'name', 'apiVersion', 'description', 'discovery', 'host']

describe('plugin build', () => {
  beforeAll(async () => {
    const proc = Bun.spawn(['bun', 'run', 'build'], {
      cwd: root,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    if (code !== 0) {
      throw new Error(`build failed: ${await new Response(proc.stderr).text()}`)
    }
  })

  test('dist manifest equals root manifest', () => {
    const dist = JSON.parse(readFileSync(resolve(pluginDir, 'manifest.json'), 'utf8'))
    const source = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'))
    expect(dist).toEqual(source)
  })

  test('manifest is valid', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'))
    for (const key of Object.keys(manifest)) {
      expect(ALLOWED_KEYS).toContain(key)
    }
    expect(manifest.apiVersion).toBe(1)
    expect(manifest.id).toBe(PLUGIN_ID)
    expect(Buffer.byteLength(manifest.description, 'utf8')).toBeLessThanOrEqual(280)
    expect(Buffer.byteLength(manifest.description, 'utf8')).toBeGreaterThan(0)
  })

  test('plugin.js has no import statements', () => {
    const source = readFileSync(resolve(pluginDir, 'plugin.js'), 'utf8')
    expect(source).not.toMatch(/^\s*import\s/m)
    expect(source).not.toMatch(/\bimport\s*\(/)
    expect(source).not.toMatch(/^\s*export\s[^;]*\sfrom\s/m)
  })

  test('plugin.js exports inject and apply', async () => {
    const mod = await import(resolve(pluginDir, 'plugin.js'))
    expect(Array.isArray(mod.inject)).toBe(true)
    expect(typeof mod.apply).toBe('function')
  })
})
