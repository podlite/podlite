import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { getTextContentFromNode, runSelector } from '@podlite/schema'
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

// the entries of each table of contents in the tree, in order
const labels = (tree: any): string[][] => {
  const tables: any[] = []
  const find = (n: any): void => {
    if (Array.isArray(n)) return n.forEach(find)
    if (!n || typeof n !== 'object') return
    if (n.type === 'toc') tables.push(n)
    find(n.content)
  }
  find(tree)
  return tables.map(table => {
    const out: string[] = []
    const walk = (n: any): void => {
      if (Array.isArray(n)) return n.forEach(walk)
      if (!n || typeof n !== 'object') return
      if (n.type === 'toc-item') out.push(String(getTextContentFromNode(n)).trim())
      walk(n.content)
    }
    walk(table.content)
    return out
  })
}

describe('the selector of a table of contents', () => {
  let warnings: string[]
  let spy: jest.SpyInstance
  beforeEach(() => {
    warnings = []
    spy = jest.spyOn(console, 'warn').mockImplementation((m: string) => void warnings.push(String(m)))
  })
  afterEach(() => spy.mockRestore())

  const marked = '\n\n=for head1 :x<1>\nMarked\n\n=head1 Plain\n'

  it('applies a predicate', () => {
    expect(labels(toAst('=toc head1[ :x<1> ]' + marked))).toEqual([['Marked']])
  })

  it('applies a predicate with *, and leaves out the table itself', () => {
    expect(labels(toAst('=for toc :x<1>\n*[ :x<1> ]' + marked))).toEqual([['Marked']])
  })

  it('reads the first line that holds more than whitespace', () => {
    const doc = '\n\n=head1 A\n\n=head2 B\n'
    expect([
      labels(toAst('=for toc :caption<X>\nhead1,\n  head2' + doc)),
      labels(toAst('=begin toc\n   \nhead1\njunk\n=end toc' + doc)),
    ]).toEqual([[['A']], [['A']]])
  })

  it('lists the other tables of contents it finds', () => {
    const tree = toAst('=toc toc\n\n=for toc :caption<Index>\nhead1\n\n=for toc :caption<Other>\nhead2\n')
    expect(labels(tree)[0]).toEqual(['Index', 'Other'])
  })

  it('titles a paragraph written without a marker by its text, and lists no comment or data', () => {
    const tree = toAst('=toc *\n\n=head1 H\n\nText.\n\n=comment Hidden note\n\n=for data :key<k>\nx,y\n')
    expect(labels(tree)[0]).toEqual(['H', 'Text.'])
  })

  it('lists a comment it names', () => {
    expect(labels(toAst('=toc comment\n\n=comment Named note\n'))[0]).toEqual(['Named note'])
  })

  it('lists the pods around it with *, their text as the entry', () => {
    const tree = toAst('=begin pod\n=toc *\n=head1 H\n\nText.\n=end pod\n')
    expect(labels(tree)[0].slice(1)).toEqual(['H', 'Text.'])
  })

  it('places a semantic block as a first-level heading', () => {
    const tree = toAst('=toc TITLE, FOO, head1\n\n=TITLE Title\n\n=begin FOO\nFoo\n=end FOO\n\n=head1 H\n')
    expect(labels(tree)).toEqual([['Title', 'Foo', 'H']])
    expect(() => toAst('=toc *\n\n=for TITLE :x<1>\nTitle\n')).not.toThrow()
  })

  it('makes no entries of a selector it cannot read, and says so', () => {
    const cases = ['head1[', 'head1 head2', 'head1 head2,']
    expect(cases.map(selector => labels(toAst(`=toc ${selector}\n\n=head1 A\n\n=head2 B\n`)))).toEqual([
      [[]],
      [[]],
      [[]],
    ])
    expect(warnings.filter(w => w.includes('cannot be read'))).toHaveLength(3)
  })

  it('lists no blocks of another file, and says so', () => {
    const tree = (selector: string) => labels(toAst(`=toc ${selector}\n\n=head1 A\n`))
    expect([tree('file:other.podlite | head1'), tree('other.podlite | head1')]).toEqual([[[]], [[]]])
    expect(warnings.filter(w => w.includes('its own document'))).toHaveLength(2)
  })

  it('reads no file for an operand of in, and says so', () => {
    const doc =
      '\n\n=for head1 :status<paid>\nA\n\n=defn paid\nMoney in.\n\n=begin data :key<statuses>\npaid\n=end data\n'
    const found = (selector: string) => labels(toAst(`=toc ${selector}${doc}`))[0]
    expect([
      found('head1[ :status(in file:vocab.podlite | defn) ]'),
      found('head1[ :status(in defn[ :x(in file:vocab.podlite | defn) ]) ]'),
    ]).toEqual([[], []])
    expect(warnings.filter(w => w.includes('reads no file'))).toHaveLength(2)
    warnings.length = 0
    expect([found('head1[ :status(in defn) ]'), found('head1[ :status(in <file:vocab.podlite>) ]')]).toEqual([
      ['A'],
      [],
    ])
    expect(warnings).toEqual([])
  })

  it('reaches a folded heading and a heading of a Markdown section', () => {
    const tree = toAst(
      '=toc head1\n\n=for head1 :folded :x<1>\nFolded\n\nUnder.\n\n=begin markdown\n# Md\n=end markdown\n',
    )
    expect(labels(tree)[0]).toEqual(['Folded', 'Md'])
    expect(labels(toAst('=toc head1[ :x<1> ]\n\n=for head1 :folded :x<1>\nFolded\n\nUnder.\n'))[0]).toEqual(['Folded'])
  })

  const assembled = (main: string, part: string) => {
    fs.writeFileSync(path.join(dir, 'part.podlite'), part)
    const file = path.join(dir, 'main.podlite')
    const origin = new WeakMap<object, IncludeOrigin>()
    const resolved = resolveIncludes(toAst(main), { baseDir: dir, parse: toAst, file, text: main, origin })
    return refreshTocs(resolved, p.parse(main, { podMode: 1 }), file, origin)
  }

  it('applies a predicate to the blocks an include brings when made again', () => {
    const tree = assembled(
      '=toc head1[ :x<1> ]\n\n=head1 Own\n\n=include file:./part.podlite\n',
      '=for head1 :x<1>\nIncluded\n',
    )
    expect(labels(tree)[0]).toEqual(['Included'])
  })

  it('leaves out only itself when made again, not a table of an included file at the same place', () => {
    const tree = assembled('=toc *\n\n=head1 Own\n\n=include file:./part.podlite\n', '=toc *\n\n=head1 Included\n')
    const [main] = labels(tree)
    expect(main).toEqual(expect.arrayContaining(['Own', 'Included']))
    expect(main).toHaveLength(3)
  })

  it('says twice that a selector cannot be read when the table is made again', () => {
    assembled('=toc head1[\n\n=head1 Own\n\n=include file:./part.podlite\n', '=head1 Included\n')
    expect(warnings.filter(w => w.includes('cannot be read'))).toHaveLength(2)
  })
})
