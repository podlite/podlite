import { toHtml } from '@podlite/schema'
import type { ConfigScope } from '@podlite/schema'
import { podlite } from '../src/index'
import { assembleAsync, assembleIncludes, createSourceStore, sourcesFromFiles } from '../src/assemble'
import type { AsyncSources, IncludeProblem, Located, Source } from '../src/assemble'

const p = podlite({ importPlugins: true })
const read = (source: string, _file?: string, config?: ConfigScope) =>
  p.toAst(p.parse(source, { podMode: 1, config }), { config })

const html = (tree: unknown): string => toHtml({}).run(tree).toString().replace(/\n/g, '')

const book = {
  '/book/main.podlite': '=head1 Book\n\n=set :id<chosen>\n=include file:./part/a.podlite\n',
  '/book/part/a.podlite': '=head2 Part\n\n=include file:./leaf.podlite\n',
  '/book/part/leaf.podlite': '=head3 Leaf\n',
}

const assembled = (files: Record<string, string>, main: string, problems: IncludeProblem[] = []) =>
  assembleIncludes(read(files[main]), {
    sources: sourcesFromFiles(files),
    context: main.slice(0, main.lastIndexOf('/')),
    self: main,
    file: main,
    parse: read,
    onError: problem => problems.push(problem),
    onWarning: problem => problems.push(problem),
  })

// sources that answer on a later turn, and what they were asked
const later = (files: Record<string, string>) => {
  const inner = sourcesFromFiles(files)
  const asked: string[] = []
  const sources: AsyncSources = {
    locate: (path, context) =>
      new Promise<Located>(resolve => {
        asked.push(`locate ${String(context)} ${path}`)
        setTimeout(() => resolve(inner.locate(path, context) as Located), 1)
      }),
    read: (source: Source) =>
      new Promise<string | null>(resolve => {
        asked.push(`read ${source.id}`)
        setTimeout(() => resolve(inner.read(source) ?? null), 1)
      }),
  }
  return { sources, asked }
}

const assembledLater = async (files: Record<string, string>, main: string, problems: IncludeProblem[] = []) => {
  const { sources, asked } = later(files)
  const tree = await assembleAsync(read(files[main]), {
    sources,
    context: main.slice(0, main.lastIndexOf('/')),
    self: main,
    file: main,
    parse: read,
    onError: problem => problems.push(problem),
    onWarning: problem => problems.push(problem),
  })
  return { tree, asked }
}

describe('sources kept in memory', () => {
  it('resolve a path against the directory of the file it is written in', () => {
    expect(html(assembled(book, '/book/main.podlite'))).toBe(
      '<h1 id="Book">Book</h1><h2 id="chosen">Part</h2><h3 id="Leaf">Leaf</h3>',
    )
  })

  it('name the files a mask matches in the order of their paths', () => {
    const files = {
      '/b/main.podlite': '=include file:./ch*.podlite\n',
      '/b/ch2.podlite': '=head1 Two\n',
      '/b/ch1.podlite': '=head1 One\n',
      '/b/other.podlite': '=head1 Other\n',
    }
    expect(html(assembled(files, '/b/main.podlite'))).toBe('<h1 id="One">One</h1><h1 id="Two">Two</h1>')
  })

  it('report a file that is not there', () => {
    const problems: IncludeProblem[] = []
    assembled({ '/b/main.podlite': '=include file:./absent.podlite\n' }, '/b/main.podlite', problems)
    expect(problems.map(problem => problem.message)).toEqual(['include target not found: ./absent.podlite'])
  })
})

describe('assembly over sources that answer later', () => {
  it('comes to the same document as sources that answer at once', async () => {
    const { tree } = await assembledLater(book, '/book/main.podlite')
    expect(html(tree)).toBe(html(assembled(book, '/book/main.podlite')))
  })

  it('asks each question once', async () => {
    const { asked } = await assembledLater(book, '/book/main.podlite')
    expect(asked).toEqual([
      'locate /book ./part/a.podlite',
      'read /book/part/a.podlite',
      'locate /book/part ./leaf.podlite',
      'read /book/part/leaf.podlite',
    ])
  })

  it('takes a mask that names two files, and one that names none', async () => {
    const files = {
      '/b/main.podlite': '=include file:./ch*.podlite\n\n=include file:./no*.podlite\n\n=head1 After\n',
      '/b/ch1.podlite': '=head1 One\n',
      '/b/ch2.podlite': '=head1 Two\n',
    }
    const { tree } = await assembledLater(files, '/b/main.podlite')
    expect(html(tree)).toBe(html(assembled(files, '/b/main.podlite')))
    expect(html(tree)).toContain('Two')
  })

  it('reports a source that cannot be had once, by the last assembly alone', async () => {
    const files = { '/b/main.podlite': '=head1 A\n\n=set :id<lost>\n=include file:./absent.podlite\n' }
    const problems: IncludeProblem[] = []
    await assembledLater(files, '/b/main.podlite', problems)
    expect(problems.map(problem => [problem.message, problem.lost])).toEqual([
      ['include target not found: ./absent.podlite; =set assignments not applied: id', ['id']],
    ])
  })

  it('takes a source that fails to answer as one that cannot be had', async () => {
    const problems: IncludeProblem[] = []
    const sources: AsyncSources = {
      locate: (path, context) => sourcesFromFiles({}).locate(path, context) as Located,
      read: () => Promise.reject(new Error('gone')),
    }
    await assembleAsync(read('=include file:./x.podlite\n'), {
      sources,
      context: '/b',
      parse: read,
      onError: problem => problems.push(problem),
    })
    expect(problems.map(problem => problem.kind)).toEqual(['source'])
  })

  it('stops at a file that includes itself', async () => {
    const files = { '/b/main.podlite': '=head1 A\n\n=include file:./main.podlite\n' }
    const { tree } = await assembledLater(files, '/b/main.podlite')
    expect(html(tree)).toBe(html(assembled(files, '/b/main.podlite')))
  })

  it('keeps its answers in a store given to it, and asks nothing the store holds', async () => {
    const store = createSourceStore()
    const first = later(book)
    const opts = { context: '/book', self: '/book/main.podlite', parse: read, store }
    await assembleAsync(read(book['/book/main.podlite']), { ...opts, sources: first.sources })
    const second = later(book)
    await assembleAsync(read(book['/book/main.podlite']), { ...opts, sources: second.sources })
    expect([first.asked.length, second.asked.length]).toEqual([4, 0])
    store.drop('/book/part/leaf.podlite')
    const third = later(book)
    await assembleAsync(read(book['/book/main.podlite']), { ...opts, sources: third.sources })
    expect(third.asked).toEqual(['read /book/part/leaf.podlite'])
  })
})

describe('a plugin that warns while an included file is read', () => {
  const files = {
    '/b/main.podlite': '=config para :tag<x>\n\n=include file:./a.podlite\n',
    '/b/a.podlite': '=toc file:foo\n\n=include file:./b.podlite\n',
    '/b/b.podlite': '=head1 B\n',
  }
  const count = async (work: () => unknown): Promise<number> => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    await work()
    const said = warn.mock.calls.length
    warn.mockRestore()
    return said
  }

  it('is heard once, however many times the file is read', async () => {
    expect(await count(() => assembled(files, '/b/main.podlite'))).toBe(1)
  })

  it('is heard once when the sources answer later', async () => {
    expect(await count(() => assembledLater(files, '/b/main.podlite'))).toBe(1)
  })
})

describe('an include whose source is not known yet', () => {
  it('stays in place with the =set written before it, and nothing is reported', () => {
    const store = createSourceStore()
    const problems: IncludeProblem[] = []
    const tree = assembleIncludes(read('=set :id<kept>\n=include file:./x.podlite\n\n=head1 After\n'), {
      sources: store.sources(),
      context: '/b',
      parse: read,
      onError: problem => problems.push(problem),
      onWarning: problem => problems.push(problem),
    })
    const include = tree.content.find((n: any) => n.name === 'include')
    expect(include.set.map((c: any) => c.name)).toEqual(['id'])
    expect(JSON.stringify(tree.content.find((n: any) => n.name === 'head').config ?? [])).not.toContain('kept')
    expect(problems).toEqual([])
    expect(store.wanted().map(item => item.kind)).toEqual(['locate'])
  })
})
