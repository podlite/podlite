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
  it('finds a paragraph written without a marker and not the text of a heading', () => {
    const f = write('doc.podlite', '=pod\n\n=head1 Title\n\nFirst paragraph.\n\n=para Second\n')
    const r = runQuery({ selector: 'para', files: [f], format: 'podlite', failOnEmpty: false, quiet: true })
    expect(r.matchCount).toBe(2)
    expect(r.output).toBe('First paragraph.\n\n=para Second')
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

describe('runQuery names the source of every block', () => {
  const two = () => {
    const a = write('a.podlite', `=begin pod\n=head1 Alpha\n=end pod\n`)
    const b = write('b.podlite', `=begin pod\n=head1 Beta\n=head1 Gamma\n=end pod\n`)
    return { a, b }
  }
  const asJson = (files: string[], stdinContent?: string) =>
    JSON.parse(
      runQuery({ selector: 'head1', files, format: 'json', failOnEmpty: false, quiet: true, stdinContent }).output,
    )

  it('carries the file each block came from', () => {
    const { a, b } = two()
    const blocks = asJson([a, b])
    expect(blocks).toHaveLength(3)
    expect(blocks.map((x: { file: string }) => x.file)).toEqual([a, b, b])
  })

  it('writes the path as it was given', () => {
    const { a } = two()
    const [block] = asJson([a])
    expect(block.file).toBe(a)
  })

  it('keeps the fields of the block itself', () => {
    const { a } = two()
    const [block] = asJson([a])
    expect(block.type).toBe('block')
    expect(block.name).toBe('head')
    expect(block.content).toBeDefined()
  })

  it('names text handed in instead of a path', () => {
    const [block] = asJson([], '=begin pod\n=head1 Piped\n=end pod\n')
    expect(block.file).toBe('<stdin>')
  })

  it('leaves the other formats as they were', () => {
    const { a, b } = two()
    const raw = runQuery({ selector: 'head1', files: [a, b], format: 'podlite', failOnEmpty: false, quiet: true })
    expect(raw.output).toContain('=head1 Alpha')
    expect(raw.output).not.toContain(a)
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

// Output that invokes no renderer carries the text as written, hidden or not: the
// source format reproduces the source, and json is the document model. Rendered
// formats conceal it.
describe('runQuery and hidden content', () => {
  const doc = '=begin pod\n=for para :masked :id<s1>\nZentrox lives here\n=end pod\n'
  const query = (format: 'podlite' | 'json' | 'md' | 'html') =>
    runQuery({ selector: 'para', files: [write('doc.podlite', doc)], format, failOnEmpty: false, quiet: true }).output

  it('shows hidden text in the source format and in json', () => {
    expect(query('podlite')).toContain('Zentrox')
    expect(query('json')).toContain('Zentrox')
  })

  it('conceals hidden text in markdown and html', () => {
    expect(query('md')).not.toContain('Zentrox')
    expect(query('html')).not.toContain('Zentrox')
  })
})

describe('runQuery through =include', () => {
  const q = (selector: string, file: string, format: 'podlite' | 'json' = 'podlite') =>
    runQuery({ selector, files: [file], format, failOnEmpty: false, quiet: true })
  const test = '=begin test :id<frame-ok>\n=begin fixture\n=para x\n=end fixture\n=assert para\n=end test\n'

  it('finds a test brought in by its address', () => {
    write('t/frame.podlite', test)
    const main = write('spec.podlite', '=pod\n\n=head1 Rule\n\n=include file:./t/frame.podlite#frame-ok\n')
    const r = q('test', main)
    expect(r.matchCount).toBe(1)
    expect(r.output).toContain('=begin test :id<frame-ok>')
  })

  it('takes the text of an included block from the file it is written in', () => {
    write('part.podlite', '=pod\n\nSome text first.\n\n=head1 Child\n')
    const main = write('doc.podlite', '=pod\n\n=head1 Parent\n\n=include file:./part.podlite | head1\n')
    expect(q('head1', main).output).toBe('=head1 Parent\n\n=head1 Child')
  })

  it('gives a container as written and its included child from its own file', () => {
    write('c.podlite', '=pod\n\n=head1 Child\n')
    write('b.podlite', '=begin nested\n\n=include file:./c.podlite\n\n=end nested\n')
    const main = write('a.podlite', '=pod\n\n=include file:./b.podlite\n')
    expect(q('nested', main).output).toContain('=include file:./c.podlite')
    expect(q('head1', main).output).toBe('=head1 Child')
  })

  it('names in json the file a block is written in', () => {
    const part = write('part.podlite', '=pod\n\n=head1 Child\n')
    const main = write('doc.podlite', '=pod\n\n=include file:./part.podlite\n')
    const rows = JSON.parse(q('head1', main, 'json').output)
    expect(rows.map((row: { file: string }) => row.file)).toEqual([part])
  })

  it('applies a =config only to the blocks of the file it is written in', () => {
    write('child.podlite', '=pod\n\n=para Child\n')
    const host = write(
      'host.podlite',
      '=pod\n\n=config para :tag<host>\n\n=para Host\n\n=include file:./child.podlite\n\n=para After\n',
    )
    write('inner.podlite', '=pod\n\n=config para :tag<inner>\n\n=para Inner\n')
    const outer = write('outer.podlite', '=pod\n\n=include file:./inner.podlite\n\n=para Outer\n')
    expect([q('para[ :tag<host> ]', host).output, q('para[ :tag<inner> ]', outer).output]).toEqual([
      '=para Host\n\n=para After',
      '=para Inner',
    ])
  })

  it('reports a lost include and returns what it found', () => {
    write('part.podlite', '=pod\n\n=head1 Child\n')
    const main = write(
      'doc.podlite',
      '=pod\n\n=head1 Before\n\n=include file:./absent.podlite\n\n=include file:./part.podlite\n',
    )
    const r = q('head1', main)
    expect(r.matchCount).toBe(2)
    expect(r.exitCode).toBe(1)
    expect(r.problems).toEqual([`${path.relative(process.cwd(), main)}:5: include target not found: ./absent.podlite`])
  })

  it('reads an include on stdin from the working directory', () => {
    write('part.podlite', '=pod\n\n=head1 Child\n')
    const cwd = process.cwd()
    process.chdir(tmpDir)
    try {
      const r = runQuery({
        selector: 'head1',
        files: [],
        format: 'podlite',
        failOnEmpty: false,
        quiet: true,
        stdinContent: '=pod\n\n=include file:./part.podlite\n',
      })
      expect(r.output).toBe('=head1 Child')
    } finally {
      process.chdir(cwd)
    }
  })
})

describe('runQuery and a selector as the operand of in', () => {
  it('reads a file operand from the working directory, and fails when it does not resolve', () => {
    const f = write('guide.podlite', '=pod\n\n=for para :status<draft>\nDraft\n\n=for para :status<paid>\nPaid\n')
    write('vocabulary.podlite', '=defn paid\nMoney in.\n')
    const cwd = process.cwd()
    process.chdir(tmpDir)
    try {
      const q = (selector: string) =>
        runQuery({ selector, files: [f], format: 'podlite', failOnEmpty: false, quiet: true })
      const found = q('para[ :status(in file:vocabulary.podlite | defn) ]')
      const lost = q('para[ :status(in file:none.podlite | defn) ]')
      expect([found.output, found.exitCode, lost.matchCount, lost.exitCode]).toEqual([
        '=for para :status<paid>\nPaid',
        0,
        0,
        1,
      ])
      expect(lost.problems).toEqual([`${f}: the source does not resolve: file:none.podlite`])
    } finally {
      process.chdir(cwd)
    }
  })
})

describe('runQuery and a source written without a scheme', () => {
  it('selects from the file the source names, not from the file given', () => {
    const y = write('y.podlite', '=pod\n\nIn y.\n')
    const r = runQuery({ selector: 'x.podlite | para', files: [y], format: 'podlite', failOnEmpty: false, quiet: true })
    expect(r.matchCount).toBe(0)
  })
})

describe('runQuery over the tree convert reads', () => {
  const q = (selector: string, file: string, format: 'podlite' | 'json' | 'md' = 'podlite', failOnEmpty = false) =>
    runQuery({ selector, files: [file], format, failOnEmpty, quiet: true })
  const section = '=pod\n\n=begin markdown\n# Title\n\nMd para text.\n=end markdown\n'

  it('finds the blocks of a Markdown section and gives them as Markdown', () => {
    const f = write('doc.podlite', section)
    expect([q('para', f).output, q('head1', f).output]).toEqual(['Md para text.', '# Title'])
  })

  it('gives in json a block of a section the place of the section', () => {
    const f = write('doc.podlite', section)
    const [head] = JSON.parse(q('head1', f, 'json').output)
    expect([head.precision, head.location.start.line]).toEqual(['section', 3])
  })

  it('finds a Markdown section of an included file', () => {
    write('part.podlite', section)
    const main = write('main.podlite', '=pod\n\n=include file:./part.podlite\n')
    expect(q('para', main).output).toBe('Md para text.')
  })

  it('keeps a block of an included section known as one when the table of contents is made again', () => {
    write('part.podlite', section)
    const main = write('main.podlite', '=pod\n\n=toc head1\n\n=include file:./part.podlite | para\n')
    expect(q('para', main).output).toBe('Md para text.')
  })

  it('counts no block the tree adds around what was written', () => {
    const f = write('doc.podlite', section + '\n=for head1 :folded\nFolded\n\nUnder it.\n')
    const names = JSON.parse(q('*', f, 'json').output).map((b: { name: string }) => b.name)
    expect(names).toEqual(['pod', 'markdown', 'head', 'head'])
    const root = q('root', f, 'json', true)
    expect([root.output, root.matchCount, root.exitCode]).toEqual(['[]', 0, 1])
  })

  it('finds nothing with * in a document of one paragraph, while the test runner finds its root', () => {
    expect(q('*', write('doc.podlite', 'Loose paragraph.\n')).matchCount).toBe(0)
  })

  it('finds a table of contents made again over the includes', () => {
    write('part.podlite', '=pod\n\n=head1 Included\n')
    const main = write('main.podlite', '=pod\n\n=toc head1\n\n=head1 Own\n\n=include file:./part.podlite\n')
    const r = q('toc', main, 'json')
    const entries = JSON.stringify(JSON.parse(r.output)).match(/"toc-item"/g) || []
    expect([r.matchCount, entries.length, q('toc', main).output]).toEqual([1, 2, '=toc head1'])
  })

  it('gives a block with no place in the file as Markdown, and a row of data as one line', () => {
    const f = write(
      'doc.podlite',
      '=pod\n\n=for picture :caption<Nice>\nimg.png\n\n=begin data :key<people> :mime-type<text/csv>\n"A|B",1\nAda,36\n=end data\n\n=table data:people\n',
    )
    expect([q('caption', f).output, q('row', f).output, q('cell', f).output]).toEqual([
      'Nice',
      '| A\\|B | 1 |\n\n| Ada | 36 |',
      'A\\|B\n\n1\n\nAda\n\n36',
    ])
  })

  it('hides in md what the document hides, and gives it as written in podlite', () => {
    const f = write('doc.podlite', '=pod\n\n=for para :masked\nSecret words\n')
    expect(q('para', f, 'md').output).not.toContain('Secret')
    expect(q('para', f).output).toContain('Secret words')
  })
})
