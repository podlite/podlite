import { execFileSync } from 'child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const root = join(__dirname, '..', '..', '..')

// A real node, not this runner: jest substitutes its own module loader, so a
// module that only works under jest would still pass here
const inFreshNode = (source: string): { ok: boolean; out: string } => {
  try {
    const out = execFileSync('node', ['--input-type=module', '--no-warnings', '-e', source], {
      cwd: root,
      encoding: 'utf8',
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { ok: true, out }
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string }
    return { ok: false, out: (failure.stdout || '') + (failure.stderr || '') }
  }
}

// The two entries that used to die on a bare require in their ESM build. Each
// runs in its own process because an entry can have side effects on load
const ENTRIES = ['podlite/lint', '@podlite/publisher/node']

describe('an entry can be imported as a module', () => {
  for (const entry of ENTRIES) {
    it(entry, () => {
      // Printed only after the import resolves, so a module that exits early
      // cannot pass by leaving a zero status behind
      const { ok, out } = inFreshNode(`await import('${entry}'); console.log('loaded')`)
      expect(out).toContain('loaded')
      expect(ok).toBe(true)
    })
  }
})

describe('what the module build has to keep doing', () => {
  let dir: string
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }))

  it('still finds a grammar violation, which a broken import would silence', () => {
    // The scan swallows every exception from the parser on purpose, so an import
    // of the wrong shape would leave the suite green and the rule mute
    dir = mkdtempSync(join(tmpdir(), 'esm-entries-'))
    const file = join(dir, 'doc.podlite')
    writeFileSync(file, '=for para :content-snippet<text B<bold> tail>\nbody\n')
    const { out } = inFreshNode(
      `const { lintFile } = await import('podlite/lint')
       const report = lintFile(${JSON.stringify(file)}, { rules: {} })
       console.log(report.violations.map(v => v.rule).join(','))`,
    )
    expect(out).toContain('attr-nested-angle')
  })

  it('still reads a config written as code', () => {
    dir = mkdtempSync(join(tmpdir(), 'esm-entries-'))
    const config = join(dir, 'podlite.config.js')
    writeFileSync(config, "module.exports = { rules: { 'id-unique': 'off' } }\n")
    const { out } = inFreshNode(
      `const { readConfig } = await import('podlite/lint')
       console.log(JSON.stringify(readConfig(${JSON.stringify(config)})))`,
    )
    expect(out).toContain('"id-unique":"off"')
  })

  it('still resolves a path beside another document', () => {
    const { out } = inFreshNode(
      `const { getPathToOpen } = await import('@podlite/publisher/node')
       console.log(getPathToOpen('sibling.podlite', '/tmp/here/main.podlite').path)`,
    )
    expect(out).toContain('/tmp/here/sibling.podlite')
  })
})
