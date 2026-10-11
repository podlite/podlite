import { makeAttrs, toHtml } from '@podlite/schema'
import type { ConfigScope } from '@podlite/schema'
import { podlite } from '../src/index'
import { assembleIncludes, sourcesFromFiles } from '../src/assemble'
import type { IncludeProblem } from '../src/assemble'

const p = podlite({ importPlugins: true })
const read = (source: string, _file?: string, config?: ConfigScope) =>
  p.toAst(p.parse(source, { podMode: 1, config }), { config })

const assembled = (files: Record<string, string>, main = '/b/book.podlite') => {
  const errors: IncludeProblem[] = []
  const warnings: IncludeProblem[] = []
  const copies: [any, any][] = []
  const tree = assembleIncludes(read(files[main]), {
    sources: sourcesFromFiles(files),
    context: '/b',
    self: main,
    file: main,
    parse: read,
    onError: problem => errors.push(problem),
    onWarning: problem => warnings.push(problem),
    onCopy: (from, to) => copies.push([from, to]),
  })
  return { tree, errors, warnings, copies }
}

// the blocks as they follow one another, the wrappers the tree adds taken off
const blocks = (node: any): any[] => {
  if (Array.isArray(node)) return node.flatMap(blocks)
  if (!node || node.type !== 'block') return []
  return node.name === 'root' || node.name === '_folded_section' ? blocks(node.content) : [node]
}
const names = (tree: any): string[] => blocks(tree).map(b => b.name)
const holds = (node: any, name: string): boolean =>
  Array.isArray(node)
    ? node.some(n => holds(n, name))
    : node?.name === name || (Array.isArray(node?.content) && holds(node.content, name))

const part = '=head1 One\n\n=boundary\n\n=head1 Two\n'

describe('a directive in an included file', () => {
  it('stays behind when it stands outside every block the include brings', () => {
    // (a) whole and with | *: the same blocks, no =boundary
    const whole = assembled({ '/b/book.podlite': '=include file:./a.podlite\n', '/b/a.podlite': part })
    const all = assembled({ '/b/book.podlite': '=include file:./a.podlite | *\n', '/b/a.podlite': part })
    expect([names(whole.tree), names(all.tree), whole.errors, all.errors]).toEqual([
      ['head', 'head'],
      ['head', 'head'],
      [],
      [],
    ])

    // (a') read with the settings in effect at the directive
    const numbered = assembled({
      '/b/book.podlite': '=config head1 :numbered\n\n=include file:./a.podlite\n',
      '/b/a.podlite': part,
    })
    const heads = blocks(numbered.tree).filter(b => b.name === 'head')
    expect([holds(numbered.tree, 'boundary'), heads.map(h => makeAttrs(h).exists('numbered'))]).toEqual([
      false,
      [true, true],
    ])

    // (a'') a wrapper copied without the directive is reported as a copy
    const dropped = whole.copies.filter(
      ([from, to]) => holds(from.content, 'boundary') && !holds(to.content, 'boundary') && from.name === to.name,
    )
    expect(dropped.length).toBeGreaterThan(0)

    // (b) a folded heading: the =boundary sits in the section the tree adds
    const folded = '=for head1 :folded\nOne\n\nText.\n\n=boundary\n\n=head1 Two\n'
    const section = (read(folded) as any).content.find((n: any) => n.name === '_folded_section')
    expect(holds(section?.content, 'boundary')).toBe(true)
    const fromFolded = assembled({ '/b/book.podlite': '=include file:./f.podlite\n', '/b/f.podlite': folded })
    expect(holds(fromFolded.tree, 'boundary')).toBe(false)

    // (c) inside a block written as =pod the =boundary comes with it
    const grouped = assembled({
      '/b/book.podlite': '=include file:./g.podlite\n',
      '/b/g.podlite': '=begin pod\n' + part + '=end pod\n',
    })
    expect(names(grouped.tree)).toEqual(['pod'])
    expect(holds(grouped.tree, 'boundary')).toBe(true)

    // (d) an =include its own assembly could not read stays in that file only
    const files = {
      '/b/book.podlite': '=include file:./d.podlite\n',
      '/b/d.podlite': '=head1 One\n\n=include doc:Some::Module\n\n=head1 Two\n',
    }
    const alone = assembled(files, '/b/d.podlite')
    const outer = assembled(files)
    expect([
      holds(alone.tree, 'include'),
      holds(outer.tree, 'include'),
      names(outer.tree),
      outer.warnings.map(w => w.kind),
      outer.errors,
    ]).toEqual([true, false, ['head', 'head'], ['unsupported-scheme'], []])
  })

  it('keeps an include in the included file that waits for a later pass', () => {
    const files = {
      '/b/book.podlite': '=include file:./part.podlite\n',
      '/b/part.podlite': '=head1 Before\n\n=include doc:Later\n\n=head1 After\n',
    }
    const base = sourcesFromFiles(files)
    const sources = {
      ...base,
      schemes: ['file', 'doc'],
      locate: (path: string, ...rest: any[]) => (path === 'Later' ? undefined : (base.locate as any)(path, ...rest)),
    }
    const errors: IncludeProblem[] = []
    const tree = assembleIncludes(read(files['/b/book.podlite']), {
      sources: sources as any,
      context: '/b',
      self: '/b/book.podlite',
      file: '/b/book.podlite',
      parse: read,
      onError: problem => errors.push(problem),
      onWarning: problem => errors.push(problem),
    })
    expect([names(tree), errors]).toEqual([['head', 'include', 'head'], []])
  })

  it('leaves no <hr> between the parts of a book in html', () => {
    const { tree } = assembled({
      '/b/book.podlite': '=include file:./a.podlite\n\n=include file:./b.podlite\n',
      '/b/a.podlite': part,
      '/b/b.podlite': part.replace('One', 'Three').replace('Two', 'Four'),
    })
    expect(toHtml({}).run(tree).toString()).not.toContain('<hr')
  })
})
