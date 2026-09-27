import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { runSelector, toHtml, toMarkdown } from '@podlite/schema'
import type { ConfigScope } from '@podlite/schema'
import { runQuery } from '../src/query'
import { podlite } from '../src/index'
import { resolveIncludes } from '../src/resolve-includes'
import { refreshTocs } from '../src/refresh-tocs'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-include-scope-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

const write = (name: string, body: string): string => {
  const file = path.join(tmpDir, name)
  fs.writeFileSync(file, body)
  return file
}

const p = podlite({ importPlugins: true })
const read = (source: string, config?: ConfigScope) => p.toAst(p.parse(source, { podMode: 1, config }), { config })

const assemble = (file: string): any =>
  resolveIncludes(read(fs.readFileSync(file, 'utf-8')), {
    baseDir: path.dirname(file),
    parse: (source, _file, config) => read(source, config),
    file,
    self: file,
  })

const html = (file: string): string => toHtml({}).run(assemble(file)).toString().replace(/\n/g, '')
const markdown = (file: string): string => toMarkdown({}).run(assemble(file)).toString()

const chapter = [
  '=alias X Inner',
  "=config L<> :title('tip')",
  '=config para :class<own>',
  '',
  '=head1 Chapter',
  '',
  '=para In A<X> L<a|https://a.example>',
  '',
].join('\n')

describe('a file an include brings whole', () => {
  it('keeps its =config and =alias to itself in html', () => {
    write('ch.podlite', chapter)
    const out = html(write('book.podlite', '=include file:./ch.podlite\n\n=para After A<X> L<b|https://b.example>\n'))
    expect(out).toContain('In Inner <a href="https://a.example" title="tip">a</a>')
    expect(out).toContain('After A&lt;X&gt; <a href="https://b.example">b</a>')
  })

  it('keeps its =config and =alias to itself in markdown', () => {
    write('ch.podlite', chapter)
    const out = markdown(
      write('book.podlite', '=include file:./ch.podlite\n\n=para After A<X> L<b|https://b.example>\n'),
    )
    expect(out).toContain('In Inner [a](https://a.example "tip")')
    expect(out).toContain('After A<X> [b](https://b.example)')
  })

  it('takes the =config and =alias of the including file', () => {
    write('ch.podlite', '=para In A<Y> L<a|https://a.example>\n')
    const out = html(
      write('book.podlite', "=alias Y Outer\n=config L<> :title('book')\n\n=include file:./ch.podlite\n"),
    )
    expect(out).toContain('In Outer <a href="https://a.example" title="book">a</a>')
  })

  it('does not pass its =config and =alias to the next file of a mask', () => {
    write('ch1.podlite', chapter)
    write('ch2.podlite', '=para Second A<X> L<c|https://c.example>\n')
    const out = html(write('book.podlite', '=include file:./ch*.podlite\n'))
    expect(out).toContain('Second A&lt;X&gt; <a href="https://c.example">c</a>')
  })

  it('does not pass the =config and =alias of a file it includes to its own blocks', () => {
    write('leaf.podlite', chapter)
    write('part.podlite', '=include file:./leaf.podlite\n\n=para Part A<X> L<p|https://p.example>\n')
    const out = html(write('book.podlite', '=include file:./part.podlite\n'))
    expect(out).toContain('Part A&lt;X&gt; <a href="https://p.example">p</a>')
  })

  it('is written to html with no warning about a node left unhandled', () => {
    write('ch.podlite', chapter)
    const book = write('book.podlite', '=include file:./ch.podlite\n')
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    html(book)
    const calls = warn.mock.calls.length
    warn.mockRestore()
    expect(calls).toBe(0)
  })

  it('gives a =set written before the include to its first block', () => {
    write('ch.podlite', chapter)
    const tree = assemble(write('book.podlite', '=set :id<chosen>\n=include file:./ch.podlite\n'))
    const found = runSelector('head1[ :id<chosen> ]', [{ file: 'doc', node: tree }])
    expect(found.length).toBe(1)
  })

  it('is found through by a query, in podlite and in json', () => {
    const part = write('ch.podlite', chapter)
    const book = write('book.podlite', '=include file:./ch.podlite\n')
    const q = (format: 'podlite' | 'json') =>
      runQuery({ selector: 'head1', files: [book], format, failOnEmpty: false, quiet: true })
    expect(q('podlite').output).toBe('=head1 Chapter')
    expect(JSON.parse(q('json').output).map((row: { file: string }) => row.file)).toEqual([part])
    expect(
      runQuery({ selector: 'root', files: [book], format: 'podlite', failOnEmpty: false, quiet: true }).matchCount,
    ).toBe(0)
  })

  it('has its headings listed by a table of contents of the including file', () => {
    write('ch.podlite', chapter)
    const book = write('book.podlite', '=toc head1\n\n=head1 Book\n\n=include file:./ch.podlite\n')
    const text = fs.readFileSync(book, 'utf-8')
    const origin = new WeakMap()
    const assembled = resolveIncludes(read(text), {
      baseDir: path.dirname(book),
      parse: (source, _file, config) => read(source, config),
      file: book,
      self: book,
      text,
      origin,
    })
    const tree = refreshTocs(assembled, p.parse(text, { podMode: 1 }), book, origin)
    const out = toHtml({}).run(tree).toString()
    expect(out.split('Chapter').length - 1).toBeGreaterThan(1)
  })
})
