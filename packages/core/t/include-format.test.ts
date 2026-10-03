import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { getTextContentFromNode, runSelector } from '@podlite/schema'
import { podlite } from '../src/index'
import { readerFor } from '../src/reader'
import { formatOfFile, formatOfType } from '../src/file-format'
import { assembleIncludes, sourcesFromFiles } from '../src/assemble'
import type { Source, Sources } from '../src/assemble'
import { resolveIncludes, IncludeProblem } from '../src/resolve-includes'
import { lintSource, resolveConfig } from '../src/lint'
import { detectFileType, parseContent } from '../src/lint/loader'
import { runQuery } from '../src/query'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-format-')))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

const write = (name: string, body: string): string => {
  const file = path.join(tmpDir, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
  return file
}

const p = podlite({ importPlugins: true })
const read = readerFor(p)

const assemble = (file: string): { tree: any; problems: IncludeProblem[] } => {
  const problems: IncludeProblem[] = []
  const text = fs.readFileSync(file, 'utf-8')
  const tree = resolveIncludes(read(text, file), {
    baseDir: path.dirname(file),
    // a host's own reader is handed the format as the fourth argument
    parse: (source, name, config, how) => read(source, name, config, how),
    file,
    text,
    self: file,
    onError: problem => problems.push(problem),
    onWarning: problem => problems.push(problem),
  })
  return { tree, problems }
}

const texts = (selector: string, tree: any): string[] =>
  runSelector(selector, [{ file: 'doc', node: tree }]).map((node: any) =>
    String(getTextContentFromNode(node.content)).replace(/[.*#]/g, '').trim(),
  )

const kinds = (problems: IncludeProblem[]): string[] => problems.map(problem => problem.kind)

describe('the format of a file', () => {
  it('is told from the extension of its name, without regard to case', () => {
    expect(['a.podlite', 'a.pod6', 'A.POD6'].map(formatOfFile)).toEqual(['podlite', 'podlite', 'podlite'])
    expect(['a.md', 'a.markdown', 'README.MD', 'dir.d/a.md'].map(formatOfFile)).toEqual(['md', 'md', 'md', 'md'])
    expect(['a.txt', 'a', '.podlite', 'a.md.txt', 'dir.md/a'].map(formatOfFile)).toEqual([
      'default',
      'default',
      'default',
      'default',
      'default',
    ])
  })

  it('is told from a declared type, and a type that is not text has none', () => {
    expect(['text/podlite', 'text/markdown', 'TEXT/Markdown; charset=utf-8', 'text/plain'].map(formatOfType)).toEqual([
      'podlite',
      'md',
      'md',
      'default',
    ])
    expect(['image/png', 'application/pdf'].map(formatOfType)).toEqual([undefined, undefined])
  })
})

describe('the reader', () => {
  it('reads a text with no format given as Podlite, whatever its name', () => {
    const tree = read('Text.\n', 'a')
    expect(texts('para', tree)).toEqual(['Text'])
  })

  it('reads the default format in the default mode: text outside blocks is ambient', () => {
    const tree: any = read('Plain line.\n=head1 Real\n\n=toc head1\n', 'notes.txt', undefined, { format: 'default' })
    expect(tree.content.some((node: any) => node.type === 'ambient')).toBe(true)
    expect(texts('para', tree)).toEqual([])
    expect(texts('head1', tree)).toEqual(['Real'])
  })

  it('gives the blocks of a Markdown text the settings in effect where it is placed', () => {
    const config = { code: [{ name: 'lang', value: 'python', type: 'string' as const }] }
    const tree = read('Text.\n\n```\nx\n```\n', 'a.md', config, { format: 'md' })
    expect(runSelector('code[ :lang<python> ]', [{ file: 'doc', node: tree }])).toHaveLength(1)
  })
})

describe('an included file is read in its format', () => {
  it('reads a .md and a .markdown file as Markdown', () => {
    write('a.md', '# Title\n\nSome *text*.\n')
    write('b.markdown', '# Other\n')
    const { tree, problems } = assemble(
      write('doc.podlite', '=pod\n\n=include file:./a.md\n\n=include file:./b.markdown\n'),
    )
    expect(problems).toEqual([])
    expect(texts('head1', tree)).toEqual(['Title', 'Other'])
    expect(JSON.stringify(tree)).not.toContain('# Title')
  })

  it('finds an address in a Markdown file by its heading', () => {
    write('a.md', '# Title\n\n## Sub\n')
    const { tree, problems } = assemble(write('doc.podlite', '=pod\n\n=include file:./a.md#Sub\n'))
    expect(problems).toEqual([])
    expect(texts('head2', tree)).toEqual(['Sub'])
  })

  it('reads a file of any other extension in the default mode', () => {
    write('notes.txt', 'Plain line.\n=head1 Real\n')
    const { tree } = assemble(write('doc.podlite', '=pod\n\n=include file:./notes.txt\n'))
    expect(texts('head1', tree)).toEqual(['Real'])
    expect(texts('para', tree)).toEqual([])
  })

  it('reads the example of the norm: a type declared after the source', () => {
    write('includes/text.txt', 'Plain line.\n')
    const { tree, problems } = assemble(
      write('doc.podlite', "=pod\n\n=include file:./includes/text.txt :mime-type('text/podlite')\n"),
    )
    expect(problems).toEqual([])
    expect(texts('para', tree)).toEqual(['Plain line'])
  })

  it('takes a declared type after an address, before a selection, and with a bar inside its quotes', () => {
    write('x.txt', '=for head1 :id<one>\nOne\n\nText.\n\n=head2 Two\n')
    const doc = write(
      'doc.podlite',
      [
        '=pod',
        '',
        "=include file:./x.txt#one :mime-type('text/podlite')",
        '',
        '=include file:./x.txt :mime-type<text/podlite> | head2',
        '',
        '=include file:./x.txt :mime-type("text/podlite") :caption(\'a|b\') | head2',
        '',
      ].join('\n'),
    )
    const { tree, problems } = assemble(doc)
    expect(problems).toEqual([])
    expect(texts('head1', tree)).toEqual(['One'])
    expect(texts('head2', tree)).toEqual(['Two', 'Two'])
  })

  it('reads a value in brackets whole, and takes a type after a source written without its scheme', () => {
    write('x.txt', '# Heading\n')
    const doc = write(
      'doc.podlite',
      [
        '=pod',
        '',
        "=include file:./x.txt :mime-type<text/markdown> :caption<one :two | three it's>",
        '',
        "=include x.txt :mime-type('text/markdown') | head1",
        '',
        '=include file:./x.txt :mime-type<text/markdown> :caption｢a|b｣',
        '',
        '=include file:./x.txt :mime-type<text/markdown> :caption｢a < b｣',
        '',
        "=include file:./x.txt :mime-type<text/markdown> :caption<'a > b'>",
        '',
        "=include file:./x.txt :mime-type<text/markdown> :caption('a) | b') | head1",
        '',
        "=include file:./x.txt :mime-type<text/markdown> :x{a=>'a} | b'} | head1",
        '',
      ].join('\n'),
    )
    const { tree, problems } = assemble(doc)
    expect(problems).toEqual([])
    expect(texts('head1', tree)).toEqual(['Heading', 'Heading', 'Heading', 'Heading', 'Heading', 'Heading', 'Heading'])
  })

  it('takes a type written without space before it as part of the path', () => {
    write('x.txt', '=head1 X\n')
    const { problems } = assemble(write('doc.podlite', "=pod\n\n=include file:./x.txt:mime-type('text/podlite')\n"))
    expect(kinds(problems)).toEqual(['source'])
  })

  it('reports a declared type with no reader as an error of format, and names the lost assignments', () => {
    write('x.txt', '=head1 X\n')
    const { tree, problems } = assemble(
      write('doc.podlite', "=pod\n\n=set :id<x>\n=include file:./x.txt :mime-type('image/png')\n"),
    )
    expect(kinds(problems)).toEqual(['format'])
    expect(problems[0].lost).toEqual(['id'])
    expect(problems[0].message).toContain('include format is not supported: image/png')
    expect(runSelector('include', [{ file: 'doc', node: tree }])).toEqual([])
  })

  it('leaves the line unread when its configuration does not read whole', () => {
    write('x.txt', '=head1 X\n')
    const twice = assemble(
      write('twice.podlite', "=pod\n\n=include file:./x.txt :mime-type('text/podlite') :mime-type('text/markdown')\n"),
    )
    const open = assemble(write('open.podlite', "=pod\n\n=include file:./x.txt :mime-type('text/podlite\n"))
    expect([kinds(twice.problems), kinds(open.problems)]).toEqual([['unparsed-selector'], ['unparsed-selector']])
  })

  it('reads one file twice when two directives declare different types, also under the settings at the directive', () => {
    write('x.txt', '# Heading\n')
    write('part.podlite', "=pod\n\n=include file:./x.txt :mime-type('text/markdown')\n")
    const doc = write(
      'doc.podlite',
      [
        '=pod',
        '',
        '=config para :tag<a>',
        '',
        "=include file:./x.txt :mime-type('text/podlite')",
        '',
        '=include file:./part.podlite | head1',
        '',
      ].join('\n'),
    )
    const { tree, problems } = assemble(doc)
    expect(problems).toEqual([])
    expect(texts('para', tree)).toEqual(['Heading'])
    expect(texts('head1', tree)).toEqual(['Heading'])
  })

  it('reads one file twice at one level when two directives under settings declare different types', () => {
    write('x.txt', '# Heading\n')
    const doc = write(
      'doc.podlite',
      [
        '=pod',
        '',
        '=config para :tag<a>',
        '',
        "=include file:./x.txt :mime-type('text/podlite') | para",
        '',
        "=include file:./x.txt :mime-type('text/markdown') | head1",
        '',
      ].join('\n'),
    )
    const { tree, problems } = assemble(doc)
    expect(problems).toEqual([])
    expect(texts('para', tree)).toEqual(['Heading'])
    expect(texts('head1', tree)).toEqual(['Heading'])
  })

  it('gives an included Markdown code block the settings of the including file', () => {
    write('part.md', 'Text.\n\n```\nx\n```\n')
    const { tree } = assemble(write('doc.podlite', '=pod\n\n=config code :lang<python>\n=include file:./part.md\n'))
    expect(runSelector('code[ :lang<python> ]', [{ file: 'doc', node: tree }])).toHaveLength(1)
  })
})

describe('the format a provider gives', () => {
  const assembleWith = (text: string, sources: Sources): { tree: any; problems: IncludeProblem[] } => {
    const problems: IncludeProblem[] = []
    const tree = assembleIncludes(read(text, 'doc.podlite'), {
      sources,
      context: '',
      parse: read,
      onError: problem => problems.push(problem),
      onWarning: problem => problems.push(problem),
    })
    return { tree, problems }
  }
  const withFormat = (format: Source['format']): Sources => {
    const known = sourcesFromFiles({ 'x.txt': '# Heading\n' })
    return {
      ...known,
      locate: (...args) => {
        const located = known.locate(...args)
        return located && { ...located, sources: located.sources.map(source => ({ ...source, format })) }
      },
    }
  }

  it('is older than the name, and a declared type older than both, also in the reading on its own', () => {
    const md = assembleWith('=pod\n\n=include file:x.txt\n', withFormat('md'))
    expect(texts('head1', md.tree)).toEqual(['Heading'])
    const declared = assembleWith(
      "=pod\n\n=config para :tag<a>\n\n=include file:x.txt :mime-type('text/podlite') | para\n",
      withFormat('md'),
    )
    expect(texts('para', declared.tree)).toEqual(['Heading'])
  })

  it('is told from the id, not from the name a provider shows', () => {
    const sources: Sources = {
      schemes: ['doc'],
      locate: () => ({ masked: false, sources: [{ id: '/chapter.md', name: 'Chapter', context: '/' }] }),
      read: () => '# Heading\n',
    }
    const { tree, problems } = assembleWith('=pod\n\n=include doc:Chapter#Heading\n', sources)
    expect(problems).toEqual([])
    expect(texts('head1', tree)).toEqual(['Heading'])
  })
})

describe('commands that read an included file', () => {
  it('lint finds what convert finds in an included Markdown file and reads the example of the norm', () => {
    write('a.md', '# Title\n\n## Sub\n')
    write('includes/text.txt', '# Declared\n')
    const doc = write(
      'doc.podlite',
      "=pod\n\n=include file:./a.md#Sub\n\n=include file:./includes/text.txt#Declared :mime-type('text/markdown')\n",
    )
    const report = lintSource(
      fs.readFileSync(doc, 'utf-8'),
      doc,
      resolveConfig([doc], { strict: false, format: 'text' }),
      true,
    )
    expect(report.violations.filter(v => v.rule === 'include-resolves')).toEqual([])
  })

  it('lint reads a file of another extension in the default mode, with no word of Markdown in it', () => {
    const file = write('notes.txt', 'Plain line.\n# Not a heading here\n=head1 Real\n')
    const report = lintSource(
      fs.readFileSync(file, 'utf-8'),
      file,
      resolveConfig([file], { strict: false, format: 'text' }),
      true,
    )
    expect(report.violations.map(v => v.rule)).not.toContain('markdown-in-pod')
    const tree: any = parseContent(fs.readFileSync(file, 'utf-8'), detectFileType(file))
    expect(tree.content.some((node: any) => node.type === 'ambient')).toBe(true)
  })

  it('query reads the example of the norm', () => {
    write('includes/text.txt', '=head1 From text\n')
    const doc = write('doc.podlite', "=pod\n\n=include file:./includes/text.txt :mime-type('text/podlite')\n")
    const result = runQuery({ selector: 'head1', files: [doc], format: 'podlite', failOnEmpty: false, quiet: true })
    expect([result.matchCount, result.problems]).toEqual([1, []])
  })

  it('query reads a Markdown document as Markdown', () => {
    const doc = write('a.md', '# Title\n\nText.\n')
    const result = runQuery({ selector: 'head1', files: [doc], format: 'json', failOnEmpty: false, quiet: true })
    expect(result.matchCount).toBe(1)
  })
})
