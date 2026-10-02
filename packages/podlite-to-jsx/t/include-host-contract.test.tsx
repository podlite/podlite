import { Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { podlite } from 'podlite'
import { getTextContentFromNode } from '@podlite/schema'

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
  it('is asked for a nested include by the path as written and the base directory of the document', () => {
    const files = { 'sub/a.podlite': '=include file:b.podlite\n', 'b.podlite': '=head1 Deep\n' }
    const r = run('=pod\n\n=include file:sub/a.podlite\n', files, { includeBaseDir: '/book' })
    expect(r.reads).toEqual([
      ['sub/a.podlite', '/book'],
      ['b.podlite', '/book'],
    ])
    expect(r.html).toContain('Deep')
  })

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

describe('the files a wrapper is told a block came through, by paths with directories', () => {
  it('are named as the directives write them', () => {
    const files = {
      'parts/one chapter.podlite': '=pod\n\n=head1 Chapter\n\n=include file:../shared/legal.podlite\n',
      // the adapter asks for a path as the directive writes it
      '../shared/legal.podlite': '=head1 Legal\n',
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
      ['Legal', ['parts/one chapter.podlite', '../shared/legal.podlite']],
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
