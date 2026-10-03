import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const bin = path.join(__dirname, '..', 'bin', 'podlite.js')

let dir: string

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-cli-format-')))
  fs.writeFileSync(path.join(dir, 'a.md'), '# Title\n\nSome *text*.\n')
})

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const run = (args: string[], input?: string) => {
  const result = spawnSync('node', [bin, ...args], { cwd: dir, input, encoding: 'utf-8' })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

describe('a document read in the format its name gives', () => {
  it('convert reads a Markdown document as Markdown', () => {
    const r = run(['convert', 'a.md', '--to', 'html', '-o', '-'])
    expect(r.stdout).toContain('<h1')
    expect(r.stdout).not.toContain('# Title')
  })

  it('query finds the heading of a Markdown document', () => {
    expect(run(['query', 'head1', 'a.md', '--to', 'json', '--quiet']).stdout).toContain('Title')
  })

  it('the test runner reads a document given with --against in its format', () => {
    fs.writeFileSync(
      path.join(dir, 'tests.podlite'),
      "=begin test :id<md-heading> :caption('a heading of a Markdown document')\n=for assert\nhead1\n=end test\n",
    )
    const r = run(['test', 'tests.podlite', '--against', 'a.md'])
    expect([r.status, r.stdout]).toEqual([0, expect.stringContaining('1 passed')])
  })

  it('text from the standard input is read as Podlite', () => {
    const input = '=pod\n\nA paragraph.\n'
    expect(run(['convert', '-', '--to', 'md'], input).stdout).toContain('A paragraph.')
    expect(run(['query', 'para', '-', '--quiet'], input).stdout).toContain('A paragraph.')
    const lint = run(['lint', '-', '--format', 'json'], '=pod\n\n# Not Podlite\n')
    expect(lint.stdout).toContain('markdown-in-pod')
  })
})
