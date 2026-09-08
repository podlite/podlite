import { execFileSync } from 'child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const root = join(__dirname, '..', '..', '..')
const checker = join(root, 'scripts', 'check-declared-imports.js')

const run = (pkgDir: string): { code: number; out: string } => {
  try {
    return { code: 0, out: execFileSync('node', [checker, pkgDir], { cwd: root, encoding: 'utf8' }) }
  } catch (error) {
    const failure = error as { status: number; stdout: string }
    return { code: failure.status, out: failure.stdout }
  }
}

// Packages whose manifests are known to match their code. The rest of the monorepo
// is not clean yet, so the gate names what it guards instead of checking everything
const GUARDED = ['podlite-editor-react', 'podlite-publisher']

describe('a guarded package declares what it imports', () => {
  for (const pkg of GUARDED) {
    it(pkg, () => {
      const { code, out } = run(join(root, 'packages', pkg))
      expect(out).toContain('every import is declared')
      expect(code).toBe(0)
    })
  }
})

// Without this the gate above could go green because the checker stopped
// checking, which looks exactly the same from outside
describe('the checker still catches what it is there for', () => {
  let fixture: string | undefined

  const fixtureWith = (files: Record<string, string>, manifest: object): string => {
    // remembered before anything can throw, or a failed write leaves the directory behind
    fixture = mkdtempSync(join(tmpdir(), 'declared-imports-'))
    const dir = fixture
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'fixture', ...manifest }))
    for (const [name, body] of Object.entries(files)) {
      mkdirSync(join(dir, name, '..'), { recursive: true })
      writeFileSync(join(dir, name), body)
    }
    return dir
  }

  afterEach(() => fixture && rmSync(fixture, { recursive: true, force: true }))

  it('reports a package imported in the sources and never declared', () => {
    fixture = fixtureWith({ 'src/index.ts': "import { a } from 'nowhere-declared'\nexport const b = a\n" }, {})
    const { code, out } = run(fixture)
    expect(out).toContain('nowhere-declared')
    expect(out).toContain('src/index.ts')
    expect(code).toBe(1)
  })

  it('reports one the compiler added to the output, absent from the sources', () => {
    fixture = fixtureWith(
      { 'src/index.ts': 'export const b = 1\n', 'lib/index.js': 'const helper = require("added-by-emit")\n' },
      {},
    )
    const { code, out } = run(fixture)
    expect(out).toContain('added-by-emit')
    expect(out).toContain('lib/index.js')
    expect(code).toBe(1)
  })

  it('reads a .ts file as TypeScript, where angle brackets are a cast and not a tag', () => {
    fixture = fixtureWith(
      { 'src/index.ts': 'const x = <number>1\nconst y = require("missing")\nexport { x, y }\n' },
      {},
    )
    const { code, out } = run(fixture)
    expect(out).toContain('missing')
    expect(code).toBe(1)
  })

  it('sees an import written as an assignment', () => {
    fixture = fixtureWith({ 'src/index.ts': 'import x = require("missing")\nexport = x\n' }, {})
    expect(run(fixture).code).toBe(1)
  })

  it('sees a type reference in a published declaration', () => {
    fixture = fixtureWith({ 'lib/index.d.ts': '/// <reference types="missing" />\nexport {}\n' }, {})
    const { code, out } = run(fixture)
    expect(out).toContain('missing')
    expect(code).toBe(1)
  })

  it('will not let a published declaration lean on devDependencies', () => {
    fixture = fixtureWith(
      { 'lib/index.d.ts': 'export type { A } from "types-only"\n' },
      {
        devDependencies: { 'types-only': '*' },
      },
    )
    const { code, out } = run(fixture)
    expect(out).toContain('published type')
    expect(code).toBe(1)
  })

  it('takes a type reference to be satisfied by the types package', () => {
    fixture = fixtureWith(
      { 'lib/index.d.ts': '/// <reference types="jest" />\nexport {}\n' },
      {
        dependencies: { '@types/jest': '*' },
      },
    )
    expect(run(fixture).code).toBe(0)
  })

  it('lets a type-only import assignment come from devDependencies', () => {
    fixture = fixtureWith(
      { 'src/index.ts': 'import type X = require("types-only")\nexport type Y = X\n' },
      {
        devDependencies: { 'types-only': '*' },
      },
    )
    expect(run(fixture).code).toBe(0)
  })

  it('does not let a type reference cover a plain import of the same name', () => {
    fixture = fixtureWith(
      { 'lib/index.d.ts': '/// <reference types="jest" />\nexport type { X } from "jest"\n' },
      {
        dependencies: { '@types/jest': '*' },
      },
    )
    expect(run(fixture).code).toBe(1)
  })

  it('sees a load written as module.require', () => {
    fixture = fixtureWith({ 'src/index.js': 'module.exports = module.require("missing")\n' }, {})
    const { code, out } = run(fixture)
    expect(out).toContain('missing')
    expect(code).toBe(1)
  })

  it('leaves an unrelated require method alone', () => {
    fixture = fixtureWith(
      { 'src/index.js': 'const loader = { require: n => n }\nmodule.exports = loader.require("not-a-module")\n' },
      {},
    )
    expect(run(fixture).code).toBe(0)
  })

  it('sees a package named only by require.resolve', () => {
    fixture = fixtureWith({ 'src/index.js': 'module.exports = require.resolve("missing")\n' }, {})
    expect(run(fixture).code).toBe(1)
  })

  it('sees a module augmentation in a published declaration', () => {
    fixture = fixtureWith(
      { 'lib/index.d.ts': 'export {}\ndeclare module "missing" {\n  interface Options { extra: boolean }\n}\n' },
      {},
    )
    expect(run(fixture).code).toBe(1)
  })

  it('leaves a file alone that declares a module rather than augmenting one', () => {
    fixture = fixtureWith({ 'lib/index.d.ts': 'declare module "some-untyped-thing"\n' }, {})
    expect(run(fixture).code).toBe(0)
  })

  it('says so when a loader is bound to a name it cannot follow', () => {
    fixture = fixtureWith(
      {
        'src/index.js':
          'import { createRequire } from "node:module"\nconst load = createRequire(import.meta.url)\nexport default load("missing")\n',
      },
      {},
    )
    const { out } = run(fixture)
    expect(out).toContain('createRequire')
    expect(out).toContain('every import it could read is declared')
  })

  it('lets a type-only import come from devDependencies', () => {
    fixture = fixtureWith(
      { 'src/index.ts': "import type { A } from 'types-only'\nexport type B = A\n" },
      {
        devDependencies: { 'types-only': '*' },
      },
    )
    expect(run(fixture).code).toBe(0)
  })

  it('does not let a value import come from devDependencies', () => {
    fixture = fixtureWith(
      { 'src/index.ts': "import { a } from 'types-only'\nexport const b = a\n" },
      {
        devDependencies: { 'types-only': '*' },
      },
    )
    const { code, out } = run(fixture)
    expect(out).toContain('types-only')
    expect(code).toBe(1)
  })
})
