import { getFromTree } from '@podlite/schema'
import { podlite, readerFor } from '../src'
import { assembleIncludes, sourcesFromFiles } from '../src/assemble'
import type { IncludeProblem } from '../src/assemble'

const read = readerFor(podlite({ importPlugins: true }))
const doc = (body: string) => `=begin pod\n${body}\n=end pod\n`

// the document stands at the root of the set: its context is the empty directory
const assembled = (text: string, files: Record<string, string>) => {
  const problems: IncludeProblem[] = []
  const tree = assembleIncludes(read(text, 'input.podlite'), {
    sources: sourcesFromFiles(files),
    context: '',
    file: 'input.podlite',
    self: '/input.podlite',
    parse: read,
    onError: problem => problems.push(problem),
    onWarning: problem => problems.push(problem),
  })
  const paras = getFromTree(tree, 'para').map(para => JSON.stringify(para).match(/"([A-Z][a-z]+) text/)?.[1])
  return { paras: paras.filter(Boolean), problems: problems.map(problem => problem.message) }
}

describe('a set of texts given by path', () => {
  it('finds a path written without a leading slash from its root', () => {
    expect(assembled(doc('=include file:part.podlite'), { 'part.podlite': doc('=para Part text') })).toEqual({
      paras: ['Part'],
      problems: [],
    })
  })

  it('finds a file a file at its root includes', () => {
    const files = { 'part.podlite': doc('=include file:./leaf.podlite'), 'leaf.podlite': doc('=para Leaf text') }
    expect(assembled(doc('=include file:part.podlite'), files)).toEqual({ paras: ['Leaf'], problems: [] })
  })

  it('expands a mask written in a file at its root', () => {
    const files = {
      'book.podlite': doc('=include file:chapters/*.podlite'),
      'chapters/a.podlite': doc('=para One text'),
      'chapters/b.podlite': doc('=para Two text'),
    }
    expect(assembled(doc('=include file:book.podlite'), files)).toEqual({ paras: ['One', 'Two'], problems: [] })
  })

  it('finds the neighbour of a file in a directory', () => {
    const files = { 'chapters/a.podlite': doc('=include file:b.podlite'), 'chapters/b.podlite': doc('=para Near text') }
    expect(assembled(doc('=include file:chapters/a.podlite'), files)).toEqual({ paras: ['Near'], problems: [] })
  })

  it('takes a path with a leading slash for the same place, the later one holding', () => {
    const files = { 'part.podlite': doc('=para First text'), '/part.podlite': doc('=para Second text') }
    const reversed = { '/part.podlite': doc('=para First text'), 'part.podlite': doc('=para Second text') }
    expect(assembled(doc('=include file:part.podlite'), files)).toEqual({ paras: ['Second'], problems: [] })
    expect(assembled(doc('=include file:part.podlite'), reversed)).toEqual({ paras: ['Second'], problems: [] })
  })

  it('matches a mask with a leading slash from the root of the set', () => {
    const files = { '/lib/a.podlite': doc('=para One text'), 'lib/b.podlite': doc('=para Two text') }
    expect(assembled(doc('=include file:/lib/*.podlite'), files)).toEqual({ paras: ['One', 'Two'], problems: [] })
    const nested = { '/lib/a.podlite': '', '/other/lib/b.podlite': '' }
    expect(sourcesFromFiles(nested).locate('/lib/*.podlite', '/lib')?.sources.map(source => source.id)).toEqual([
      '/lib/a.podlite',
    ])
    expect(sourcesFromFiles({ '/lib/a.podlite': '' }).locate('/lib/*.podlite', '')).toEqual({
      masked: true,
      sources: [{ id: '/lib/a.podlite', name: '/lib/a.podlite', context: '/lib' }],
    })
  })

  it('finds a path written with a leading slash from an empty context as before', () => {
    expect(assembled(doc('=include file:part.podlite'), { '/part.podlite': doc('=para Part text') })).toEqual({
      paras: ['Part'],
      problems: [],
    })
  })

  it('names a source by the same identity as before', () => {
    const sources = sourcesFromFiles({ '/lib/part.podlite': '' })
    expect(sources.locate('part.podlite', '/lib')).toEqual({
      masked: false,
      sources: [{ id: '/lib/part.podlite', name: 'part.podlite', context: '/lib' }],
    })
    expect(sourcesFromFiles({ 'part.podlite': '' }).locate('part.podlite', '')?.sources[0].id).toBe('/part.podlite')
  })

  it('keeps a mask in its directory: * does not go down, ** does', () => {
    const files = { 'a.podlite': '', 'notes/b.podlite': '', 'other/notes/c.podlite': '' }
    const ids = (written: string, context = '') =>
      sourcesFromFiles(files)
        .locate(written, context)
        ?.sources.map(source => source.id)
    expect(ids('*.podlite')).toEqual(['/a.podlite'])
    expect(ids('notes/*.podlite')).toEqual(['/notes/b.podlite'])
    expect(ids('**/*.podlite')).toEqual(['/a.podlite', '/notes/b.podlite', '/other/notes/c.podlite'])
    expect(ids('notes/../*.podlite')).toEqual(['/a.podlite'])
    expect(ids('../*.podlite', '/notes')).toEqual(['/a.podlite'])
  })
})

