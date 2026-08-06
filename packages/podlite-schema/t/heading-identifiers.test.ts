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
