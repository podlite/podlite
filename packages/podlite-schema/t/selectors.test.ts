import { toTree } from '..'
import { parseSelector, runSelector, SelectorDoc } from '../src/selectors'

const makeDoc = (file: string, source: string): SelectorDoc => {
  const tree = toTree().parse(source, { podMode: 1, skipChain: 0 })
  return { file, node: tree as any }
}

describe('parseSelector — pure parsing', () => {
  it('extracts scheme, document, and block filters', () => {
    const r = parseSelector('file:src/foo.podlite | defn, para')
    expect(r).toBeDefined()
    expect(r!.scheme).toBe('file')
    expect(r!.document).toBe('src/foo.podlite')
    expect(r!.blockFilters).toEqual(['defn', 'para'])
  })

  it('returns undefined for empty selector', () => {
    expect(parseSelector('')).toBeUndefined()
    expect(parseSelector('  ')).toBeUndefined()
  })

  it('parses anchor when present', () => {
    const r = parseSelector('doc:File1#anchor1')
    expect(r!.scheme).toBe('doc')
    expect(r!.document).toBe('File1')
    expect(r!.anchor).toBe('anchor1')
  })

  it('parses filter-only selector (leading pipe, no scheme)', () => {
    const r = parseSelector('| head1, head2')
    expect(r!.scheme).toBeUndefined()
    expect(r!.blockFilters).toEqual(['head1', 'head2'])
  })
})

describe('runSelector — corpus filtering via schema', () => {
  it('extracts blocks by name from a file: corpus', () => {
    const src = `
=begin pod
=begin defn :id<a>
First
=end defn
=begin defn :id<b>
Second
=end defn
=para Some prose
=end pod
`
    const docs = [makeDoc('src/terms.podlite', src)]
    const blocks = runSelector('file:src/terms.podlite | defn', docs)
    expect(Array.isArray(blocks)).toBe(true)
    expect(blocks.length).toBe(2)
  })

  it('matches glob patterns in file: scheme', () => {
    const src = `=begin pod\n=defn :id<x>\nT\n=end defn\n=end pod\n`
    const docs = [makeDoc('00-DayByDay/2026/04/term-foo.podlite', src)]
    const blocks = runSelector('file:**/term-*.podlite | defn', docs)
    expect(blocks.length).toBe(1)
  })

  it('returns empty array when no docs match', () => {
    const src = `=begin pod\n=para Text\n=end pod\n`
    const docs = [makeDoc('src/foo.podlite', src)]
    const blocks = runSelector('file:nonexistent.podlite | defn', docs)
    expect(blocks).toEqual([])
  })
})
