import { toHtml } from '@podlite/schema'
import type { ConfigScope } from '@podlite/schema'
import { podlite } from '../src/index'
import { assembleIncludes, sourcesFromFiles } from '../src/assemble'

const p = podlite({ importPlugins: true })
const read = (source: string, _file?: string, config?: ConfigScope) =>
  p.toAst(p.parse(source, { podMode: 1, config }), { config })

// the entries of each table of contents in the document, in order
const tables = (files: Record<string, string>): string[][] => {
  const tree = assembleIncludes(read(files['/b/book.podlite']), {
    sources: sourcesFromFiles(files),
    context: '/b',
    self: '/b/book.podlite',
    file: '/b/book.podlite',
    text: files['/b/book.podlite'],
    parse: read,
  })
  const html = toHtml({}).run(tree).toString().replace(/\n/g, '')
  return [...html.matchAll(/<div class="toc">(.*?)<\/div>/g)].map(table =>
    [...table[1].matchAll(/<a[^>]*>([^<]*)<\/a>/g)].map(entry => entry[1]),
  )
}

const chapter = '=toc head1, head2\n\n=head1 Chapter\n\n=include file:./leaf.podlite\n'
const leaf = '=head2 Leaf\n'

describe('a table of contents written in an included file', () => {
  it('lists what that file includes', () => {
    const files = {
      '/b/book.podlite': '=head1 Book\n\n=include file:./ch.podlite\n',
      '/b/ch.podlite': chapter,
      '/b/leaf.podlite': leaf,
    }
    expect(tables(files)).toEqual([['Chapter', 'Leaf']])
  })

  it('lists what that file includes when the table alone is brought in', () => {
    const files = {
      '/b/book.podlite': '=head1 Book\n\n=include file:./ch.podlite | toc\n',
      '/b/ch.podlite': chapter,
      '/b/leaf.podlite': leaf,
    }
    expect(tables(files)).toEqual([['Chapter', 'Leaf']])
  })

  it('lists what that file includes when the including file has a =config in effect', () => {
    const files = {
      '/b/book.podlite': '=config para :tag<book>\n\n=include file:./ch.podlite | toc\n',
      '/b/ch.podlite': chapter,
      '/b/leaf.podlite': leaf,
    }
    expect(tables(files)).toEqual([['Chapter', 'Leaf']])
  })

  it('lists what that file includes when a =set stands before the include', () => {
    const files = {
      '/b/book.podlite': '=head1 Book\n\n=set :caption<Contents>\n=include file:./ch.podlite\n',
      '/b/ch.podlite': chapter,
      '/b/leaf.podlite': leaf,
    }
    expect(tables(files)).toEqual([['Chapter', 'Leaf']])
  })

  it('does not list the blocks of the file that includes it', () => {
    const files = {
      '/b/book.podlite': '=head1 Book\n\n=include file:./ch.podlite\n\n=head1 After\n',
      '/b/ch.podlite': chapter,
      '/b/leaf.podlite': leaf,
    }
    expect(tables(files)).toEqual([['Chapter', 'Leaf']])
  })

  it('is built by the =config in effect at each place the file is included', () => {
    const files = {
      '/b/book.podlite':
        '=config head1 :tag<a>\n\n=include file:./ch.podlite\n\n=config head1 :tag<b>\n\n=include file:./ch.podlite\n',
      '/b/ch.podlite': '=toc head1[ :tag<b> ]\n\n=head1 Chapter\n',
    }
    expect(tables(files)).toEqual([[], ['Chapter']])
  })

  it('stays empty, with one warning, when its selector holds a markup code', () => {
    const files = {
      '/b/book.podlite': '=config para :tag<book>\n\n=include file:./ch.podlite\n',
      '/b/ch.podlite': '=toc head1, C<head2>\n\n=head1 Chapter\n\n=include file:./leaf.podlite\n',
      '/b/leaf.podlite': leaf,
    }
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const found = tables(files)
    const said = warn.mock.calls.map(call => String(call[0])).filter(text => text.startsWith('[toc]'))
    warn.mockRestore()
    expect(found).toEqual([[]])
    expect(said.length).toBe(1)
  })
})
