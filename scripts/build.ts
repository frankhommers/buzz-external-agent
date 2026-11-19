import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const outDir = resolve(root, 'dist/plugin')

const result = await Bun.build({
  entrypoints: [resolve(root, 'src/plugin.ts')],
  format: 'esm',
  target: 'browser',
  minify: false,
  splitting: false,
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

const output = result.outputs[0]
if (result.outputs.length !== 1 || !output) {
  console.error(`expected exactly one output, got ${result.outputs.length}`)
  process.exit(1)
}

const code = await output.text()
if (/^\s*import\s/m.test(code) || /\bimport\s*\(/.test(code)) {
  console.error('plugin.js must be self-contained: import statement found')
  process.exit(1)
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'plugin.js'), code)
copyFileSync(resolve(root, 'manifest.json'), resolve(outDir, 'manifest.json'))
console.log(`built ${outDir}`)
