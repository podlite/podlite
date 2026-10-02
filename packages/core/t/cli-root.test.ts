import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const bin = path.join(__dirname, '..', 'bin', 'podlite.js')

let dir: string

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-root-')))
  fs.mkdirSync(path.join(dir, 'book'))
  fs.mkdirSync(path.join(dir, 'shared'))
  fs.writeFileSync(path.join(dir, 'shared/legal.podlite'), '=pod\n\n=head1 Legal\n')
  fs.writeFileSync(
    path.join(dir, 'book/book.podlite'),
    '=pod\n\n=head1 Book\n\n=include file:../shared/legal.podlite\n',
  )
})

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const run = (args: string[], options: { cwd?: string; input?: string } = {}) => {
  const result = spawnSync('node', [bin, ...args], { cwd: options.cwd ?? dir, input: options.input, encoding: 'utf-8' })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

const legal = (command: string, root: string) =>
  `podlite ${command}: book/book.podlite:5: included file comes from outside the root ${root}: ../shared/legal.podlite`

describe('podlite convert and the root', () => {
  it('warns about a file from outside the directory of the document, and keeps it', () => {
    const r = run(['convert', 'book/book.podlite', '--to', 'md', '-o', '-'])
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('Legal')
    expect(r.stderr.trim()).toBe(legal('convert', path.join(dir, 'book')))
  })

  it('does not warn when the root holds the file', () => {
    expect(run(['convert', 'book/book.podlite', '--to', 'md', '-o', '-', '--root', 'book']).stderr).toContain('outside')
    const r = run(['convert', 'book/book.podlite', '--to', 'md', '-o', '-', '--root', '.'])
    expect(r.status).toBe(0)
    expect(r.stderr).toBe('')
  })

  it('resolves a relative root from the working directory, not from the document', () => {
    // from the document, shared would name book/shared, which does not exist
    const r = run(['convert', 'book/book.podlite', '--to', 'md', '-o', '-', '--root', 'shared'])
    expect([r.status, r.stderr]).toEqual([0, ''])
    const inside = run(['convert', 'book.podlite', '--to', 'md', '-o', '-', '--root', '.'], {
      cwd: path.join(dir, 'book'),
    })
    expect(inside.stderr).toContain(`outside the root ${path.join(dir, 'book')}`)
  })

  it('takes the working directory as the root of a document read from stdin', () => {
    const input = '=pod\n\n=include file:shared/legal.podlite\n'
    expect(run(['convert', '-', '--to', 'md'], { input }).stderr).toBe('')
    const r = run(['convert', '-', '--to', 'md'], {
      cwd: path.join(dir, 'book'),
      input: input.replace('shared', '../shared'),
    })
    expect(r.stderr).toContain(`outside the root ${path.join(dir, 'book')}`)
  })

  it('stops before reading any input when the root is not a directory', () => {
    const missing = run(['convert', 'nothing.podlite', '--to', 'md', '--root', 'nowhere'])
    expect(missing.status).toBe(1)
    expect(missing.stderr.trim()).toBe('podlite convert: --root is not a directory: nowhere')
    const file = run(['convert', 'nothing.podlite', '--to', 'md', '--root', 'book/book.podlite'])
    expect(file.status).toBe(1)
    expect(file.stderr.trim()).toBe('podlite convert: --root is not a directory: book/book.podlite')
  })

  it('names the directive of every include warning', () => {
    fs.writeFileSync(path.join(dir, 'book/web.podlite'), '=pod\n\n=include https://example.com/x.podlite\n')
    const r = run(['convert', 'book/web.podlite', '--to', 'md', '-o', '-'])
    expect(r.stderr.trim()).toBe('podlite convert: book/web.podlite:3: include scheme is not supported: https:')
  })
})

describe('podlite query and the root', () => {
  it('warns about a file from outside the directory of each input', () => {
    const r = run(['query', 'head1', 'book/book.podlite'])
    expect(r.stdout).toContain('=head1 Legal')
    expect(r.stderr.split('\n')).toEqual([legal('query', path.join(dir, 'book')), '2 matches', ''])
  })

  it('takes one root for every input', () => {
    expect(run(['query', 'head1', 'book/book.podlite', '--root', 'book']).stderr).toContain('outside')
    expect(run(['query', 'head1', 'book/book.podlite', '--root', '.']).stderr).toBe('2 matches\n')
  })

  it('warns only about outside blocks the selection shows', () => {
    fs.writeFileSync(
      path.join(dir, 'book/book.podlite'),
      '=pod\n\n=head2 Own\n\n=include file:../shared/legal.podlite\n',
    )
    expect(run(['query', 'head2', 'book/book.podlite']).stderr).toBe('1 match\n')
    expect(run(['query', 'head1', 'book/book.podlite']).stderr).toContain('outside')
  })

  it('stops before reading any input when the root is not a directory', () => {
    const r = run(['query', 'head1', 'book/book.podlite', '--root', 'nowhere'])
    expect(r.status).toBe(1)
    expect(r.stdout).toBe('')
    expect(r.stderr.trim()).toBe('podlite query: --root is not a directory: nowhere')
  })

  it('names the directive of an include warning as before', () => {
    fs.writeFileSync(
      path.join(dir, 'book/web.podlite'),
      '=pod\n\n=head1 Web\n\n=include https://example.com/x.podlite\n',
    )
    const r = run(['query', 'head1', 'book/web.podlite'])
    expect(r.stderr).toBe('podlite query: book/web.podlite:5: include scheme is not supported: https:\n1 match\n')
  })
})
