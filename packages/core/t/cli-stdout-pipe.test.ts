import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const bin = path.join(__dirname, '..', 'bin', 'podlite.js')
const run = (args: string[]) => execFileSync('node', [bin, ...args], { maxBuffer: 64 * 1024 * 1024 })

describe('podlite query writing to a pipe', () => {
  let dir: string
  let src: string

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-cli-'))
    src = path.join(dir, 'big.podlite')
    const paragraphs = Array.from({ length: 400 }, (_, i) => `=para\nblock ${i} ${'text '.repeat(60)}`).join('\n\n')
    fs.writeFileSync(src, `=begin pod\n${paragraphs}\n=end pod\n`)
  })

  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('carries an output above the pipe buffer whole', () => {
    const piped = run(['query', 'para', src, '--to', 'json', '--quiet'])
    expect(piped.length).toBeGreaterThan(65536)
    expect(() => JSON.parse(piped.toString())).not.toThrow()
  })

  it('gives the pipe the same bytes as the file', () => {
    const out = path.join(dir, 'out.json')
    run(['query', 'para', src, '--to', 'json', '--quiet', '-o', out])
    const file = fs.readFileSync(out)
    const piped = run(['query', 'para', src, '--to', 'json', '--quiet'])
    expect(piped.subarray(0, file.length)).toEqual(file)
    expect(piped.length - file.length).toBeLessThanOrEqual(1)
  })
})

describe('podlite convert writing to stdout', () => {
  let dir: string
  let src: string
  const doc = '=begin pod\n=head1 Title\n=end pod\n'

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-convert-'))
    src = path.join(dir, 'doc.podlite')
    fs.writeFileSync(src, doc)
  })

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('prints a file given a dash as the output', () => {
    const out = execFileSync('node', [bin, 'convert', src, '--to', 'md', '-o', '-'], { encoding: 'utf-8' })
    expect(out).toContain('# Title')
    expect(fs.readdirSync(dir)).toEqual(['doc.podlite'])
  })

  it('prints text taken from stdin', () => {
    const out = execFileSync('node', [bin, 'convert', '-', '--to', 'md'], { input: doc, encoding: 'utf-8' })
    expect(out).toContain('# Title')
  })

  it('still writes a file next to the source without an output', () => {
    run(['convert', src, '--to', 'md'])
    expect(fs.readdirSync(dir).sort()).toEqual(['doc.md', 'doc.podlite'])
  })
})

describe('podlite lint reading from stdin', () => {
  const lint = (args: string[], input: string) =>
    execFileSync('node', [bin, 'lint', ...args], { input, encoding: 'utf-8' })

  it('checks the text given after a dash', () => {
    expect(lint(['-'], '=begin pod\n=head1 Title\n=end pod\n')).toContain('1 file checked, 0 errors')
  })

  it('checks piped text with no marker at all', () => {
    let out = ''
    try {
      lint([], '=end table\n')
    } catch (e) {
      out = (e as { stdout: string }).stdout
    }
    expect(out).toMatch(/<stdin>:1:1: error: =end table without matching =begin/)
  })
})
