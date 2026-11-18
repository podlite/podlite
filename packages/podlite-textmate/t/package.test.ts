import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { podliteGrammar } from '../src'

const pkg = join(__dirname, '..')
const root = join(pkg, '..', '..')
const built = join(pkg, 'lib', 'podlite.tmLanguage.json')

it('the built JSON is the grammar of the source', () => {
  if (!existsSync(built)) throw new Error(`${built} is missing: build the package before this test`)
  expect(readFileSync(built, 'utf8')).toBe(JSON.stringify(podliteGrammar, null, 2) + '\n')
})

it('a new scoped package is published public', () => {
  const manifest = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'))
  expect(manifest.publishConfig).toEqual({ access: 'public' })
})

// What a third party gets: the packed archive installed next to shiki, with no other
// @podlite package around
describe('the packed package, used with shiki alone', () => {
  let consumer: string
  let out: string

  beforeAll(() => {
    consumer = mkdtempSync(join(tmpdir(), 'podlite-textmate-consumer-'))
    const packs = join(consumer, 'packs')
    mkdirSync(packs)
    execFileSync('npm', ['pack', '--pack-destination', packs, '--ignore-scripts', '--silent'], { cwd: pkg })
    const archive = join(packs, readdirSync(packs)[0])
    const target = join(consumer, 'node_modules', '@podlite', 'textmate')
    mkdirSync(target, { recursive: true })
    execFileSync('tar', ['-xzf', archive, '-C', target, '--strip-components=1'])
    symlinkSync(join(root, 'node_modules', 'shiki'), join(consumer, 'node_modules', 'shiki'))
    const sample = readFileSync(join(__dirname, 'fixtures', 'quickstart-81-93.podlite'), 'utf8')
    writeFileSync(
      join(consumer, 'run.mjs'),
      `
import { createHighlighter } from 'shiki'
import { podliteGrammar } from '@podlite/textmate'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const json = JSON.parse(readFileSync(require.resolve('@podlite/textmate/podlite.tmLanguage.json'), 'utf8'))
const fromRequire = require('@podlite/textmate').podliteGrammar
const sample = ${JSON.stringify(sample)}
const result = {}
for (const [entry, grammar] of [['import', podliteGrammar], ['json', json], ['require', fromRequire]]) {
  const h = await createHighlighter({ langs: [grammar], themes: ['github-dark'] })
  for (const lang of ['podlite', 'pod6', 'rakudoc']) {
    const { tokens } = h.codeToTokens(sample, { lang, theme: 'github-dark' })
    const colour = text => tokens.flat().find(t => t.content === text)?.color
    result[entry + ' ' + lang] = [colour('=begin'), colour('nested'), colour('notice')]
  }
}
console.log(JSON.stringify(result))
`,
    )
    writeFileSync(
      join(consumer, 'types.ts'),
      `import type { LanguageRegistration } from 'shiki'
import { podliteGrammar } from '@podlite/textmate'
const registration: LanguageRegistration = podliteGrammar
export default registration
`,
    )
    out = execFileSync('node', ['--no-warnings', 'run.mjs'], { cwd: consumer, encoding: 'utf8' })
  }, 120_000)

  afterAll(() => rmSync(consumer, { recursive: true, force: true }))

  it('colours the three named pieces through every entry and under every language name', () => {
    const result = JSON.parse(out)
    const entries = Object.keys(result)
    expect(entries).toHaveLength(9)
    for (const entry of entries) {
      const [directive, name, attribute] = result[entry]
      expect([entry, new Set([directive, name, attribute]).size]).toEqual([entry, 3])
    }
  })

  it('types as a shiki language registration without a cast', () => {
    const tsc = join(root, 'node_modules', '.bin', 'tsc')
    expect(() =>
      execFileSync(
        tsc,
        [
          '--noEmit',
          '--strict',
          '--module',
          'nodenext',
          '--moduleResolution',
          'nodenext',
          '--skipLibCheck',
          'types.ts',
        ],
        { cwd: consumer, encoding: 'utf8' },
      ),
    ).not.toThrow()
  })
})
