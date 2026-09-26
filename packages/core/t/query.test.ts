import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { runSelector } from '@podlite/schema'
import { runQuery } from '../src/query'
import { podlite } from '../src/index'
import { resolveIncludes, IncludeOrigin } from '../src/resolve-includes'
import { refreshTocs } from '../src/refresh-tocs'
import { isWrapper } from '../src/query-blocks'

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

  it('applies a =config to the blocks an include places after it, and to none of the including file', () => {
    write('child.podlite', '=pod\n\n=para Child\n')
    const host = write(
      'host.podlite',
      '=pod\n\n=config para :tag<host>\n\n=para Host\n\n=include file:./child.podlite\n\n=para After\n',
    )
    write('inner.podlite', '=pod\n\n=config para :tag<inner>\n\n=para Inner\n')
    const outer = write('outer.podlite', '=pod\n\n=include file:./inner.podlite\n\n=para Outer\n')
    expect([q('para[ :tag<host> ]', host).output, q('para[ :tag<inner> ]', outer).output]).toEqual([
      '=para Host\n\n=para Child\n\n=para After',
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
    write('x.podlite', '=pod\n\nIn x.\n')
    const y = write('y.podlite', '=pod\n\nIn y.\n')
    const cwd = process.cwd()
    process.chdir(tmpDir)
    try {
      const r = runQuery({
        selector: 'x.podlite | para',
        files: [y],
        format: 'podlite',
        failOnEmpty: false,
        quiet: true,
      })
      expect([r.output, r.exitCode, r.problems]).toEqual([
        'In x.',
        0,
        [`the selector names its own source; not read: ${y}`],
      ])
    } finally {
      process.chdir(cwd)
    }
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

  it('gives the same json from run to run', () => {
    const f = write('doc.podlite', section.replace('Md para text.', 'Md para text.\n\n- item') + '\n=para Own\n')
    const once = q('*, para', f, 'json').output
    expect([once === q('*, para', f, 'json').output, /"id"/.test(once)]).toEqual([true, false])
  })

  it('keeps the address the author wrote in json', () => {
    const [para] = JSON.parse(q('para', write('doc.podlite', '=pod\n\n=for para :id<here>\nText\n'), 'json').output)
    expect(para.config).toEqual([{ name: 'id', type: 'string', value: 'here' }])
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
    const names = JSON.parse(q('*', f, 'json').output).map((b: { type: string; name?: string }) => b.name ?? b.type)
    expect(names).toEqual(['pod', 'markdown', 'head', 'para', 'head', 'para'])
    const root = q('root', f, 'json', true)
    expect([root.output, root.matchCount, root.exitCode]).toEqual(['[]', 0, 1])
  })

  it('finds the paragraph of a document of one paragraph with *, and not its root', () => {
    const f = write('doc.podlite', 'Loose paragraph.\n')
    expect([q('*', f).output, q('root', f).matchCount]).toEqual(['Loose paragraph.', 0])
  })

  it('finds a table of contents made again over the includes', () => {
    write('part.podlite', '=pod\n\n=head1 Included\n')
    const main = write('main.podlite', '=pod\n\n=toc head1\n\n=head1 Own\n\n=include file:./part.podlite\n')
    const r = q('toc', main, 'json')
    const entries = JSON.stringify(JSON.parse(r.output)).match(/"toc-item"/g) || []
    expect([r.matchCount, entries.length, q('toc', main).output]).toEqual([1, 2, '=toc head1'])
  })

  it('makes a table of contents again over a file brought in with its own, and counts each once', () => {
    write('part.podlite', '=pod\n\n=toc head1\n\n=head1 Included\n')
    const main = write('main.podlite', '=pod\n\n=toc head1\n\n=head1 Own\n\n=include file:./part.podlite | *\n')
    const tocs = JSON.parse(q('toc', main, 'json').output)
    const entries = JSON.stringify(tocs[0]).match(/"toc-item"/g) || []
    expect([tocs.length, entries.length]).toEqual([2, 2])
  })

  it('finds with item the items of the first level only', () => {
    const f = write('doc.podlite', '=pod\n\n=item Top\n\n=item2 Nested\n')
    expect([q('item', f).matchCount, q('item', f).output]).toEqual([1, '=item Top'])
  })

  it('lists with * the blocks found inside found blocks', () => {
    const f = write('doc.podlite', '=begin pod\n=head1 Inside\n=end pod\n')
    expect(JSON.parse(q('*', f, 'json').output).map((b: { name?: string; type: string }) => b.name ?? b.type)).toEqual([
      'pod',
      'head',
    ])
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

describe('runQuery and convert read one tree', () => {
  it('selects the same blocks as the tree convert builds, with includes, a table of contents and a section', () => {
    write('part.podlite', '=pod\n\n=head1 Included\n\n=begin markdown\n# From md\n\nText.\n=end markdown\n')
    const text = '=pod\n\n=toc head1\n\n=head1 Own\n\n=include file:./part.podlite\n'
    const main = write('main.podlite', text)
    const p = podlite({ importPlugins: true })
    const parseToAst = (source: string) => p.toAst(p.parse(source, { podMode: 1 }))
    const origin = new WeakMap<object, IncludeOrigin>()
    const resolved = resolveIncludes(parseToAst(text), { baseDir: tmpDir, parse: parseToAst, file: main, text, origin })
    const tree = refreshTocs(resolved, p.parse(text, { podMode: 1 }), main, origin)
    const converted = runSelector('*', [{ file: main, node: tree.content }])
      .filter((b: any) => !isWrapper(b))
      .map((b: any) => b.name)
    const queried = JSON.parse(
      runQuery({ selector: '*', files: [main], format: 'json', failOnEmpty: false, quiet: true }).output,
    )
    expect(queried.map((b: { name: string }) => b.name)).toEqual(converted)
  })
})

describe('runQuery and a source it reads itself', () => {
  const inDir = <T>(run: () => T): T => {
    const cwd = process.cwd()
    process.chdir(tmpDir)
    try {
      return run()
    } finally {
      process.chdir(cwd)
    }
  }
  const q = (selector: string, files: string[] = [], extra: Partial<Parameters<typeof runQuery>[0]> = {}) =>
    inDir(() => runQuery({ selector, files, format: 'podlite', failOnEmpty: false, quiet: true, ...extra }))

  it('reads the file from the working directory, with no files given', () => {
    write('x.podlite', '=pod\n\nIn x.\n')
    const r = q('file:x.podlite | para')
    expect([r.output, r.exitCode, r.problems]).toEqual(['In x.', 0, []])
  })

  it('reports a source that does not resolve once, and the files given are not read', () => {
    write('a.podlite', '=pod\n\nIn a.\n')
    const r = q('file:x.podlite | para', ['a.podlite', 'absent.podlite'])
    expect([r.matchCount, r.exitCode, r.problems]).toEqual([
      0,
      1,
      [
        'the selector names its own source; not read: a.podlite, absent.podlite',
        'the source does not resolve: file:x.podlite',
      ],
    ])
  })

  it('no longer takes a file given for a source of the same tail', () => {
    write('sub/x.podlite', '=pod\n\nIn sub.\n')
    expect(q('file:x.podlite | para', ['sub/x.podlite']).exitCode).toBe(1)
  })

  it('reads a path going up and an absolute path', () => {
    write('x.podlite', '=pod\n\nIn x.\n')
    write('sub/keep.podlite', '=pod\n')
    const up = inDir(() => {
      process.chdir('sub')
      return runQuery({
        selector: 'file:../x.podlite | para',
        files: [],
        format: 'podlite',
        failOnEmpty: false,
        quiet: true,
      })
    })
    expect([up.output, q(`file:${path.join(tmpDir, 'x.podlite')} | para`).output]).toEqual(['In x.', 'In x.'])
  })

  it('expands a mask on disk, and an empty mask finds nothing without an error', () => {
    write('notes.pod6', '=pod\n\nIn notes.\n')
    const r = q('file:*.pod6 | para')
    const none = q('file:*.txt | para')
    expect([
      r.output,
      [none.matchCount, none.exitCode],
      q('file:*.txt | para', [], { failOnEmpty: true }).exitCode,
    ]).toEqual(['In notes.', [0, 0], 1])
  })

  it('still reads an operand when the mask is empty', () => {
    const lost = q('file:*.txt | para[ :s(in file:none.podlite | defn) ]')
    const quiet = q('file:*.txt | para[ :s(in defn) ]')
    expect([lost.exitCode, lost.problems, quiet.exitCode, quiet.problems]).toEqual([
      1,
      ['the source does not resolve: file:none.podlite'],
      0,
      [],
    ])
  })

  it('fails over an empty mask when an include of an operand file does not resolve', () => {
    write('vocab.podlite', '=pod\n\n=include file:./missing.podlite\n\n=defn paid\nMoney in.\n')
    const r = q('file:*.txt | para[ :s(in file:vocab.podlite | defn) ]')
    expect([r.exitCode, r.problems.some(p => p.includes('include target not found'))]).toEqual([1, true])
  })

  it('reads an operand in the file each block is found in, over a mask', () => {
    write('a.podlite', '=defn paid\nMoney in.\n\n=for para :status<paid>\nIn a.\n')
    write('b.podlite', '=defn draft\nNot done.\n\n=for para :status<paid>\nIn b.\n')
    expect(q('file:*.podlite | para[ :status(in defn) ]').output).toBe('=for para :status<paid>\nIn a.')
  })

  it('finds an address in any file of a mask, and reports one that no file holds once', () => {
    write('a.podlite', '=pod\n\n=head1 Other\n')
    write('b.podlite', '=pod\n\n=for para :id<hit>\nHit.\n')
    const found = q('file:*.podlite#hit')
    const lost = q('file:*.podlite#nope')
    expect([found.output, found.exitCode, lost.exitCode, lost.problems]).toEqual([
      '=for para :id<hit>\nHit.',
      0,
      1,
      ['no block has the address nope: file:*.podlite#nope'],
    ])
  })

  it('finds an address by the text of a heading', () => {
    write('x.podlite', '=pod\n\n=head1 Overview\n\nText.\n')
    expect(q('file:x.podlite#Overview').output).toBe('=head1 Overview')
  })

  it('does not take an id the parser gives a block for an address', () => {
    const f = write('x.podlite', '=pod\n\nText.\n')
    const [block] = JSON.parse(
      runQuery({ selector: 'para', files: [f], format: 'json', failOnEmpty: false, quiet: true }).output,
    )
    expect(block.id).toBeUndefined()
    expect(q('file:x.podlite#Text.').exitCode).toBe(1)
  })

  it('gives the file and the text of a block its source includes', () => {
    write('part.podlite', '=pod\n\n=head1 From part\n')
    write('x.podlite', '=pod\n\n=head1 Own\n\n=include file:./part.podlite\n')
    const json = JSON.parse(q('file:x.podlite | head1', [], { format: 'json' }).output)
    expect(json.map((b: { file: string }) => path.basename(b.file))).toEqual(['x.podlite', 'part.podlite'])
    expect(q('file:x.podlite | head1').output).toBe('=head1 Own\n\n=head1 From part')
  })

  it('reports a doc: source no file answers once, and finds one on stdin', () => {
    const a = write('a.podlite', '=pod\n\nIn a.\n')
    const b = write('b.podlite', '=pod\n\nIn b.\n')
    const lost = q('doc:Nope | para', [a, b])
    const found = q('doc:Pipe | head1', [a], { stdinContent: '=NAME Pipe\n\n=head1 In pipe\n' })
    expect([lost.exitCode, lost.problems, found.output]).toEqual([
      1,
      ['the source does not resolve: doc:Nope'],
      '=head1 In pipe',
    ])
  })
})
