import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { runQuery } from '../src/query'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-query-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

const write = (relPath: string, content: string): string => {
  const full = path.join(tmpDir, relPath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
  return full
}

describe('runQuery bare selector', () => {
  it('extracts blocks by name from a single file', () => {
    const f = write(
      'doc.podlite',
      `=begin pod
=head1 First
=head1 Second
=para text
=end pod
`,
    )
    const r = runQuery({ selector: 'head1', files: [f], format: 'podlite', failOnEmpty: false, quiet: true })
    expect(r.matchCount).toBe(2)
    expect(r.exitCode).toBe(0)
    expect(r.output).toContain('=head1 First')
    expect(r.output).toContain('=head1 Second')
  })

  it('predicate selector with contains operator', () => {
    const f = write(
      'rules.podlite',
      `=begin pod
=begin defn :id<r1> :applies-nfr<N001 N004 N007>
First
=end defn
=begin defn :id<r2> :applies-nfr<N002>
Second
=end defn
=end pod
`,
    )
    const r = runQuery({
      selector: '*[:applies-nfr~<N004>]',
      files: [f],
      format: 'podlite',
      failOnEmpty: false,
      quiet: true,
    })
    expect(r.matchCount).toBe(1)
    expect(r.output).toContain(':id<r1>')
    expect(r.output).not.toContain(':id<r2>')
  })

  it('aggregates matches across multiple files', () => {
    const a = write('a.podlite', `=begin pod\n=defn :id<a>\nA\n=end defn\n=end pod\n`)
    const b = write('b.podlite', `=begin pod\n=defn :id<b>\nB\n=end defn\n=end pod\n`)
    const r = runQuery({ selector: 'defn', files: [a, b], format: 'podlite', failOnEmpty: false, quiet: true })
    expect(r.matchCount).toBe(2)
  })
})

describe('runQuery output formats', () => {
  it('json output returns parseable array of blocks', () => {
    const f = write('x.podlite', `=begin pod\n=head1 A\n=head1 B\n=end pod\n`)
    const r = runQuery({ selector: 'head1', files: [f], format: 'json', failOnEmpty: false, quiet: true })
    const parsed = JSON.parse(r.output)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].name).toBe('head')
  })

  it('md output renders matched blocks as Markdown', () => {
    const f = write('x.podlite', `=begin pod\n=head1 First\n=head2 Sub\n=end pod\n`)
    const r = runQuery({ selector: 'head1, head2', files: [f], format: 'md', failOnEmpty: false, quiet: true })
    expect(r.output).toContain('# First')
    expect(r.output).toContain('## Sub')
  })

  it('html output renders matched blocks as HTML', () => {
    const f = write('x.podlite', `=begin pod\n=head1 First\n=end pod\n`)
    const r = runQuery({ selector: 'head1', files: [f], format: 'html', failOnEmpty: false, quiet: true })
    expect(r.output).toMatch(/<h1[^>]*>First\s*<\/h1>/)
  })
})

describe('runQuery stdin', () => {
  it('reads from stdinContent when provided (no files)', () => {
    const src = `=begin pod\n=head1 From stdin\n=end pod\n`
    const r = runQuery({
      selector: 'head1',
      files: [],
      format: 'podlite',
      failOnEmpty: false,
      quiet: true,
      stdinContent: src,
    })
    expect(r.matchCount).toBe(1)
    expect(r.output).toContain('From stdin')
  })

  it('aggregates stdin + file matches', () => {
    const f = write('f.podlite', `=begin pod\n=head1 From file\n=end pod\n`)
    const src = `=begin pod\n=head1 From stdin\n=end pod\n`
    const r = runQuery({
      selector: 'head1',
      files: [f],
      format: 'podlite',
      failOnEmpty: false,
      quiet: true,
      stdinContent: src,
    })
    expect(r.matchCount).toBe(2)
  })
})

describe('runQuery exit codes', () => {
  it('empty result with no --fail-on-empty returns exit 0', () => {
    const f = write('x.podlite', `=begin pod\n=para hi\n=end pod\n`)
    const r = runQuery({ selector: 'code', files: [f], format: 'podlite', failOnEmpty: false, quiet: true })
    expect(r.matchCount).toBe(0)
    expect(r.exitCode).toBe(0)
  })

  it('empty result with --fail-on-empty returns exit 1', () => {
    const f = write('x.podlite', `=begin pod\n=para hi\n=end pod\n`)
    const r = runQuery({ selector: 'code', files: [f], format: 'podlite', failOnEmpty: true, quiet: true })
    expect(r.matchCount).toBe(0)
    expect(r.exitCode).toBe(1)
  })

  it('non-empty result with --fail-on-empty returns exit 0', () => {
    const f = write('x.podlite', `=begin pod\n=para hi\n=end pod\n`)
    const r = runQuery({ selector: 'para', files: [f], format: 'podlite', failOnEmpty: true, quiet: true })
    expect(r.matchCount).toBeGreaterThan(0)
    expect(r.exitCode).toBe(0)
  })
})

describe('runQuery errors', () => {
  it('throws on invalid selector', () => {
    const f = write('x.podlite', `=begin pod\n=para hi\n=end pod\n`)
    expect(() =>
      runQuery({ selector: '*[:lang<python>', files: [f], format: 'podlite', failOnEmpty: false, quiet: true }),
    ).toThrow(/Invalid selector/)
  })

  it('throws on no inputs', () => {
    expect(() =>
      runQuery({ selector: 'head1', files: [], format: 'podlite', failOnEmpty: false, quiet: true }),
    ).toThrow(/No input/)
  })
})
