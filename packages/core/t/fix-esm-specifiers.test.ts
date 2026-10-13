import { execFileSync } from 'child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'

const script = join(__dirname, '..', '..', '..', 'scripts', 'fix-esm-specifiers.js')

const run = (dir: string): { code: number; out: string } => {
  try {
    return { code: 0, out: execFileSync('node', [script, dir], { encoding: 'utf8', stdio: 'pipe' }) }
  } catch (error) {
    const failure = error as { status: number; stdout: string }
    return { code: failure.status, out: failure.stdout }
  }
}

let fixture: string | undefined

// a package with an esm configuration over two sources; esm holds what the test writes
const packageWith = (esm: Record<string, string>, config: object = { declaration: true }): string => {
  fixture = mkdtempSync(join(tmpdir(), 'fix-esm-'))
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name: '@x/pkg', version: '1.0.0' }),
    'tsconfig.json': JSON.stringify({
      compilerOptions: { rootDir: './src', outDir: 'lib', ...config },
      include: ['src'],
    }),
    'tsconfig.esm.json': JSON.stringify({
      extends: './tsconfig.json',
      compilerOptions: { outDir: 'esm', module: 'ESNext' },
    }),
    'src/index.ts': "export * from './a'\n",
    'src/a.ts': 'export const a = 1\n',
    ...Object.fromEntries(Object.entries(esm).map(([file, text]) => [`esm/${file}`, text])),
  }
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(fixture, file)), { recursive: true })
    writeFileSync(join(fixture, file), text)
  }
  return fixture
}

afterEach(() => {
  if (fixture) rmSync(fixture, { recursive: true, force: true })
  fixture = undefined
})

const complete = {
  'index.js': "export * from './a'\n",
  'index.d.ts': "export * from './a'\n",
  'a.js': 'export const a = 1\n',
  'a.d.ts': 'export declare const a = 1\n',
}

describe('the esm output of a package', () => {
  it('is refused by name, with the command that rebuilds it, when a file is missing', () => {
    const { ['a.js']: _, ...rest } = complete
    const dir = packageWith(rest)
    const { code, out } = run(dir)
    expect(code).toBe(1)
    expect(out).toContain('@x/pkg: esm is incomplete, 1 files missing')
    expect(out).toContain('esm/a.js')
    expect(out).toContain("rm -f '")
    expect(out).toContain('tsconfig.esm.tsbuildinfo')
    expect(out).toContain('yarn workspace @x/pkg build')
  })

  it('is refused when a declaration is missing', () => {
    const { ['a.d.ts']: _, ...rest } = complete
    const { code, out } = run(packageWith(rest))
    expect(code).toBe(1)
    expect(out).toContain('esm/a.d.ts')
  })

  it('is refused when the esm directory is not there at all', () => {
    const { code, out } = run(packageWith({}))
    expect(code).toBe(1)
    expect(out).toContain('esm is incomplete, 4 files missing')
  })

  it('is left as it is when it is refused', () => {
    const { ['a.d.ts']: _, ...rest } = complete
    const dir = packageWith(rest)
    run(dir)
    expect(readFileSync(join(dir, 'esm/index.js'), 'utf8')).toBe("export * from './a'\n")
  })

  it('has its specifiers given extensions when it is complete', () => {
    const dir = packageWith(complete)
    const { code } = run(dir)
    expect(code).toBe(0)
    expect(readFileSync(join(dir, 'esm/index.js'), 'utf8')).toBe("export * from './a.js'\n")
  })

  it('is not checked in a package that has no esm configuration', () => {
    const dir = packageWith({})
    rmSync(join(dir, 'tsconfig.esm.json'))
    expect(run(dir).code).toBe(0)
  })

  it('still reports a specifier that points at nothing', () => {
    const { code, out } = run(packageWith({ ...complete, 'index.js': "export * from './gone'\n" }))
    expect(code).toBe(1)
    expect(out).toContain('point at nothing')
  })
})
