import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { tocOf } from './toc-slice'

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

describe('podlite query on an include that is not there', () => {
  it('says so under --quiet and exits with 1', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-cli-'))
    const src = path.join(dir, 'doc.podlite')
    fs.writeFileSync(src, '=pod\n\n=head1 Kept\n\n=include file:./absent.podlite\n')
    let status = 0
    let stderr = ''
    let stdout = ''
    try {
      stdout = execFileSync('node', [bin, 'query', 'head1', src, '--quiet'], { stdio: 'pipe' }).toString()
    } catch (e) {
      const failure = e as { status: number; stderr: Buffer; stdout: Buffer }
      status = failure.status
      stderr = failure.stderr.toString()
      stdout = failure.stdout.toString()
    }
    fs.rmSync(dir, { recursive: true, force: true })
    expect(status).toBe(1)
    expect(stderr).toContain('include target not found: ./absent.podlite')
    expect(stdout).toContain('=head1 Kept')
  })
})

describe('podlite convert reading stdin', () => {
  it('reads a file named like the stdin marker as a file of its own', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-cli-'))
    fs.writeFileSync(path.join(dir, '-'), '=for para :id<x>\nReal file.\n')
    const out = execFileSync('node', [bin, 'convert', '-', '--to', 'md', '-o', '-'], {
      cwd: dir,
      input: '=include file:./-#x\n',
    }).toString()
    fs.rmSync(dir, { recursive: true, force: true })
    expect(out).toContain('Real file.')
  })
})

describe('podlite query on a file named like the stdin marker', () => {
  it('reads it as a file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-cli-'))
    fs.writeFileSync(path.join(dir, '<stdin>'), '=include file:B.podlite#x\n')
    fs.writeFileSync(path.join(dir, 'B.podlite'), '=include file:./<stdin>#x\n\n=for para :id<x>\nYes.\n')
    let status = 0
    try {
      execFileSync('node', [bin, 'query', 'para', '<stdin>', '--quiet'], { cwd: dir, stdio: 'pipe' })
    } catch (e) {
      status = (e as { status: number }).status
    }
    fs.rmSync(dir, { recursive: true, force: true })
    expect(status).toBe(0)
  })
})

describe('podlite convert with a table of contents', () => {
  it('lists blocks an include brought in', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-cli-'))
    fs.mkdirSync(path.join(dir, 't'))
    fs.writeFileSync(
      path.join(dir, 't', 'frame.podlite'),
      '=begin test :id<frame-ok> :caption<A frame>\n=begin fixture\n=para x\n=end fixture\n=assert para\n=end test\n',
    )
    const src = path.join(dir, 'doc.podlite')
    fs.writeFileSync(src, "=pod\n\n=include file:./t/frame.podlite#frame-ok\n\n=for toc :caption('Tests')\ntest\n")
    const html = execFileSync('node', [bin, 'convert', src, '--to', 'html', '-o', '-']).toString()
    fs.rmSync(dir, { recursive: true, force: true })
    expect(html).toContain('href="#frame-ok"')
  })
})

describe('podlite convert with a hidden table of contents', () => {
  const convert = (files: Record<string, string>) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-cli-'))
    for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body)
    const html = execFileSync('node', [bin, 'convert', path.join(dir, 'doc.podlite'), '--to', 'html', '-o', '-'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString()
    fs.rmSync(dir, { recursive: true, force: true })
    // the text of the entries; a link target names the heading, which stays open
    return tocOf(html).replace(/ href="[^"]*"/g, '')
  }

  it('keeps its entries hidden, on its own and inside a hidden container', () => {
    expect(convert({ 'doc.podlite': '=pod\n\n=for toc :masked\nhead1\n\n=head1 Public Qor\n' })).not.toContain('Qor')
    const doc = '=pod\n\n=begin nested :masked\n\n=toc head1\n\n=end nested\n\n=head1 Out Tal\n'
    expect(convert({ 'doc.podlite': doc })).not.toContain('Tal')
  })

  it('hides in an entry what an included heading hides', () => {
    const toc = convert({
      'part.podlite': '=head1 G<Ivel> part\n',
      'doc.podlite': '=pod\n\n=toc head1\n\n=include file:./part.podlite\n',
    })
    expect(toc).toContain('part')
    expect(toc).not.toContain('Ivel')
  })
})

describe('podlite convert with a caption on a table of contents', () => {
  const convert = (files: Record<string, string>) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-cli-'))
    for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body)
    const html = execFileSync('node', [bin, 'convert', path.join(dir, 'doc.podlite'), '--to', 'html', '-o', '-'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString()
    fs.rmSync(dir, { recursive: true, force: true })
    return tocOf(html)
  }

  it('writes the caption inside the table', () => {
    expect(convert({ 'doc.podlite': '=pod\n\n=for toc :caption<Alias>\nhead1\n\n=head1 One\n' })).toContain(
      '<div class="toctitle">Alias</div>',
    )
  })

  it('writes the caption of a table rebuilt after the includes, with their entries', () => {
    const toc = convert({
      'doc.podlite': "=pod\n\n=for toc :caption('Included G<Qor>')\nhead1\n\n=include file:part.podlite\n",
      'part.podlite': '=head1 From part\n',
    })
    expect(toc).toContain('<div class="toctitle">Included <span class="masked">███</span></div>')
    expect(toc).toContain('From part')
  })

  it('hides the caption of a hidden table', () => {
    expect(convert({ 'doc.podlite': '=pod\n\n=for toc :masked :caption<TocSecret>\nhead1\n\n=head1 One\n' })).toContain(
      '<div class="toctitle">█████████</div>',
    )
  })
})
