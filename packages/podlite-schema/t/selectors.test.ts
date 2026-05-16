import { toTree } from '..'
import { parseSelector, runSelector, SelectorDoc } from '../src/selectors'

const makeDoc = (file: string, source: string): SelectorDoc => {
  const tree = toTree().parse(source, { podMode: 1, skipChain: 0 })
  return { file, node: tree as any }
}

describe('parseSelector — source + simple patterns', () => {
  it('extracts scheme, document, and patterns', () => {
    const r = parseSelector('file:src/foo.podlite | defn, para')
    expect(r).toBeDefined()
    expect(r!.scheme).toBe('file')
    expect(r!.document).toBe('src/foo.podlite')
    expect(r!.patterns).toEqual([{ blockType: 'defn' }, { blockType: 'para' }])
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
    expect(r!.patterns).toEqual([{ blockType: 'head1' }, { blockType: 'head2' }])
  })

  it('parses bare pattern-list without leading pipe (CLI shorthand)', () => {
    const r = parseSelector('head1, code[:lang<python>]')
    expect(r!.scheme).toBeUndefined()
    expect(r!.patterns).toEqual([
      { blockType: 'head1' },
      {
        blockType: 'code',
        predicate: [{ attrName: 'lang', valueSpec: { kind: 'angle', value: 'python' } }],
      },
    ])
  })
})

describe('parseSelector — predicate grammar', () => {
  it('parses wildcard with single condition (exact value)', () => {
    const r = parseSelector('file:x | *[:lang<python>]')
    expect(r!.patterns).toEqual([
      {
        blockType: '*',
        predicate: [{ attrName: 'lang', valueSpec: { kind: 'angle', value: 'python' } }],
      },
    ])
  })

  it('parses contains operator', () => {
    const r = parseSelector('file:./**/*.podlite | *[:applies-nfr~<N004>]')
    expect(r!.patterns).toEqual([
      {
        blockType: '*',
        predicate: [{ attrName: 'applies-nfr', valueSpec: { kind: 'contains', value: 'N004' } }],
      },
    ])
  })

  it('parses all four modifier shapes without value-spec', () => {
    const r = parseSelector('| *[:a], *[:!b], *[:?c], *[:!?d]')
    expect(r!.patterns).toEqual([
      { blockType: '*', predicate: [{ attrName: 'a' }] },
      { blockType: '*', predicate: [{ modifier: '!', attrName: 'b' }] },
      { blockType: '*', predicate: [{ modifier: '?', attrName: 'c' }] },
      { blockType: '*', predicate: [{ modifier: '!?', attrName: 'd' }] },
    ])
  })

  it('parses AND of multiple conditions in one predicate', () => {
    const r = parseSelector('| defn[:status<accepted> :type<adr>]')
    expect(r!.patterns).toEqual([
      {
        blockType: 'defn',
        predicate: [
          { attrName: 'status', valueSpec: { kind: 'angle', value: 'accepted' } },
          { attrName: 'type', valueSpec: { kind: 'angle', value: 'adr' } },
        ],
      },
    ])
  })

  it('parses OR of multiple patterns separated by comma', () => {
    const r = parseSelector('| code[:lang<python>], head1')
    expect(r!.patterns).toEqual([
      {
        blockType: 'code',
        predicate: [{ attrName: 'lang', valueSpec: { kind: 'angle', value: 'python' } }],
      },
      { blockType: 'head1' },
    ])
  })

  it('parses negated exact match', () => {
    const r = parseSelector('| para[:!status<done>]')
    expect(r!.patterns![0]!.predicate).toEqual([
      { modifier: '!', attrName: 'status', valueSpec: { kind: 'angle', value: 'done' } },
    ])
  })

  it('handles whitespace around predicate body', () => {
    const r = parseSelector('| defn[ :status<accepted> ]')
    expect(r!.patterns![0]!.predicate).toEqual([
      { attrName: 'status', valueSpec: { kind: 'angle', value: 'accepted' } },
    ])
  })

  it('rejects malformed predicate (missing closing bracket)', () => {
    expect(parseSelector('| *[:lang<python>')).toBeUndefined()
  })

  it('rejects condition without colon prefix', () => {
    expect(parseSelector('| *[lang<python>]')).toBeUndefined()
  })

  it('rejects empty predicate body', () => {
    expect(parseSelector('| *[]')).toBeUndefined()
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

describe('runSelector — predicate filtering', () => {
  const corpus = (): SelectorDoc[] => {
    const f1 = `
=begin pod
=begin defn :id<r1> :applies-nfr<N001 N004 N007>
Rule one
=end defn
=begin defn :id<r2> :applies-nfr<N002>
Rule two
=end defn
=end pod
`
    const f2 = `
=begin pod
=begin defn :id<r3> :applies-nfr<N004>
Rule three
=end defn
=begin defn :id<r4> :status<draft>
Rule four
=end defn
=end pod
`
    return [makeDoc('rules/a.podlite', f1), makeDoc('rules/b.podlite', f2)]
  }

  it('contains operator matches blocks where list attr includes the value', () => {
    const blocks = runSelector('file:./**/*.podlite | *[:applies-nfr~<N004>]', corpus()) as any[]
    const ids = blocks.map(b => {
      const idAttr = b.config?.find((c: any) => c.name === 'id')
      return idAttr?.value
    })
    expect(ids).toEqual(['r1', 'r3'])
  })

  it('exact-match operator', () => {
    const blocks = runSelector('file:./**/*.podlite | defn[:status<draft>]', corpus()) as any[]
    expect(blocks.length).toBe(1)
    const idAttr = blocks[0].config?.find((c: any) => c.name === 'id')
    expect(idAttr?.value).toBe('r4')
  })

  it('non-existence modifier (:!?attr) selects blocks without the attribute', () => {
    const blocks = runSelector('file:./**/*.podlite | defn[:!?applies-nfr]', corpus()) as any[]
    expect(blocks.length).toBe(1)
    const idAttr = blocks[0].config?.find((c: any) => c.name === 'id')
    expect(idAttr?.value).toBe('r4')
  })

  it('existence modifier (:?attr) selects blocks where the attribute is present', () => {
    const blocks = runSelector('file:./**/*.podlite | defn[:?applies-nfr]', corpus()) as any[]
    expect(blocks.length).toBe(3)
  })

  it('AND of conditions within one predicate', () => {
    const blocks = runSelector(
      'file:./**/*.podlite | defn[:?applies-nfr :applies-nfr~<N004>]',
      corpus(),
    ) as any[]
    expect(blocks.length).toBe(2)
  })

  it('OR of patterns via comma', () => {
    const blocks = runSelector(
      'file:./**/*.podlite | defn[:status<draft>], defn[:applies-nfr~<N004>]',
      corpus(),
    ) as any[]
    expect(blocks.length).toBe(3)
  })

  it('wildcard with predicate matches blocks of any type', () => {
    const src = `
=begin pod
=begin code :lang<python>
print(1)
=end code
=begin para :lang<python>
about python
=end para
=para regular
=end pod
`
    const docs = [makeDoc('x.podlite', src)]
    const blocks = runSelector('file:x.podlite | *[:lang<python>]', docs) as any[]
    expect(blocks.length).toBe(2)
  })

  it('negated exact match (:!attr<v>) requires attr to exist and differ', () => {
    const blocks = runSelector('file:./**/*.podlite | defn[:!applies-nfr<N002>]', corpus()) as any[]
    const ids = blocks.map(b => {
      const idAttr = b.config?.find((c: any) => c.name === 'id')
      return idAttr?.value
    })
    expect(ids).toEqual(['r1', 'r3'])
  })

  it('silent miss when attribute is absent (no error)', () => {
    const blocks = runSelector('file:./**/*.podlite | defn[:nonexistent<x>]', corpus()) as any[]
    expect(blocks).toEqual([])
  })
})
