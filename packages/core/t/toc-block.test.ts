import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { runSelector } from '@podlite/schema'
import { podlite } from '../src/index'
import { resolveIncludes, IncludeOrigin } from '../src/resolve-includes'
import { refreshTocs } from '../src/refresh-tocs'
import { runTests } from '../src/test/run'

const p = podlite({ importPlugins: true })
const toAst = (source: string) => p.toAst(p.parse(source, { podMode: 1 }))
const select = (selector: string, tree: any): any[] =>
  runSelector(selector, [{ file: 'x.podlite', node: tree.content }])

const count = (node: any, match: (n: any) => boolean): number => {
  if (Array.isArray(node)) return node.reduce((sum, n) => sum + count(n, match), 0)
  if (!node || typeof node !== 'object') return 0
  return (match(node) ? 1 : 0) + count(node.content, match)
}
const tocBlocks = (tree: any) => count(tree, n => n.type === 'block' && (n.name === 'toc' || n.name === 'Toc'))
const tables = (tree: any) => count(tree, n => n.type === 'toc')
const entries = (tree: any) => count(tree, n => n.type === 'toc-item')

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-toc-block-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('a table of contents in the built tree', () => {
  it('stays a block of the name it was written with and holds one table', () => {
    const tree = toAst('=pod\n\n=toc head1\n\n=Toc head1\n\n=head1 A\n')
    const blocks = select('toc, Toc', tree)
    expect(blocks.map(b => [b.type, b.name, b.content.map((c: any) => c.type)])).toEqual([
      ['block', 'toc', ['toc']],
      ['block', 'Toc', ['toc']],
    ])
    expect(select('*', tree).map(b => b.name)).toEqual(expect.arrayContaining(['toc', 'Toc']))
  })

  it('keeps the configuration it was written with', () => {
    const tree = toAst('=pod\n\n=for toc :caption<Contents> :folded\nhead1\n\n=head1 A\n')
    expect([select('toc[:caption<Contents>]', tree).length, select('toc[:caption<Other>]', tree).length]).toEqual([
      1, 0,
    ])
  })

  it('is not made again from its own entries when the tree is built twice', () => {
    const tree = toAst('=pod\n\n=toc head1\n\n=head1 A\n\n=head1 B\n')
    const again = p.toAst(tree)
    expect([entries(tree), entries(again), tables(again)]).toEqual([2, 2, 1])
  })

  it('is made again over the includes inside the block that holds it', () => {
    fs.writeFileSync(path.join(dir, 'part.podlite'), '=pod\n\n=head1 Included\n')
    const text = '=pod\n\n=toc head1\n\n=head1 Own\n\n=include file:./part.podlite\n'
    const file = path.join(dir, 'main.podlite')
    const origin = new WeakMap<object, IncludeOrigin>()
    const resolved = resolveIncludes(toAst(text), { baseDir: dir, parse: toAst, file, text, origin })
    const tree = refreshTocs(resolved, p.parse(text, { podMode: 1 }), file, origin)
    expect([tocBlocks(tree), tables(tree), entries(tree)]).toEqual([1, 1, 2])
  })

  it('gives its :id to the html', () => {
    const html = p.toHtml(toAst('=pod\n\n=for toc :id<contents>\nhead1\n\n=head1 A\n\nL<see|#contents>\n')).toString()
    expect(html).toContain('<div class="toc" id="contents">')
    expect(html).toContain('href="#contents"')
  })

  it('is found by an assertion of a test', () => {
    const file = path.join(dir, 'rules.podlite')
    fs.writeFileSync(
      file,
      '=pod\n\n=begin test :id<toc>\n=begin fixture\n=toc head1\n\n=head1 A\n=end fixture\n=for assert\ntoc\n=end test\n',
    )
    const [assert] = runTests({ tests: [{ kind: 'file', path: file }] }).tests[0].asserts
    expect(assert.held).toBe(true)
  })
})
