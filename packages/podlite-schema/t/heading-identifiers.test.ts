import { getSafeNodeId, indexAnchors, resolveFragment, toFragment } from '../src/ast-helpers'
import { podlite } from '../../core/src'

const headingIds = (source: string): (string | undefined)[] => {
  const p = podlite({ importPlugins: true })
  const tree = p.parse(source)
  const ids: (string | undefined)[] = []
  JSON.stringify(tree, (_k, v) => {
    if (v && v.name === 'head' && 'id' in v) ids.push(v.id)
    return v
  })
  return ids
}

const heading = (text: string) => `=begin pod\n\n=head2 ${text}\n\n=end pod\n`

describe('the tree keeps the heading name', () => {
  it('keeps punctuation', () => {
    expect(headingIds(heading('infix //'))).toEqual(['infix //'])
  })

  it('keeps cyrillic as written', () => {
    expect(headingIds(heading('Приветствие Мир'))).toEqual(['Приветствие Мир'])
  })

  it('keeps case and brackets', () => {
    expect(headingIds(heading('Section 1.2 (draft)'))).toEqual(['Section 1.2 (draft)'])
  })

  it('collapses runs of whitespace', () => {
    expect(headingIds(heading('A   B'))).toEqual(['A B'])
  })
})

describe('an output shapes the name into a fragment', () => {
  const cases: Array<[string, string]> = [
    ['infix //', 'infix'],
    ['Приветствие Мир', 'Приветствие-Мир'],
    ['Section 1.2 (draft)', 'Section-12-draft'],
    ['A — B', 'A-B'],
    ['A   B', 'A-B'],
    ['  A  ', 'A'],
    ['A-B', 'A-B'],
    ['A - B', 'A-B'],
    ['1. Введение', '1-Введение'],
    ['///', ''],
  ]

  it.each(cases)('%s becomes %s', (input, expected) => {
    expect(toFragment(input)).toBe(expected)
  })
})

describe('repeated names get numbered', () => {
  it('numbers headings that shape into the same fragment', () => {
    const ctx = {}
    expect(getSafeNodeId({ name: 'head', id: 'infix //' } as any, ctx)).toBe('infix')
    expect(getSafeNodeId({ name: 'head', id: 'infix ^' } as any, ctx)).toBe('infix-2')
    expect(getSafeNodeId({ name: 'head', id: 'infix ///' } as any, ctx)).toBe('infix-3')
  })

  it('numbers plain repeats', () => {
    const ctx = {}
    expect(getSafeNodeId({ name: 'head', id: 'Введение' } as any, ctx)).toBe('Введение')
    expect(getSafeNodeId({ name: 'head', id: 'Введение' } as any, ctx)).toBe('Введение-2')
  })

  it('restarts numbering for another document', () => {
    expect(getSafeNodeId({ name: 'head', id: 'infix //' } as any, {})).toBe('infix')
    expect(getSafeNodeId({ name: 'head', id: 'infix //' } as any, {})).toBe('infix')
  })

  it('leaves non-heading blocks alone', () => {
    const ctx = {}
    expect(getSafeNodeId({ name: 'para', id: 'same' } as any, ctx)).toBe('same')
    expect(getSafeNodeId({ name: 'para', id: 'same' } as any, ctx)).toBe('same')
  })

  it('gives one heading the same anchor however often it is asked for', () => {
    const first = { name: 'head', id: 'infix //' }
    const second = { name: 'head', id: 'infix ^' }
    const ctx = { __anchors: indexAnchors([first, second]) }
    expect(getSafeNodeId(first as any, ctx)).toBe('infix')
    expect(getSafeNodeId(first as any, ctx)).toBe('infix')
    expect(getSafeNodeId(second as any, ctx)).toBe('infix-2')
  })
})

describe('a link target finds its heading', () => {
  const index = indexAnchors([
    { name: 'head', id: 'Приветствие Мир' },
    { name: 'head', id: 'Getting Started' },
    { name: 'head', id: 'infix //' },
    { name: 'head', id: 'infix ^' },
  ])

  it('takes the exact name', () => {
    expect(resolveFragment('Приветствие Мир', index)).toBe('Приветствие-Мир')
  })

  it('takes a name written in another case', () => {
    expect(resolveFragment('приветствие мир', index)).toBe('Приветствие-Мир')
  })

  it('takes a fragment written in another case', () => {
    expect(resolveFragment('getting-started', index)).toBe('Getting-Started')
  })

  it('prefers the exact match over the case-insensitive one', () => {
    const both = indexAnchors([
      { name: 'head', id: 'Sum' },
      { name: 'head', id: 'sum' },
    ])
    expect(resolveFragment('sum', both)).toBe('sum')
    expect(resolveFragment('Sum', both)).toBe('Sum')
  })

  it('shapes a target that matches nothing', () => {
    expect(resolveFragment('nothing here', index)).toBe('nothing-here')
  })

  it('shapes a target when there is no index', () => {
    expect(resolveFragment('nothing here')).toBe('nothing-here')
  })
})

describe('an output writes the shaped anchor', () => {
  const doc = `=begin pod

=head2 Getting Started

=head2 infix //

=head2 infix ^

=head2 Приветствие Мир

L<a|#Getting Started>, L<b|#getting-started>, L<c|#приветствие-мир>, L<d|#nothing here>, L<e|#>, L<f|https://example.com/x#frag>

=end pod
`
  const exported = () => {
    const p = podlite({ importPlugins: true })
    const ast = p.toAst(p.parse(doc))
    return { html: p.toHtml(ast).toString(), md: p.toMarkdown(ast).toString() }
  }

  it('writes a heading anchor without spaces', () => {
    expect(exported().html).toContain('<h2 id="Getting-Started">')
  })

  it('numbers headings that shape into the same anchor', () => {
    const { html } = exported()
    expect(html).toContain('<h2 id="infix">')
    expect(html).toContain('<h2 id="infix-2">')
  })

  it('keeps cyrillic letters in the anchor', () => {
    expect(exported().html).toContain('<h2 id="Приветствие-Мир">')
  })

  it('sends a link to the heading it names', () => {
    const { html, md } = exported()
    expect(html).toContain('<a href="#Getting-Started">a</a>')
    expect(md).toContain('[a](#Getting-Started)')
  })

  it('finds the heading when the target is written in another case', () => {
    const { html, md } = exported()
    expect(html).toContain('<a href="#Getting-Started">b</a>')
    expect(md).toContain('[c](#Приветствие-Мир)')
  })

  it('shapes a target that names no heading', () => {
    expect(exported().html).toContain('<a href="#nothing-here">d</a>')
  })

  it('leaves a bare anchor and an outside address alone', () => {
    const { html, md } = exported()
    expect(html).toContain('<a href="#">e</a>')
    expect(md).toContain('[f](https://example.com/x#frag)')
  })
})
