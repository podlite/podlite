import { execFileSync } from 'child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'

const root = join(__dirname, '..', '..', '..')
const checker = join(root, 'scripts', 'check-package-exports.mjs')

const run = (packagesDir?: string): { code: number; out: string } => {
  const args = packagesDir ? [checker, packagesDir] : [checker]
  try {
    return { code: 0, out: execFileSync('node', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }) }
  } catch (error) {
    const failure = error as { status: number; stdout: string }
    return { code: failure.status, out: failure.stdout }
  }
}

describe('every public package ships the targets it exports', () => {
  it('passes for the monorepo', () => {
    const { code, out } = run()
    expect(out).not.toContain('FAIL')
    expect(code).toBe(0)
  })
})

describe('the export target check', () => {
  let fixture: string | undefined

  // one package named x, with the manifest fields the other checks ask for
  const packageWith = (exports: object, files: Record<string, string>, extra: object = {}): string => {
    fixture = mkdtempSync(join(tmpdir(), 'package-exports-'))
    const dir = join(fixture, 'x')
    mkdirSync(dir)
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'x', version: '1.0.0', types: './lib/index.d.ts', sideEffects: false, exports, ...extra }),
    )
    for (const [file, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, file)), { recursive: true })
      writeFileSync(join(dir, file), text)
    }
    return fixture
  }

  const main = { '.': { types: './lib/index.d.ts', default: './lib/index.js' } }
  const built = { 'lib/index.js': '', 'lib/index.d.ts': '' }

  afterEach(() => {
    if (fixture) rmSync(fixture, { recursive: true, force: true })
    fixture = undefined
  })

  it('fails on a target that is not in the package', () => {
    const { code, out } = run(packageWith({ ...main, './example': './demo/Components' }, built, { files: ['lib'] }))
    expect(out).toContain('FAIL')
    expect(out).toContain('./example')
    expect(out).toContain('./demo/Components')
    expect(code).toBe(1)
  })

  it('fails on a target that is in the directory but not in the files list', () => {
    const files = { ...built, 'demo/Components.tsx': '' }
    const { code, out } = run(packageWith({ ...main, './demo': './demo/Components.tsx' }, files, { files: ['lib'] }))
    expect(out).toContain('./demo/Components.tsx')
    expect(code).toBe(1)
  })

  it('fails on a pattern that no shipped file matches', () => {
    const { code, out } = run(packageWith({ ...main, './esm/*': './esm/*.js' }, built, { files: ['lib'] }))
    expect(out).toContain('./esm/*.js')
    expect(code).toBe(1)
  })

  it('fails on a missing target inside a nested condition', () => {
    const exports = { ...main, './nested': { node: { import: './lib/missing.js', default: './lib/index.js' } } }
    const { code, out } = run(packageWith(exports, built, { files: ['lib'] }))
    expect(out).toContain('./nested')
    expect(out).toContain('node.import')
    expect(out).toContain('./lib/missing.js')
    expect(code).toBe(1)
  })

  it('fails on a missing target later in a fallback array', () => {
    const exports = { ...main, './fallback': ['./lib/index.js', './lib/missing.js'] }
    const { code, out } = run(packageWith(exports, built, { files: ['lib'] }))
    expect(out).toContain('./fallback')
    expect(out).toContain('[1]')
    expect(out).toContain('./lib/missing.js')
    expect(code).toBe(1)
  })

  it('reads every * of a target as the same text', () => {
    const files = { ...built, 'out/a/a.js': '', 'out/b/c.js': '' }
    const same = run(packageWith({ ...main, './out/*': './out/*/*.js' }, files, { files: ['lib', 'out'] }))
    expect(same.code).toBe(0)
    rmSync(fixture as string, { recursive: true, force: true })
    const other = run(
      packageWith({ ...main, './out/*': './out/*/*.js' }, { ...built, 'out/b/c.js': '' }, { files: ['lib', 'out'] }),
    )
    expect(other.out).toContain('./out/*/*.js')
    expect(other.code).toBe(1)
  })

  it('reads a * in the target of a key without * as a character', () => {
    const { code, out } = run(packageWith({ ...main, './alias': './lib/*.js' }, built, { files: ['lib'] }))
    expect(out).toContain('./lib/*.js')
    expect(code).toBe(1)
  })

  it('passes a key with * whose target is one shipped file', () => {
    const { code } = run(packageWith({ ...main, './alias/*': './lib/index.js' }, built, { files: ['lib'] }))
    expect(code).toBe(0)
  })

  it('fails on a target that does not start with ./', () => {
    const { code, out } = run(packageWith({ ...main, './bare': 'lib/index.js' }, built, { files: ['lib'] }))
    expect(out).toContain('lib/index.js')
    expect(code).toBe(1)
  })

  it('reads a digit after a repeated * as text', () => {
    const files = { ...built, 'out/a/a1.js': '' }
    const { code } = run(packageWith({ ...main, './out/*': './out/*/*1.js' }, files, { files: ['lib', 'out'] }))
    expect(code).toBe(0)
  })

  it('names the package whose manifest cannot be read', () => {
    fixture = mkdtempSync(join(tmpdir(), 'package-exports-'))
    mkdirSync(join(fixture, 'broken'))
    writeFileSync(join(fixture, 'broken', 'package.json'), '{ not json')
    const { code, out } = run(fixture)
    expect(out).toContain('broken')
    expect(code).toBe(1)
  })

  it('names by its directory a package whose manifest has no name', () => {
    fixture = mkdtempSync(join(tmpdir(), 'package-exports-'))
    mkdirSync(join(fixture, 'nameless'))
    writeFileSync(join(fixture, 'nameless', 'package.json'), JSON.stringify({ version: '1.0.0' }))
    const { code, out } = run(fixture)
    expect(out).toContain('nameless')
    expect(code).toBe(1)
  })

  it('names the package whose manifest holds no object', () => {
    fixture = mkdtempSync(join(tmpdir(), 'package-exports-'))
    mkdirSync(join(fixture, 'empty'))
    writeFileSync(join(fixture, 'empty', 'package.json'), 'null')
    const { code, out } = run(fixture)
    expect(out).toContain('empty')
    expect(code).toBe(1)
  })

  it('lets a * stand for a path with directories', () => {
    const files = { ...built, 'lib/deep/inner/file.js': '' }
    const { code } = run(packageWith({ ...main, './deep/*': './lib/deep/*.js' }, files, { files: ['lib'] }))
    expect(code).toBe(0)
  })

  it('passes a pattern, a null exclusion, nested conditions and a fallback array', () => {
    const exports = {
      ...main,
      './lib/*': { types: './lib/*.d.ts', default: './lib/*.js' },
      './lib/private/*': null,
      './nested': { node: { import: './lib/index.js', default: './lib/index.js' } },
      './fallback': ['./lib/index.js'],
    }
    const { code, out } = run(packageWith(exports, built, { files: ['lib'] }))
    expect(out).not.toContain('FAIL')
    expect(code).toBe(0)
  })

  it('passes ./package.json, which ships without being listed in files', () => {
    const { code } = run(packageWith({ ...main, './package.json': './package.json' }, built, { files: ['lib'] }))
    expect(code).toBe(0)
  })
})
