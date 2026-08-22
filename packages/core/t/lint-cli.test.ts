import * as path from 'path'
import { execFileSync } from 'child_process'

const pkgRoot = path.join(__dirname, '..')
const bin = path.join(pkgRoot, 'bin', 'podlite.js')
const sample = (name: string) => path.join('t', 'lint-fixtures', name)

// paths are passed relative to the package root so the report reads the same
// on every machine
const lint = (args: string[]) => {
  try {
    const out = execFileSync('node', [bin, 'lint', ...args], { encoding: 'utf-8', cwd: pkgRoot })
    return { out, code: 0 }
  } catch (e) {
    const err = e as { stdout: string; stderr: string; status: number }
    return { out: (err.stdout || '') + (err.stderr || ''), code: err.status }
  }
}

describe('the lint command end to end', () => {
  it('passes a clean markdown file', () => {
    const result = lint([sample('simple.md')])
    expect(result.code).toBe(0)
    expect(result.out).toMatchSnapshot()
  })

  it('reports a heading jump in markdown', () => {
    const result = lint([sample('enhanced.md')])
    expect(result.code).toBe(0)
    expect(result.out).toMatchSnapshot()
  })

  it('passes a document using the whole markup', () => {
    const result = lint([sample('full.podlite')])
    expect(result.code).toBe(0)
    expect(result.out).toMatchSnapshot()
  })

  it('reports every fault of a broken document', () => {
    const result = lint([sample('broken.podlite')])
    expect(result.code).toBe(1)
    expect(result.out).toMatchSnapshot()
  })

  it('checks several files in one run', () => {
    const result = lint([sample('simple.md'), sample('full.podlite'), sample('broken.podlite')])
    expect(result.code).toBe(1)
    expect(result.out).toMatchSnapshot()
  })

  it('writes the same findings as json', () => {
    const result = lint(['--format', 'json', sample('broken.podlite')])
    expect(result.code).toBe(1)
    expect(JSON.parse(result.out)).toMatchSnapshot()
  })

  it('turns a warning into an error under --strict', () => {
    expect(lint([sample('enhanced.md')]).code).toBe(0)
    expect(lint(['--strict', sample('enhanced.md')]).code).toBe(1)
  })

  it('names a file it cannot read', () => {
    const result = lint([sample('absent.podlite')])
    expect(result.code).toBe(1)
    expect(result.out).toContain('Cannot read file')
  })

  // stdin is a pipe under a test runner, so the command reads it rather than
  // reporting a missing argument; an empty pipe is an empty document
  it('takes an empty pipe for an empty document', () => {
    const result = lint([])
    expect(result.code).toBe(0)
    expect(result.out).toContain('0 errors')
  })

  it('stops on an unknown output format', () => {
    const result = lint(['--format', 'xml', sample('simple.md')])
    expect(result.code).toBe(2)
    expect(result.out).toContain('unknown --format')
  })

  it('takes the document from stdin', () => {
    const out = execFileSync('node', [bin, 'lint', '-'], {
      encoding: 'utf-8',
      cwd: pkgRoot,
      input: '=head1 Title\n\n=head3 jumped\n',
    })
    expect(out).toContain('<stdin>')
    expect(out).toContain('heading-hierarchy')
  })
})
