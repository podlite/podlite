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

describe('an include that waits for a later pass, under a selection', () => {
  const waiting = (book: string, part: string) => {
    const files = { '/b/book.podlite': book, '/b/part.podlite': part }
    const base = sourcesFromFiles(files)
    const sources = {
      ...base,
      schemes: ['file', 'doc'],
      locate: (path: string, ...rest: any[]) => (path === 'Later' ? undefined : (base.locate as any)(path, ...rest)),
    }
    const errors: IncludeProblem[] = []
    const warnings: IncludeProblem[] = []
    const tree = assembleIncludes(read(book), {
      sources: sources as any,
      context: '/b',
      self: '/b/book.podlite',
      file: '/b/book.podlite',
      parse: read,
      onError: problem => errors.push(problem),
      onWarning: problem => warnings.push(problem),
    })
    return { tree, errors, warnings: warnings.map(w => w.kind) }
  }
  const part = '=head1 Before\n\n=include doc:Later\n\n=head1 After\n'
  const includes = (node: any): number =>
    Array.isArray(node)
      ? node.reduce((n, x) => n + includes(x), 0)
      : (node?.name === 'include' ? 1 : 0) + (Array.isArray(node?.content) ? includes(node.content) : 0)

  it('stays in place under the universal pattern, as when the file is included whole', () => {
    const whole = waiting('=include file:./part.podlite\n', part)
    const all = waiting('=include file:./part.podlite | *\n', part)
    expect([names(whole.tree), names(all.tree), all.warnings, all.errors]).toEqual([
      ['head', 'include', 'head'],
      ['head', 'include', 'head'],
      [],
      [],
    ])
  })

  it('stays in place under a folded heading and under the settings at the directive', () => {
    const folded = waiting(
      '=include file:./part.podlite | *\n',
      '=for head1 :folded\nBefore\n\n=include doc:Later\n\n=head1 After\n',
    )
    const scoped = waiting('=config head1 :numbered\n\n=include file:./part.podlite | *\n', part)
    expect([includes(folded.tree), names(scoped.tree)]).toEqual([1, ['head', 'include', 'head']])
  })

  it('comes once, with the found block that holds it', () => {
    const { tree, warnings } = waiting('=include file:./part.podlite | *\n', '=begin pod\n' + part + '=end pod\n')
    expect([names(tree), includes(tree), warnings]).toEqual([['pod'], 1, []])
  })

  it('keeps waiting when a =set before it makes a copy of it', () => {
    const run = (patterns: string) => {
      const files = {
        '/b/book.podlite': `=include file:./part.podlite | ${patterns}\n`,
        '/b/part.podlite': '=set :caption<Assigned>\n=include file:./inner.podlite\n',
        '/b/inner.podlite': '=include doc:Later\n\n=head1 After\n',
      }
      const base = sourcesFromFiles(files)
      const sources = {
        ...base,
        schemes: ['file', 'doc'],
        locate: (path: string, ...rest: any[]) => (path === 'Later' ? undefined : (base.locate as any)(path, ...rest)),
      }
      const warnings: string[] = []
      const tree = assembleIncludes(read(files['/b/book.podlite']), {
        sources: sources as any,
        context: '/b',
        self: '/b/book.podlite',
        file: '/b/book.podlite',
        parse: read,
        onError: problem => warnings.push(`error ${problem.kind}`),
        onWarning: problem => warnings.push(problem.kind),
      })
      return [includes(tree), warnings]
    }
    expect([run('*'), run('head1')]).toEqual([
      [1, []],
      [0, ['incomplete-selection']],
    ])
  })

  it('is said to leave a selection by other patterns possibly short', () => {
    const cases = ['head1', '*[ :x<1> ]', 'head1, *', 'pod'].map(patterns => {
      const source = patterns === 'pod' ? '=begin pod\n' + part + '=end pod\n' : part
      return waiting(`=include file:./part.podlite | ${patterns}\n`, source).warnings
    })
    expect(cases).toEqual([['incomplete-selection'], ['incomplete-selection'], [], []])
  })
})
