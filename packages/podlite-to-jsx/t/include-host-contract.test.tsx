import { Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { podlite } from 'podlite'
import { getTextContentFromNode } from '@podlite/schema'
import { posix } from 'path'

type Files = Record<string, string>
type Call = [string, string | undefined]

const quiet = () => jest.spyOn(console, 'warn').mockImplementation(() => {})

const run = (source: string, files: Files, props: Record<string, any> = {}) => {
  const reads: Call[] = []
  const expands: Call[] = []
  const warn = quiet()
  const html = renderToStaticMarkup(
    <Podlite
      includeReader={(path: string, baseDir?: string) => {
        reads.push([path, baseDir])
        return files[path] ?? null
      }}
      {...props}
      {...(props.expandPaths
        ? {
            expandPaths: (pattern: string, baseDir?: string) => {
              expands.push([pattern, baseDir])
              return props.expandPaths(pattern, baseDir)
            },
          }
        : {})}
    >
      {source}
    </Podlite>,
  )
  const said = warn.mock.calls.map(c => String(c[0]))
  warn.mockRestore()
  return { html: html.replace(/\n/g, ''), reads, expands, said }
}

describe('what the host is asked when a document includes files', () => {
  it('is asked for a file once, however many times it is included', () => {
    const r = run('=pod\n\n=include file:p.podlite\n\n=include file:p.podlite\n', { 'p.podlite': '=head1 Part\n' })
    expect(r.reads.map(call => call[0])).toEqual(['p.podlite'])
  })

  it('is asked to expand a mask, and reads every path it returns', () => {
    const files = { 'a.podlite': '=head1 A\n', 'note.txt': '=head1 Note\n' }
    const r = run('=pod\n\n=include file:*.podlite\n', files, {
      includeBaseDir: '/book',
      expandPaths: () => ['a.podlite', 'note.txt'],
    })
    expect(r.expands).toEqual([['*.podlite', '/book']])
    expect(r.reads.map(call => call[0])).toEqual(['a.podlite', 'note.txt'])
    // a file the mask does not name is read and then left out by the selector
    expect(r.html).not.toContain('Note')
  })

  it('is asked for the mask itself as a path when it gives no way to expand one', () => {
    const r = run('=pod\n\n=include file:*.podlite\n', { '*.podlite': '=head1 Literal\n' })
    expect(r.reads.map(call => call[0])).toEqual(['*.podlite'])
    expect(r.html).toContain('Literal')
  })

  it('is asked to expand a path holding a bracket', () => {
    const r = run(
      '=pod\n\n=include file:p[ab].podlite\n',
      { 'pa.podlite': '=head1 A\n' },
      { expandPaths: () => ['pa.podlite'] },
    )
    expect(r.expands.map(call => call[0])).toEqual(['p[ab].podlite'])
    // the brackets are taken literally by the selector, so the file read is left out
    expect(r.html).not.toContain('<h1')
  })
})

describe('what a reader sees when an include does not come', () => {
  it('sees nothing in place of an include that is not resolved, and one warning', () => {
    const r = run('=pod\n\n=para Before\n\n=include file:absent.podlite\n\n=para After\n', {})
    expect(r.html).not.toContain('absent')
    expect(r.html.replace(/ id="[^"]*"/g, '')).toContain('<p>Before</p></div><div><p>After</p>')
    expect(r.said).toEqual(['[to-jsx] include is not resolved: file:absent.podlite'])
  })

  it('sees a file that includes itself once, and no warning', () => {
    const r = run('=pod\n\n=include file:a.podlite\n', { 'a.podlite': '=head1 A\n\n=include file:a.podlite\n' })
    expect(r.html.match(/<h1/g)?.length).toBe(1)
    expect(r.said).toEqual([])
  })

  it('sees a file of a mask brought in by another file of the same mask as well', () => {
    const files = { 'a.podlite': '=head1 A\n\n=include file:b.podlite\n', 'b.podlite': '=head1 B\n' }
    const r = run('=pod\n\n=include file:*.podlite\n', files, { expandPaths: () => ['a.podlite', 'b.podlite'] })
    expect(r.html.match(/>B</g)?.length).toBe(2)
  })
})

describe('what is said when a =set is lost to an include that failed further in', () => {
  it('is said once, with the include that failed', () => {
    const files = { 'a.podlite': '=include file:absent.podlite\n\n=head1 A\n' }
    const r = run('=pod\n\n=set :id<x>\n=include file:a.podlite\n', files)
    expect(r.said).toEqual(['[to-jsx] include is not resolved: file:absent.podlite; =set assignments not applied: id'])
  })
})

describe('the files a wrapper is told an included block came through', () => {
  const stacksOf = (source: string, files: Files, expandPaths: (pattern: string) => string[]) => {
    const seen: Array<[string, string[] | undefined]> = []
    const wrapElement = (node: any, children: any, ctx: any) => {
      if (node.type === 'block' && node.name === 'head')
        seen.push([String(getTextContentFromNode(node.content)).trim(), ctx?.includeStack])
      return children
    }
    renderToStaticMarkup(
      <Podlite
        includeReader={(path: string) => files[path] ?? null}
        expandPaths={expandPaths}
        wrapElement={wrapElement}
      >
        {source}
      </Podlite>,
    )
    return seen
  }

  it('are those of the mask that brought it, when two masks name the same file', () => {
    const files = { 'aa.podlite': '=head1 AA\n', 'ab.podlite': '=head1 AB\n', 'ba.podlite': '=head1 BA\n' }
    const seen = stacksOf('=pod\n\n=include file:a*.podlite\n\n=include file:*a.podlite\n', files, pattern =>
      pattern === 'a*.podlite' ? ['aa.podlite', 'ab.podlite'] : ['aa.podlite', 'ba.podlite'],
    )
    expect(seen.filter(([text]) => text === 'AA').map(([, stack]) => stack)).toEqual([
      ['aa.podlite', 'ab.podlite'],
      ['aa.podlite', 'ba.podlite'],
    ])
  })
})

describe('an included Markdown file', () => {
  it('is read as Markdown', () => {
    const files: Record<string, string> = { 'notes.md': '# From Markdown\n' }
    const html = renderToStaticMarkup(
      <Podlite includeReader={(path: string) => files[path] ?? null}>{'=pod\n\n=include file:notes.md\n'}</Podlite>,
    )
    expect(html).toContain('From Markdown')
    expect(html).not.toContain('# From Markdown')
  })
})

describe('the files a wrapper is told a block came through, by paths with directories', () => {
  it('are named by the paths the host was asked by', () => {
    const files = {
      'parts/one chapter.podlite': '=pod\n\n=head1 Chapter\n\n=include file:../shared/legal.podlite\n',
      // a path inside an included file is taken from the directory of that file
      'shared/legal.podlite': '=head1 Legal\n',
    }
    const seen: Array<[string, string[] | undefined]> = []
    const wrapElement = (node: any, children: any, ctx: any) => {
      if (node.type === 'block' && node.name === 'head')
        seen.push([String(getTextContentFromNode(node.content)).trim(), ctx?.includeStack])
      return children
    }
    renderToStaticMarkup(
      <Podlite includeReader={(path: string) => files[path] ?? null} wrapElement={wrapElement}>
        {'=pod\n\n=include file:parts/one chapter.podlite\n'}
      </Podlite>,
    )
    expect(seen).toEqual([
      ['Chapter', ['parts/one chapter.podlite']],
      ['Legal', ['parts/one chapter.podlite', 'shared/legal.podlite']],
    ])
  })
})

describe('a host that does not know a file yet', () => {
  const pending = (source: string, props: Record<string, any> = {}) => {
    const warn = quiet()
    const html = renderToStaticMarkup(
      <Podlite includeReader={() => undefined} {...props}>
        {source}
      </Podlite>,
    )
    const said = warn.mock.calls.map(c => String(c[0]))
    warn.mockRestore()
    return { html: html.replace(/\n/g, ''), said }
  }

  it('gets the page without the include, and no warning', () => {
    const r = pending('=pod\n\n=para Before\n\n=set :id<kept>\n=include file:p.podlite\n\n=para After\n')
    expect(r.html).toContain('Before')
    expect(r.html).toContain('After')
    expect(r.html).not.toContain('id="kept"')
    expect(r.said).toEqual([])
  })

  it('gets the page when a mask is not expanded yet', () => {
    const r = pending('=pod\n\n=para Before\n\n=include file:*.podlite\n', { expandPaths: () => undefined })
    expect(r.html).toContain('Before')
    expect(r.said).toEqual([])
  })

  it('hears nothing of a file that is not there while another is not known yet', () => {
    const warn = quiet()
    renderToStaticMarkup(
      <Podlite includeReader={(path: string) => (path === 'absent.podlite' ? null : undefined)}>
        {'=pod\n\n=include file:absent.podlite\n\n=include file:later.podlite\n'}
      </Podlite>,
    )
    const said = warn.mock.calls.map(c => String(c[0]))
    warn.mockRestore()
    expect(said).toEqual([])
  })
})

describe('a document given as a tree', () => {
  it('has its includes resolved as one given as text', () => {
    const p = podlite({ importPlugins: true })
    const tree = p.toAstResult(p.parse('=pod\n\n=include file:p.podlite\n', { podMode: 1 }))
    const warn = quiet()
    const html = renderToStaticMarkup(<Podlite tree={tree} includeReader={() => '=head1 Part\n'} />)
    warn.mockRestore()
    expect(html).toContain('Part')
  })
})

// A host that keeps files by absolute path and finds a path from the base it is
// given, as Podlite Desktop does; a file given as an Error throws it.
type Disk = Record<string, string | Error>
const onDisk = (source: string, files: Disk, props: Record<string, any> = {}) => {
  const reads: Call[] = []
  const expands: Call[] = []
  const seen: Array<[string, string[] | undefined]> = []
  const warn = quiet()
  const html = renderToStaticMarkup(
    <Podlite
      includeBaseDir="/book"
      includeReader={(path: string, baseDir?: string) => {
        reads.push([path, baseDir])
        const file = files[posix.resolve(baseDir ?? '/', path)]
        if (file instanceof Error) throw file
        return file ?? null
      }}
      wrapElement={(node: any, children: any, ctx: any) => {
        if (node.type === 'block' && node.name === 'head')
          seen.push([String(getTextContentFromNode(node.content)).trim(), ctx?.includeStack])
        return children
      }}
      {...props}
      {...(props.expandPaths
        ? {
            expandPaths: (pattern: string, baseDir?: string) => {
              expands.push([pattern, baseDir])
              return props.expandPaths(pattern, baseDir)
            },
          }
        : {})}
    >
      {source}
    </Podlite>,
  )
  const said = warn.mock.calls.map(c => String(c[0]))
  warn.mockRestore()
  const heads = seen.map(([text]) => text)
  return { html, reads: reads.map(call => call[0]), calls: reads, expands, said, seen, heads }
}

const include = (path: string) => `=pod\n\n=include file:${path}\n`
// the same name in another directory says which one was read
const decoys: Disk = { '/book/b.podlite': '=head1 Top\n', '/book/d.podlite': '=head1 Top\n' }

describe('a path written in an included file', () => {
  it('is taken from the directory of that file', () => {
    const r = onDisk(include('sub/a.podlite'), {
      ...decoys,
      '/book/sub/a.podlite': '=include file:b.podlite\n',
      '/book/sub/b.podlite': '=head1 Leaf\n',
    })
    expect(r.calls).toEqual([
      ['sub/a.podlite', '/book'],
      ['sub/b.podlite', '/book'],
    ])
    expect(r.heads).toEqual(['Leaf'])
  })

  it('is taken from the directory of each file on a longer way', () => {
    const r = onDisk(include('sub/a.podlite'), {
      ...decoys,
      '/book/sub/a.podlite': '=include file:deep/c.podlite\n',
      '/book/sub/deep/c.podlite': '=include file:d.podlite\n',
      '/book/sub/deep/d.podlite': '=head1 Leaf\n',
    })
    expect(r.reads).toEqual(['sub/a.podlite', 'sub/deep/c.podlite', 'sub/deep/d.podlite'])
    expect(r.heads).toEqual(['Leaf'])
  })

  it('is asked by its absolute path when it lies outside the base', () => {
    const files = { '/book/sub/a.podlite': '=include file:../../x.podlite\n', '/x.podlite': '=head1 Leaf\n' }
    const r = onDisk(include('sub/a.podlite'), files)
    expect(r.reads).toEqual(['sub/a.podlite', '/x.podlite'])
    expect(r.heads).toEqual(['Leaf'])
  })

  it('is asked by its absolute path in a directory that only starts like the base', () => {
    const files = {
      '/book/sub/a.podlite': '=include file:../../book-other/b.podlite\n',
      '/book-other/b.podlite': '=head1 Leaf\n',
    }
    const r = onDisk(include('sub/a.podlite'), files)
    expect(r.reads).toEqual(['sub/a.podlite', '/book-other/b.podlite'])
    expect(r.heads).toEqual(['Leaf'])
  })

  it('starting with ./ is the same path', () => {
    const r = onDisk(include('./sub/a.podlite'), {
      ...decoys,
      '/book/sub/a.podlite': '=include file:./b.podlite\n',
      '/book/sub/b.podlite': '=head1 Leaf\n',
    })
    expect(r.reads).toEqual(['sub/a.podlite', 'sub/b.podlite'])
    expect(r.seen).toEqual([['Leaf', ['sub/a.podlite', 'sub/b.podlite']]])
  })

  it('is read once when two spellings name one file', () => {
    const r = onDisk('=pod\n\n=include file:sub/../b.podlite\n\n=include file:b.podlite\n', decoys)
    expect(r.reads).toEqual(['b.podlite'])
    expect(r.heads).toEqual(['Top', 'Top'])
  })

  it('is read once when a mask answers with the absolute path of a file already included', () => {
    const r = onDisk('=pod\n\n=include file:b.podlite\n\n=include file:*.podlite\n', decoys, {
      expandPaths: () => ['/book/b.podlite'],
    })
    expect(r.reads).toEqual(['b.podlite'])
    expect(r.heads).toEqual(['Top', 'Top'])
  })

  it('back to the file by its absolute path is a cycle, and its text comes once', () => {
    const r = onDisk(include('sub/a.podlite'), {
      '/book/sub/a.podlite': '=head1 A\n\n=include file:/book/sub/a.podlite\n',
    })
    expect(r.reads).toEqual(['sub/a.podlite'])
    expect(r.heads).toEqual(['A'])
  })

  it('in the operand of a selector is taken from the directory of that file', () => {
    const r = onDisk(include('sub/a.podlite'), {
      '/book/sub/a.podlite': '=include Invoice[:type(in file:voc.podlite | defn)]\n\n=for Invoice :type<invoice>\nx\n',
      '/book/sub/voc.podlite': '=defn invoice\nA bill.\n',
    })
    expect(r.reads).toEqual(['sub/a.podlite', 'sub/voc.podlite'])
  })

  it('that cannot be read is told with the reason the host gave', () => {
    const r = onDisk(include('sub/a.podlite'), {
      '/book/sub/a.podlite': '=include file:b.podlite\n',
      '/book/sub/b.podlite': new Error('denied'),
    })
    expect(r.said).toEqual(['[to-jsx] include target cannot be read: b.podlite: denied'])
  })

  it('written in the document and not read is told with the reason under an absolute base', () => {
    const r = onDisk(include('b.podlite'), { '/book/b.podlite': new Error('denied') })
    expect(r.said).toEqual(['[to-jsx] include target cannot be read: b.podlite: denied'])
  })
})

describe('a mask written in an included file', () => {
  const files: Disk = {
    ...decoys,
    '/book/sub/a.podlite': '',
    '/book/sub/leaf-b.podlite': '=head1 Leaf\n',
  }
  const withMask = (mask: string, answer: string[]) =>
    onDisk(
      include('sub/a.podlite'),
      { ...files, '/book/sub/a.podlite': `=include file:${mask}\n` },
      { expandPaths: () => answer },
    )

  it('is expanded from the directory of that file', () => {
    const r = withMask('leaf*.podlite', ['sub/leaf-b.podlite'])
    expect(r.expands).toEqual([['sub/leaf*.podlite', '/book']])
    expect(r.reads).toEqual(['sub/a.podlite', 'sub/leaf-b.podlite'])
    expect(r.heads).toEqual(['Leaf'])
  })

  it('going up a directory brings the files found there', () => {
    const r = withMask('../*.podlite', ['b.podlite'])
    expect(r.expands.map(call => call[0])).toEqual(['*.podlite'])
    expect(r.heads).toEqual(['Top'])
  })

  it('written absolute brings the files found there', () => {
    const r = withMask('/book/*.podlite', ['b.podlite'])
    expect(r.expands.map(call => call[0])).toEqual(['*.podlite'])
    expect(r.heads).toEqual(['Top'])
  })

  it('with a step back in its fixed part brings the files found', () => {
    const r = withMask('nested/../leaf*.podlite', ['sub/leaf-b.podlite'])
    expect(r.expands.map(call => call[0])).toEqual(['sub/leaf*.podlite'])
    expect(r.heads).toEqual(['Leaf'])
  })

  it('names the file it brought by the path the host was asked by, when the host answers with an absolute path', () => {
    const r = withMask('leaf*.podlite', ['/book/sub/leaf-b.podlite'])
    expect(r.reads).toEqual(['sub/a.podlite', 'sub/leaf-b.podlite'])
    expect(r.seen).toEqual([['Leaf', ['sub/a.podlite', 'sub/leaf-b.podlite']]])
  })

  it('tells the reason for the one file it could not read and brings the other', () => {
    const r = onDisk(
      include('sub/a.podlite'),
      {
        ...files,
        '/book/sub/a.podlite': '=include file:leaf*.podlite\n',
        '/book/sub/leaf-a.podlite': new Error('denied A'),
      },
      { expandPaths: () => ['sub/leaf-a.podlite', 'sub/leaf-b.podlite'] },
    )
    expect(r.said).toEqual(['[to-jsx] include target cannot be read: leaf-a.podlite: denied A'])
    expect(r.heads).toEqual(['Leaf'])
  })
})

describe('a host with no absolute base directory', () => {
  const relative: Files = {
    'sub/a.podlite': '=include file:b.podlite\n',
    'sub/b.podlite': '=head1 Leaf\n',
    'b.podlite': '=head1 Top\n',
  }
  for (const includeBaseDir of [undefined, 'book', 'C:\\book']) {
    it(`is asked by paths from the directory of the document, with base ${includeBaseDir}`, () => {
      const r = run(include('sub/a.podlite'), relative, { includeBaseDir })
      expect(r.reads).toEqual([
        ['sub/a.podlite', includeBaseDir],
        ['sub/b.podlite', includeBaseDir],
      ])
      expect(r.html).toContain('Leaf')
    })
  }

  it('gets the files of a mask that answers with paths from the directory of the document', () => {
    const files = { 'sub/a.podlite': '=include file:../*.podlite\n', 'b.podlite': '=head1 Top\n' }
    const r = run(include('sub/a.podlite'), files, { expandPaths: () => ['b.podlite'] })
    expect(r.expands).toEqual([['*.podlite', undefined]])
    expect(r.html).toContain('Top')
    expect(r.said).toEqual([])
  })

  it('is told once of an absolute answer of a mask it has no way to match', () => {
    const files = { 'sub/a.podlite': '=include file:../*.podlite\n', '/cwd/b.podlite': '=head1 Top\n' }
    const r = run(include('sub/a.podlite'), files, { expandPaths: () => ['/cwd/b.podlite'] })
    expect(r.html).not.toContain('Top')
    expect(r.said).toEqual([
      '[to-jsx] include mask gave a path that cannot be matched without an absolute base directory: /cwd/b.podlite',
    ])
  })
})

describe('a base directory written with a slash at the end or as the root', () => {
  it('asks by the same paths and passes the base as given', () => {
    const files = { '/book/sub/a.podlite': '=include file:b.podlite\n', '/book/sub/b.podlite': '=head1 Leaf\n' }
    expect(onDisk(include('sub/a.podlite'), files, { includeBaseDir: '/book/' }).calls).toEqual([
      ['sub/a.podlite', '/book/'],
      ['sub/b.podlite', '/book/'],
    ])
    const root = onDisk(include('book/sub/a.podlite'), files, { includeBaseDir: '/' })
    expect(root.reads).toEqual(['book/sub/a.podlite', 'book/sub/b.podlite'])
    expect(root.heads).toEqual(['Leaf'])
  })
})
