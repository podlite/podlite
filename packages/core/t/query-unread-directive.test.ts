import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { spawnSync } from 'child_process'
import { runQuery } from '../src/query'

// a stray =end inside the root block: the root is lost, the heading after it stays
const broken = '=begin pod\n=begin code\ntext\n=end code\n=end code\n=head1 Survivor\n=end pod\n'
const UNREAD = 'Line looks like a directive but could not be read; it stays as text'

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-query-unread-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const write = (name: string, content: string): string => {
  const full = path.join(dir, name)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
  return full
}
const query = (selector: string, files: string[], stdinContent?: string) =>
  runQuery({ selector, files, stdinContent, format: 'podlite', failOnEmpty: false, quiet: true })
const linesOf = (problems: string[], file: string) =>
  problems
    .filter(p => p.startsWith(`${file}:`) && p.endsWith(UNREAD))
    .map(p => Number(p.slice(file.length + 1).split(':')[0]))

describe('a document whose directive line could not be read', () => {
  it('is named with every such line, the selection fails, and what was found is printed', () => {
    const f = write('broken.podlite', broken)
    const r = query('head1', [f])
    expect(linesOf(r.problems, f)).toEqual([1, 5, 7])
    expect(r.exitCode).toBe(1)
    expect(r.output).toContain('Survivor')
  })

  it('is counted by its own lines whatever ends them', () => {
    for (const end of ['\n', '\r\n', '\r']) {
      const f = write(`broken-${end.length}${end === '\r' ? 'cr' : ''}.podlite`, broken.replace(/\n/g, end))
      expect(linesOf(query('head1', [f]).problems, f)).toEqual([1, 5, 7])
    }
  })

  it('is named when it is included, by the file it is written in', () => {
    const part = write('part.podlite', broken)
    const book = write('book.podlite', '=begin pod\n=head1 Book\n\n=include file:./part.podlite\n=end pod\n')
    const r = query('head1', [book])
    expect(linesOf(r.problems, part)).toEqual([1, 5, 7])
    expect(r.output).toContain('Book')
    expect(r.exitCode).toBe(1)
  })

  it('is named when an include inside an include brings it', () => {
    const part = write('sub/part.podlite', broken)
    write('sub/mid.podlite', '=begin pod\n=include file:./part.podlite\n=end pod\n')
    const book = write('book.podlite', '=begin pod\n=include file:./sub/mid.podlite\n=end pod\n')
    expect(linesOf(query('head1', [book]).problems, part)).toEqual([1, 5, 7])
  })

  it('is named when a selector operand reads it, also when the mask finds no file', () => {
    const voc = write('voc.podlite', broken)
    const doc = write('doc.podlite', '=begin pod\n=para text\n=end pod\n')
    const r = query(`para[ :x(in file:${voc} | head1) ]`, [doc])
    expect(linesOf(r.problems, voc)).toEqual([1, 5, 7])
    expect(r.exitCode).toBe(1)
    const empty = query(`file:${path.join(dir, 'none-*.podlite')} | para[ :x(in file:${voc} | head1) ]`, [])
    expect(linesOf(empty.problems, voc)).toEqual([1, 5, 7])
    expect(empty.exitCode).toBe(1)
  })

  it('is named when the selector names it as its source, alone or by a mask', () => {
    const f = write('broken.podlite', broken)
    expect(linesOf(query(`file:${f} | head1`, []).problems, f)).toEqual([1, 5, 7])
    expect(linesOf(query(`file:${path.join(dir, 'brok*.podlite')} | head1`, []).problems, f)).toEqual([1, 5, 7])
  })

  it('is said once a place when it is read twice, with the path of the first reading', () => {
    const f = write('broken.podlite', broken)
    const relative = path.relative(process.cwd(), f)
    const r = query('head1', [relative], `=begin pod\n=include file:${f}\n=end pod\n`)
    expect(r.problems.filter(p => p.endsWith(UNREAD))).toHaveLength(3)
    expect(linesOf(r.problems, f)).toEqual([1, 5, 7])
  })

  it('is said once a place when an include is read a second time under its settings', () => {
    const part = write('part.podlite', broken)
    const book = write('book.podlite', '=begin pod\n=config head1 :x<1>\n=include file:./part.podlite\n=end pod\n')
    expect(query('head1', [book]).problems.filter(p => p.endsWith(UNREAD))).toHaveLength(3)
    expect(linesOf(query('head1', [book]).problems, part)).toEqual([1, 5, 7])
  })

  it('is told apart from the standard input with the same text, and a link from its target', () => {
    const f = write('broken.podlite', broken)
    const both = query('head1', [f], broken)
    expect(linesOf(both.problems, '<stdin>')).toEqual([1, 5, 7])
    expect(linesOf(both.problems, f)).toEqual([1, 5, 7])
    const link = path.join(dir, 'link.podlite')
    fs.symlinkSync(f, link)
    const linked = query('head1', [f, link])
    expect(linesOf(linked.problems, f)).toEqual([1, 5, 7])
    expect(linesOf(linked.problems, link)).toEqual([1, 5, 7])
  })
})

describe('a document whose directives all read', () => {
  it('gives no line and succeeds', () => {
    const f = write('good.podlite', '=begin pod\n=head1 Fine\n=end pod\n')
    const r = query('head1', [f])
    expect(r.problems).toEqual([])
    expect(r.exitCode).toBe(0)
  })

  it('gives no line for a value, a table or a markup code the parser reports otherwise', () => {
    const value = write('value.podlite', '=begin pod :type<recipe\n=head1 A\n=end pod\n')
    const table = write('table.podlite', '=begin pod\n=begin table\nA | B | C\nx | y\n=end table\n=end pod\n')
    const code = write('code.podlite', '=begin pod\n=head1 A\n\n=para M<x|NoSuchModule>\n=end pod\n')
    for (const f of [value, table, code]) {
      const r = query('head1', [f])
      expect(r.problems).toEqual([])
      expect(r.exitCode).toBe(0)
    }
  })
})

describe('podlite query --quiet', () => {
  it('still prints the lines that could not be read, and fails', () => {
    const f = write('broken.podlite', broken)
    const bin = path.resolve(__dirname, '../bin/podlite.js')
    const run = spawnSync('node', [bin, 'query', 'head1', f, '--quiet'], { encoding: 'utf-8' })
    expect(run.status).toBe(1)
    expect(run.stdout).toContain('=head1 Survivor')
    const lines = run.stderr.split('\n').filter(l => l.endsWith(UNREAD))
    expect(lines.map(l => l.replace(`podlite query: ${f}:`, '').split(':')[0])).toEqual(['1', '5', '7'])
    expect(run.stderr).not.toMatch(/match/)
  })
})
