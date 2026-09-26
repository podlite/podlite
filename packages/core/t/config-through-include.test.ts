import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { runSelector, toHtml } from '@podlite/schema'
import type { ConfigScope } from '@podlite/schema'
import { runQuery } from '../src/query'
import { podlite } from '../src/index'
import { resolveIncludes, isWarning, IncludeProblem } from '../src/resolve-includes'
import { runTests } from '../src/test/run'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-config-include-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

const write = (name: string, body: string): string => {
  const file = path.join(tmpDir, name)
  fs.writeFileSync(file, body)
  return file
}

const q = (selector: string, file: string) =>
  runQuery({ selector, files: [file], format: 'podlite', failOnEmpty: false, quiet: true })

const p = podlite({ importPlugins: true })
const read = (source: string, config?: ConfigScope) => p.toAst(p.parse(source, { podMode: 1, config }), { config })

const assemble = (file: string): { tree: any; problems: IncludeProblem[] } => {
  const problems: IncludeProblem[] = []
  const tree = resolveIncludes(read(fs.readFileSync(file, 'utf-8')), {
    baseDir: path.dirname(file),
    parse: (source, _file, config) => read(source, config),
    file,
    self: file,
    onError: problem => problems.push(problem),
    onWarning: problem => problems.push(problem),
  })
  return { tree, problems }
}

const texts = (selector: string, tree: any): string[] =>
  runSelector(selector, [{ file: 'doc', node: tree }]).map(
    (n: any) => JSON.stringify(n.content).match(/"value":"([^"\\]*)/)?.[1] ?? '',
  )

describe('=config of the including file in included blocks', () => {
  it('reaches a file included twice with the settings at each directive', () => {
    write('child.podlite', '=pod\n\n=para Child\n')
    const host = write(
      'host.podlite',
      '=pod\n\n=config para :tag<a>\n\n=include file:./child.podlite\n\n=config para :tag<b>\n\n=include file:./child.podlite\n',
    )
    expect([q('para[ :tag<a> ]', host).matchCount, q('para[ :tag<b> ]', host).matchCount]).toEqual([1, 1])
  })

  it('passes through a file to the file it includes, the nearer file first', () => {
    write('leaf.podlite', '=pod\n\n=para Leaf\n')
    write('part.podlite', '=pod\n\n=config para :v<part>\n\n=include file:./leaf.podlite\n')
    const book = write('book.podlite', '=pod\n\n=config para :v<book> :w<book>\n\n=include file:./part.podlite\n')
    expect([q('para[ :v<part> ]', book).output, q('para[ :w<book> ]', book).output]).toEqual([
      '=para Leaf',
      '=para Leaf',
    ])
    expect(q('para[ :v<book> ]', book).matchCount).toBe(0)
  })

  it('opens an included code block to the markup codes it allows', () => {
    write('child.podlite', '=begin code\nB<x>\n=end code\n')
    const host = write('host.podlite', '=config code :allow<B>\n\n=include file:./child.podlite\n')
    expect(toHtml({}).run(assemble(host).tree).toString()).toContain('<strong>x</strong>')
  })

  it('reaches an include written after a folded heading', () => {
    write('child.podlite', '=pod\n\n=para Child\n')
    const host = write(
      'host.podlite',
      '=for head1 :folded\nA\n\n=config para :tag<host>\n\n=head1 B\n\n=include file:./child.podlite\n',
    )
    expect(q('para[ :tag<host> ]', host).output).toBe('=para Child')
  })
})

describe('an include selector under =config of the including file', () => {
  const host = (selector: string, config = '=config para :tag<host>') =>
    write('host.podlite', `=pod\n\n${config}\n\n=include file:./child.podlite${selector}\n`)

  it('reads the file without those settings', () => {
    write('child.podlite', '=pod\n\n=para Child\n')
    expect(q('para', host(' | para[ :tag<host> ]')).matchCount).toBe(0)
  })

  it('finds no address the settings alone would give', () => {
    write('child.podlite', '=pod\n\n=para Child\n')
    const { problems } = assemble(host('#from-host', '=config para :id<from-host>'))
    expect(problems.map(problem => problem.kind)).toEqual(['address'])
  })

  it('places a found row and a found cell', () => {
    write('child.podlite', '=begin table\na | b\nc | d\n=end table\n')
    const rows = assemble(host(' | row', '=config table :caption<T>'))
    const cells = assemble(host(' | cell', '=config table :caption<T>'))
    expect([rows.problems, cells.problems]).toEqual([[], []])
    expect([texts('row', rows.tree).length, texts('cell', cells.tree).length]).toEqual([2, 4])
  })

  it('places a paragraph found under a folded heading', () => {
    write('child.podlite', '=for head1 :folded\nTitle\n\n=para Under\n')
    const { tree, problems } = assemble(host(' | para'))
    expect(problems).toEqual([])
    expect(runSelector('para[ :tag<host> ]', [{ file: 'doc', node: tree }]).length).toBe(1)
  })

  it('places a block found inside a Markdown section', () => {
    write('child.podlite', '=begin markdown\n# Title\n\ntext\n=end markdown\n')
    const { tree, problems } = assemble(host(' | head1'))
    expect(problems).toEqual([])
    expect(runSelector('head1', [{ file: 'doc', node: tree }]).length).toBe(1)
  })

  it('places a found block with what its own include brings', () => {
    write('leaf.podlite', '=pod\n\n=para Leaf\n')
    write('child.podlite', '=begin nested\n\n=include file:./leaf.podlite\n\n=end nested\n')
    const { tree, problems } = assemble(host(' | nested'))
    expect(problems).toEqual([])
    expect(runSelector('para[ :tag<host> ]', [{ file: 'doc', node: tree }]).length).toBe(1)
  })

  it('tells apart the files a found block came through', () => {
    write('one.podlite', '=head1 One\n')
    write('two.podlite', '=head1 Two\n')
    write(
      'child.podlite',
      '=include file:./one.podlite\n\n=include file:./two.podlite\n\n=include file:./one.podlite\n',
    )
    const book = host(' | head1', '=config head1 :tag<host>')
    expect(q('head1[ :tag<host> ]', book).output).toBe('=head1 One\n\n=head1 Two\n\n=head1 One')
  })
})

describe('an include that fails inside an included file, under =config of the including file', () => {
  it('is reported once, and a =set before the outer include reaches its block', () => {
    write('part.podlite', '=para First\n\n=include file:./absent.podlite\n')
    const book = write('book.podlite', '=config para :tag<host>\n\n=set :id<chosen>\n=include file:./part.podlite\n')
    const { tree, problems } = assemble(book)
    expect(problems.map(problem => problem.message)).toEqual(['include target not found: ./absent.podlite'])
    const found = (selector: string) => texts(selector, tree)
    expect([found('para[ :id<chosen> ]'), found('para[ :tag<host> ]')]).toEqual([['First'], ['First']])
  })
})

describe('a found block the settings at the directive read as something else', () => {
  const files = (): string => {
    write('child.podlite', '=begin markdown\n# H B<X>\n=end markdown\n')
    return write('host.podlite', '=config markdown :allow<B>\n\n=include file:./child.podlite | head1\n')
  }

  it('is placed as its file reads on its own, with a warning', () => {
    const { tree, problems } = assemble(files())
    expect(runSelector('head1', [{ file: 'doc', node: tree }]).length).toBe(1)
    expect(problems.map(problem => [problem.kind, isWarning(problem)])).toEqual([['include-reading-differs', true]])
  })

  it('does not fail a query, which prints the block as the section holds it', () => {
    const r = q('head1', files())
    expect([r.matchCount, r.exitCode]).toEqual([1, 0])
    expect(r.problems.length).toBe(1)
    expect(r.output).not.toContain('=begin')
  })

  it('takes a =set written before the include when an include after it fails', () => {
    write('child.podlite', '=begin markdown\n# H B<X>\n=end markdown\n\n=include file:./absent.podlite\n')
    const host = write(
      'host.podlite',
      '=config markdown :allow<B>\n\n=set :id<chosen>\n=include file:./child.podlite | head1\n',
    )
    const { tree, problems } = assemble(host)
    expect(problems.map(problem => problem.message).filter(message => message.includes('=set'))).toEqual([])
    expect(runSelector('head1[ :id<chosen> ]', [{ file: 'doc', node: tree }]).length).toBe(1)
  })

  it('does not fail a test run over the document', () => {
    const doc = files()
    const main = write('rules.podlite', '=begin test :id<has-heading>\n=begin assert\nhead1\n=end assert\n=end test\n')
    const [test] = runTests({ tests: [{ kind: 'file', path: main }], against: [doc] }).tests
    expect(test.status).toBe('passed')
  })
})
