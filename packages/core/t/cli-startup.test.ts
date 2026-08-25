import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { execFileSync } from 'child_process'

const pkgRoot = path.join(__dirname, '..')
const cli = path.join(pkgRoot, 'lib', 'cli.js')

// The command is loaded in a child that reports what ended up in the module
// cache. Asking the cache is the only way to see what a run paid for.
const probe = (args: string[]): string[] => {
  const report = path.join(os.tmpdir(), `podlite-modules-${process.pid}-${args.join('-').replace(/\W+/g, '_')}.json`)
  // the command ends through process.exit on several paths, so the report is
  // written from an exit hook rather than after the require
  const script = [
    `const fs = require('fs')`,
    `process.on('exit', () => { try { fs.writeFileSync(${JSON.stringify(
      report,
    )}, JSON.stringify(Object.keys(require.cache))) } catch (e) {} })`,
    `process.argv = ['node', 'podlite.js', ${args.map(a => JSON.stringify(a)).join(', ')}]`,
    `try { require(${JSON.stringify(cli)}) } catch (e) {}`,
  ].join('\n')

  try {
    execFileSync('node', ['-e', script], { stdio: 'ignore' })
  } catch {
    // a non-zero exit is fine: the report is written before the command ends
  }
  const written = JSON.parse(fs.readFileSync(report, 'utf-8')) as string[]
  fs.rmSync(report, { force: true })
  return written
}

const holds = (modules: string[], name: string) => modules.some(m => m.includes(name))

describe('what a run of the command loads', () => {
  let dir: string
  let file: string

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-startup-'))
    file = path.join(dir, 'doc.podlite')
    fs.writeFileSync(file, '=head1 Title\n\ntext\n')
  })
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('leaves the diagram renderer out of a check', () => {
    const modules = probe(['lint', file])
    expect(holds(modules, 'podlite-diagrams')).toBe(false)
    expect(holds(modules, 'mermaid')).toBe(false)
    expect(holds(modules, 'react')).toBe(false)
  })

  it('leaves it out of a query as well', () => {
    const modules = probe(['query', 'head1', file])
    expect(holds(modules, 'podlite-diagrams')).toBe(false)
    expect(holds(modules, 'mermaid')).toBe(false)
  })

  it('leaves it out of the help text', () => {
    const modules = probe(['--help'])
    expect(holds(modules, 'podlite-diagrams')).toBe(false)
  })

  it('raises it for a conversion, which renders', () => {
    const modules = probe(['convert', file, '--to', 'html', '-o', '-'])
    expect(holds(modules, 'podlite-diagrams')).toBe(true)
  })

  it('loads fewer modules for a check than for a conversion', () => {
    expect(probe(['lint', file]).length).toBeLessThan(probe(['convert', file, '--to', 'html', '-o', '-']).length)
  })
})
