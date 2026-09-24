import { applyFoldedSections, toTree } from '..'
import { outermost, parseSelector, runSelector, SelectorDoc, SelectorError } from '../src/selectors'
import { getTextContentFromNode } from '..'

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

  it('returns empty array when no docs match a mask', () => {
    const src = `=begin pod\n=para Text\n=end pod\n`
    const docs = [makeDoc('src/foo.podlite', src)]
    expect(runSelector('file:**/none-*.podlite | defn', docs)).toEqual([])
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

  it('contains operator matches a member of a list', () => {
    const src = `=begin pod\n=begin defn :id<s1> :tags<podlite spec reference>\nOne\n=end defn\n=begin defn :id<s2> :tags<axona  design>\nTwo\n=end defn\n=end pod\n`
    const blocks = runSelector('file:./**/*.podlite | *[:tags~<spec>]', [makeDoc('kb/a.podlite', src)]) as any[]
    const ids = blocks.map(b => b.config?.find((c: any) => c.name === 'id')?.value)
    expect(ids).toEqual(['s1'])
  })

  it('contains operator ignores extra whitespace between elements', () => {
    const src = `=begin pod\n=begin defn :id<s2> :tags<axona  design>\nTwo\n=end defn\n=end pod\n`
    const blocks = runSelector('file:./**/*.podlite | *[:tags~<design>]', [makeDoc('kb/a.podlite', src)]) as any[]
    expect(blocks.length).toBe(1)
  })

  it('exact-match operator does not match a member of a list', () => {
    const src = `=begin pod\n=begin defn :id<s1> :tags<podlite spec>\nOne\n=end defn\n=end pod\n`
    const blocks = runSelector('file:./**/*.podlite | *[:tags<spec>]', [makeDoc('kb/a.podlite', src)]) as any[]
    expect(blocks).toEqual([])
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
    const blocks = runSelector('file:./**/*.podlite | defn[:?applies-nfr :applies-nfr~<N004>]', corpus()) as any[]
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

describe('runSelector — =config inheritance', () => {
  const idsOf = (blocks: any[]) => blocks.map(b => b.config?.find((c: any) => c.name === 'id')?.value)

  it('matches a block by an attribute supplied only via =config', () => {
    const src = `
=config pod :level<where>

=begin pod :id<L1> :status<active>
=para body
=end pod
`
    const docs = [makeDoc('x.podlite', src)]
    const blocks = runSelector('file:x.podlite | pod[:level<where>]', docs) as any[]
    expect(idsOf(blocks)).toEqual(['L1'])
  })

  it('applies =config forward only — a block before it does not inherit', () => {
    const src = `
=begin pod :id<before>
=para a
=end pod

=config pod :level<where>

=begin pod :id<after>
=para b
=end pod
`
    const docs = [makeDoc('x.podlite', src)]
    const blocks = runSelector('file:x.podlite | pod[:level<where>]', docs) as any[]
    expect(idsOf(blocks)).toEqual(['after'])
  })

  it('applies a =config inside a block only within that block', () => {
    const src = `
=begin nested
=config pod :level<where>

=begin pod :id<inside>
=para a
=end pod
=end nested

=begin pod :id<after>
=para b
=end pod
`
    const docs = [makeDoc('x.podlite', src)]
    const blocks = runSelector('file:x.podlite | pod[:level<where>]', docs) as any[]
    expect(idsOf(blocks)).toEqual(['inside'])
  })

  it('combines a per-block attribute with a =config default in an AND predicate', () => {
    const src = `
=config pod :level<where>

=begin pod :id<L1> :status<active>
=para a
=end pod

=begin pod :id<L2> :status<draft>
=para b
=end pod
`
    const docs = [makeDoc('x.podlite', src)]
    const blocks = runSelector('file:x.podlite | pod[:level<where> :status<active>]', docs) as any[]
    expect(idsOf(blocks)).toEqual(['L1'])
  })
})

describe('runSelector — blocks written without a marker', () => {
  const count = (selector: string, src: string) => runSelector(selector, [makeDoc('x.podlite', src)]).length

  it('finds a paragraph written without a marker wherever one may stand', () => {
    expect([
      count('para', '=begin pod\nText.\n=end pod\n'),
      count('para', '=begin nested\nText.\n=end nested\n'),
      count('para', '=item Point\n'),
      count('para', 'Text outside any block.\n'),
      count('para', '=SYNOPSIS\nText.\n'),
      count('para', '=begin table\n=begin row\n=begin cell\nCell text.\n=end cell\n=end row\n=end table\n'),
    ]).toEqual([1, 1, 1, 1, 1, 1])
  })

  it('does not take the text of an explicit paragraph, a heading or a term for another paragraph', () => {
    expect([
      count('para', '=para Text\n'),
      count('para', '=head1 Title\n'),
      count('para', '=begin pod\n=head2 Title\nText on the next line.\n=end pod\n'),
      count('para', '=defn Term\nDefinition.\n'),
    ]).toEqual([1, 0, 0, 1])
  })

  it('finds a code block written by indentation, and a delimited one once', () => {
    expect([
      count('code', '=begin nested\n    indented text\n=end nested\n'),
      count('code', '=begin code\nx\n=end code\n'),
    ]).toEqual([1, 1])
  })

  it('finds them with *, which finds any block a name would find', () => {
    const blocks = runSelector('*', [
      makeDoc('x.podlite', 'Text.\n\n=para X\n\n=begin nested\n    indented\n=end nested\n'),
    ]) as any[]
    expect(blocks.map(b => `${b.type}:${b.name}`)).toEqual([
      'para:undefined',
      'block:para',
      'block:nested',
      'code:undefined',
    ])
  })
})

describe('parseSelector — values and operations in parentheses', () => {
  const conditions = (selector: string) => parseSelector(selector)?.patterns[0].predicate

  it('reads a value in parentheses as one condition', () => {
    expect(conditions("| para[ :k('a b') :n(3) ]")).toEqual([
      { attrName: 'k', valueSpec: { kind: 'paren', value: "'a b'" } },
      { attrName: 'n', valueSpec: { kind: 'paren', value: '3' } },
    ])
  })

  it('reads in with its literal operands', () => {
    expect(conditions("| para[ :nums(in 4, 'a') ]")).toEqual([
      { attrName: 'nums', valueSpec: { kind: 'in', value: "4, 'a'" } },
    ])
  })

  it('keeps brackets, bars and whitespace inside a quoted value', () => {
    expect(
      ['para[ :x("a>b") ]', 'para[ :x("a]b") ]', 'para[ :x("a,b") ]', 'para[ :x("a|b") ]', 'para[ :x(1,\t"a b") ]'].map(
        s => conditions(s)?.length,
      ),
    ).toEqual([1, 1, 1, 1, 1])
    expect(parseSelector('file:x.podlite | para[ :x("a|b") ]')?.document).toBe('x.podlite')
  })

  it('reads the forms it read before the same way', () => {
    expect(conditions("para[ :k<it's> ]")).toEqual([{ attrName: 'k', valueSpec: { kind: 'angle', value: "it's" } }])
    expect(
      ["file:notes/john's.podlite | para", 'file:report(2026.podlite | para', 'file:notes/[draft.podlite | para'].map(
        s => parseSelector(s)?.document,
      ),
    ).toEqual(["notes/john's.podlite", 'report(2026.podlite', 'notes/[draft.podlite'])
  })

  it('rejects an operation it does not know, and in without a usable operand', () => {
    const rejected = [
      'para[ :x(in) ]',
      'para[ :x(in ) ]',
      "para[ :x(in '') ]",
      'para[ :x(in <>) ]',
      "para[ :x(in 'a','') ]",
      'para[ :x(in True) ]',
      "para[ :x(eq 'x') ]",
      'para[ :x(draft) ]',
      'para[ :!x(in 1) ]',
      'para[ :x(in http:x) ]',
    ]
    expect(rejected.filter(s => parseSelector(s) !== undefined)).toEqual([])
  })

  it('rejects an empty membership operand', () => {
    expect(parseSelector('para[ :tags~<> ]')).toBeUndefined()
  })
})

describe('runSelector — values and operations in parentheses', () => {
  const ids = (selector: string, src: string) =>
    (runSelector(selector, [makeDoc('x.podlite', src)]) as any[]).map(
      b => b.config?.find((c: any) => c.name === 'id')?.value,
    )

  it('compares a value in parentheses by its kind', () => {
    const src = `=for para :id<a> :k<'a b'> :n(3) :flag
text

=for para :id<b> :k<a b> :n<3>
text
`
    expect([
      ids("| para[ :k('a b') ]", src),
      ids('| para[ :n(3) ]', src),
      ids("| para[ :!k('a b') ]", src),
      ids('| para[ :flag(True) ]', src),
    ]).toEqual([['a'], ['a'], ['b'], ['a']])
  })

  it('holds in when a value of the attribute equals an operand', () => {
    const src = `=for para :id<nums> :nums(1, 2,
= 3, 4)
text

=for para :id<status> :status<issued> :tags<approved secret>
text

=for para :id<hash> :tags{:a<approved>}
text
`
    expect([
      ids('| para[ :nums(in 4) ]', src),
      ids("| para[ :status(in 'draft','issued') ]", src),
      ids("| para[ :tags(in 'approved') ]", src),
      ids('| para[ :tags(in <draft secret>) ]', src),
      ids("| para[ :nums(in '4') ]", src),
      ids("| para[ :missing(in 'x') ]", src),
    ]).toEqual([['nums'], ['status'], ['status'], ['status'], [], []])
  })
})

describe('runSelector — a selector as the operand of in', () => {
  const src = `=defn draft
Not done.

=for para :id<a> :status<draft>
text

=for para :id<b> :status<paid>
text

=begin data :key<statuses> :mime-type('text/csv; header=present')
value,label
draft,Draft
paid,Paid
=end data

=begin data :key<one> :mime-type<text/csv>
paid
=end data

=begin data :key<plain> :mime-type<text/csv>
paid,x
=end data

=begin data :key<picture> :mime-type<image/png>
xx
=end data

=begin data :key<unmarked>
xx
=end data
`
  const vocabulary = makeDoc('vocabulary.podlite', '=defn paid\nMoney in.\n')
  const ids = (selector: string, docs: SelectorDoc[] = [makeDoc('x.podlite', src)], options = {}) =>
    (runSelector(selector, docs, options) as any[]).map(b => b.config?.find((c: any) => c.name === 'id')?.value)
  const failure = (selector: string, docs: SelectorDoc[] = [makeDoc('x.podlite', src)]) => {
    try {
      runSelector(selector, docs)
      return undefined
    } catch (e) {
      return e instanceof SelectorError ? e.kind : 'other'
    }
  }

  it('reads it as a selector, and a literal that is not a number or a string as an error', () => {
    expect(parseSelector('| para[ :status(in draft) ]')?.patterns[0].predicate?.[0].valueSpec).toEqual({
      kind: 'in',
      value: 'draft',
    })
    expect(parseSelector('| para[ :status(in True) ]')).toBeUndefined()
    expect(parseSelector('| para[ :status(in data:x | defn) ]')).toBeUndefined()
  })

  it('takes the terms of the definitions a selector without a source finds', () => {
    expect(ids('| para[ :status(in defn) ]')).toEqual(['a'])
  })

  it('takes a column of a data block by its heading, and the only column without an address', () => {
    expect([ids('| para[ :status(in data:statuses#value) ]'), ids('| para[ :status(in data:one) ]')]).toEqual([
      ['a', 'b'],
      ['b'],
    ])
    expect(ids('| para[ :status(in data:statuses#label) ]')).toEqual([])
  })

  it('reads a file source through the host, or among the documents given', () => {
    const readFile = (document: string) => (document === 'vocabulary.podlite' ? [vocabulary] : undefined)
    expect([
      ids('| para[ :status(in file:vocabulary.podlite | defn) ]', [makeDoc('x.podlite', src)], { readFile }),
      ids('file:x.podlite | para[ :status(in file:vocabulary.podlite | defn) ]', [
        makeDoc('x.podlite', src),
        vocabulary,
      ]),
    ]).toEqual([['b'], ['b']])
  })

  it('tells a source that does not resolve from a format and an address', () => {
    expect([
      failure('| para[ :status(in data:missing) ]'),
      failure('| para[ :status(in file:missing.podlite | defn) ]'),
      failure('| para[ :status(in doc:Missing | defn) ]'),
      failure('| para[ :status(in data:unmarked) ]'),
      failure('| para[ :status(in data:picture#value) ]'),
      failure('| para[ :status(in data:statuses#missing) ]'),
      failure('| para[ :status(in data:one#value) ]'),
      failure('| para[ :status(in data:plain) ]'),
      failure('| para[ :status(in data:statuses) ]'),
    ]).toEqual([
      'resolution',
      'resolution',
      'resolution',
      'format',
      'address',
      'address',
      'address',
      'address',
      'address',
    ])
  })

  it('reads the source before any block reaches the condition', () => {
    expect([
      failure('| nosuch[ :status(in file:missing.podlite | defn) ]'),
      failure('| para[ :status<none> :other(in file:missing.podlite | defn) ]'),
    ]).toEqual(['resolution', 'resolution'])
  })
})

describe('runSelector — an empty or false value', () => {
  const count = (selector: string, declared: string) =>
    runSelector(selector, [makeDoc('x.podlite', `=for para ${declared}\ntext\n`)]).length

  it('tells a value neither empty nor false by its kind', () => {
    expect([
      count('| para[ :h ]', ':h{}'),
      count('| para[ :h ]', ':h{:a<x>}'),
      count('| para[ :n ]', ':n(0)'),
      count('| para[ :d ]', ':d(0.0)'),
      count('| para[ :l ]', ":l('', 'x')"),
      count('| para[ :l ]', ':l<>'),
      count('| para[ :s ]', ":s('')"),
      count('| para[ :t ]', ':t'),
      count('| para[ :f ]', ':f(False)'),
      count('| para[ :z ]', ":z('0')"),
    ]).toEqual([0, 1, 1, 1, 1, 0, 0, 1, 0, 1])
  })

  it('takes only the value false for false', () => {
    expect([
      count('| para[ :!f ]', ':f(False)'),
      count('| para[ :!l ]', ':l(False, True)'),
      count('| para[ :!h ]', ':h{}'),
    ]).toEqual([1, 0, 0])
  })
})

describe('parseSelector — a source written without a scheme', () => {
  it('reads the text before the bar as a file', () => {
    expect([
      parseSelector('x.podlite | para'),
      parseSelector('./x.podlite#intro | para'),
      parseSelector('head1 | para'),
    ]).toEqual([
      { scheme: 'file', document: 'x.podlite', anchor: undefined, patterns: [{ blockType: 'para' }] },
      { scheme: 'file', document: './x.podlite', anchor: 'intro', patterns: [{ blockType: 'para' }] },
      { scheme: 'file', document: 'head1', anchor: undefined, patterns: [{ blockType: 'para' }] },
    ])
  })

  it('reads a selection without a bar, or with nothing before it, as before', () => {
    expect([
      parseSelector('| para'),
      parseSelector('head1, head2'),
      parseSelector('para[ :x("a|b") ]')?.scheme,
    ]).toEqual([
      { patterns: [{ blockType: 'para' }] },
      { patterns: [{ blockType: 'head1' }, { blockType: 'head2' }] },
      undefined,
    ])
  })

  it('selects from the file it names, as file: does', () => {
    const docs = [makeDoc('x.podlite', '=para In x\n'), makeDoc('y.podlite', '=para In y\n')]
    expect([runSelector('x.podlite | para', docs).length, runSelector('file:x.podlite | para', docs).length]).toEqual([
      1, 1,
    ])
  })

  it('reads an operand of in without a scheme from the file it names', () => {
    const src =
      '=defn draft\nNot done.\n\n=for para :id<a> :status<draft>\ntext\n\n=for para :id<b> :status<paid>\ntext\n'
    const vocabulary = makeDoc('vocabulary.podlite', '=defn paid\nMoney in.\n')
    const readFile = (document: string) => (document === 'vocabulary.podlite' ? [vocabulary] : undefined)
    const found = runSelector('| para[ :status(in vocabulary.podlite | defn) ]', [makeDoc('x.podlite', src)], {
      readFile,
    }) as any[]
    expect(found.map(b => b.config.find((c: any) => c.name === 'id').value)).toEqual(['b'])
    expect(() =>
      runSelector('| para[ :status(in none.podlite | defn) ]', [makeDoc('x.podlite', src)], { readFile }),
    ).toThrow(SelectorError)
  })
})

describe('blocks the tree adds around what was written', () => {
  it('are found by no pattern, and the walk goes through them', () => {
    const tree = applyFoldedSections(
      toTree().parse('=for head1 :folded\nFolded\n\nUnder it.\n', { podMode: 1, skipChain: 0 }) as any,
    )
    const doc = { file: 'x.podlite', node: tree as any }
    const names = (selector: string) => (runSelector(selector, [doc]) as any[]).map(b => b.name ?? b.type)
    expect([names('*'), names('root'), names('_folded_section')]).toEqual([['head', 'para'], [], []])
  })
})

describe('outermost', () => {
  const doc = (source: string) => makeDoc('x.podlite', source)

  it('keeps a found block and drops the found blocks it holds', () => {
    const found = runSelector('pod, head1', [doc('=begin pod\n=head1 Inside\n=end pod\n\n=head1 Outside\n')]) as any[]
    expect(found.map(b => b.name)).toEqual(['pod', 'head', 'head'])
    expect(outermost(found).map((b: any) => b.name)).toEqual(['pod', 'head'])
  })

  it('keeps neighbours in the order given', () => {
    const found = runSelector('head1', [doc('=head1 One\n\n=head1 Two\n')]) as any[]
    expect(outermost(found)).toEqual(found)
  })

  it('tells nesting by the tree, not by where the blocks stand in their files', () => {
    const source = '=begin pod\n=head1 Inside\n=end pod\n'
    const found = runSelector('pod', [makeDoc('a.podlite', source), makeDoc('b.podlite', source)]) as any[]
    expect(outermost(found)).toHaveLength(2)
  })

  it('keeps the outer block where a predicate holds for it and for a block inside', () => {
    const found = runSelector('*[ :x<1> ]', [
      doc('=begin pod :x<1>\n=for head1 :x<1>\nInside\n=end pod\n\n=for head1 :x<1>\nOutside\n'),
    ]) as any[]
    expect(outermost(found).map((b: any) => b.name)).toEqual(['pod', 'head'])
  })
})

describe('a pattern of a list item', () => {
  const doc = makeDoc('x.podlite', '=item a\n\n=item1 b\n\n=item2 c\n\n=head1 H\n\n=head2 I\n')
  const found = (selector: string) => (runSelector(selector, [doc]) as any[]).map(b => `${b.name}${b.level}`)

  it('item finds first-level items, as item1 does', () => {
    expect([found('item'), found('item1')]).toEqual([
      ['item1', 'item1'],
      ['item1', 'item1'],
    ])
  })

  it('keeps item2, head and head1 as they were', () => {
    expect([found('item2'), found('head'), found('head1')]).toEqual([['item2'], ['head1', 'head2'], ['head1']])
  })
})

describe('a source or an address that does not resolve', () => {
  const y = makeDoc('y.podlite', '=pod\n\n=for para :id<here>\nIn y.\n\n=head1 Overview\n\nText.\n')
  const kindOf = (selector: string, docs = [y]): string => {
    try {
      return `${(runSelector(selector, docs) as any[]).length} found`
    } catch (e) {
      return e instanceof SelectorError ? e.kind : 'other'
    }
  }

  it('is an error of resolution when no document answers the source', () => {
    expect(
      ['file:x.podlite | para', 'x.podlite | para', 'doc:Nope | para', 'doc:Nope', 'file:x.podlite'].map(s =>
        kindOf(s),
      ),
    ).toEqual(['resolution', 'resolution', 'resolution', 'resolution', 'resolution'])
  })

  it('is an error of address when no answering document holds the address', () => {
    expect([kindOf('file:y.podlite#nope'), kindOf('file:*.md#x')]).toEqual(['address', 'address'])
  })

  it('finds an address the way a link finds its target', () => {
    expect([kindOf('file:y.podlite#here'), kindOf('file:y.podlite#Overview')]).toEqual(['1 found', '1 found'])
  })

  it('takes the first of two blocks sharing an address', () => {
    const dup = makeDoc('d.podlite', '=for para :id<dup>\nFirst.\n\n=for para :id<dup>\nSecond.\n')
    const [block] = runSelector('file:d.podlite#dup', [dup]) as any[]
    expect(getTextContentFromNode(block).trim()).toBe('First.')
  })

  it('is empty, not an error, for a mask that no document answers', () => {
    expect(kindOf('file:*.md | para')).toBe('0 found')
  })

  it('still reads an operand when the mask is empty', () => {
    expect(kindOf('file:*.md | para[ :s(in file:none.podlite | defn) ]')).toBe('resolution')
  })

  it('reports the operand when the source answers', () => {
    expect(kindOf('file:y.podlite | para[ :s(in file:none.podlite | defn) ]')).toBe('resolution')
    expect(kindOf('file:y.podlite | para[ :s(in file:y.podlite#nope) ]')).toBe('address')
  })

  it('leaves an unknown scheme and an unreadable selector empty', () => {
    expect([kindOf('data:k | para'), kindOf('#nope')]).toEqual(['0 found', '0 found'])
  })
})
