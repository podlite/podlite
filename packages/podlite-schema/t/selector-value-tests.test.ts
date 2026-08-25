import { parse, runSelector } from '../src'

const corpus = [
  '=for item :id<T-1> :tags<approved reviewed>',
  'a list, the wanted word first',
  '',
  '=for item :id<T-2> :tags<reviewed approved>',
  'the same list, the wanted word second',
  '',
  '=for item :id<T-3> :tags<approved>',
  'one word, therefore a string',
  '',
  "=for para :id<P-1> :caption('Table of contents')",
  'a quoted string',
  '',
  '=for para :id<P-2> :count(42)',
  'a number',
  '',
  '=for para :id<P-3> :empty<>',
  'an empty list',
  '',
].join('\n')

const ids = (selector: string): string[] => {
  const node = { type: 'block', name: 'root', margin: '', content: parse(corpus, { podMode: 1 }) } as never
  const found = runSelector(selector, [{ file: 'corpus.podlite', node }]) as Array<{
    config?: Array<{ name?: string; value?: unknown }>
  }>
  return found.map(n => String((n.config || []).find(c => c.name === 'id')?.value ?? '?'))
}

describe('equality over a value held as a list', () => {
  it('does not hold for a single word against a list', () => {
    expect(ids('item[ :tags<approved> ]')).toEqual(['T-3'])
  })

  it('gives the same answer whatever the order inside the list', () => {
    expect(ids('item[ :tags<reviewed> ]')).toEqual([])
  })

  it('holds when both sides are the same list in the same order', () => {
    expect(ids('item[ :tags<approved reviewed> ]')).toEqual(['T-1'])
  })

  it('does not hold when the same elements stand in another order', () => {
    expect(ids('item[ :tags<reviewed reviewed> ]')).toEqual([])
  })
})

describe('membership among the values', () => {
  it('finds the word wherever it stands in the list', () => {
    expect(ids('item[ :tags~<approved> ]')).toEqual(['T-1', 'T-2', 'T-3'])
  })

  it('asks for every element the operand names', () => {
    expect(ids('item[ :tags~<approved reviewed> ]')).toEqual(['T-1', 'T-2'])
  })

  it('does not take a word out of the middle of a quoted string', () => {
    expect(ids("para[ :caption~<'Table'> ]")).toEqual([])
    expect(ids('para[ :caption~<Table> ]')).toEqual([])
  })
})

describe('the operand is read by the grammar of a declaration', () => {
  it('reaches a value declared as a quoted string', () => {
    expect(ids("para[ :caption<'Table of contents'> ]")).toEqual(['P-1'])
  })

  it('tells a list apart from a string of the same words', () => {
    expect(ids('para[ :caption<Table of contents> ]')).toEqual([])
  })

  it('tells a number apart from the text of it', () => {
    expect(ids('para[ :count<42> ]')).toEqual([])
  })

  it('reaches an empty list declared with nothing inside', () => {
    expect(ids('para[ :empty<> ]')).toEqual(['P-3'])
  })
})

describe('negation follows the same reading', () => {
  it('holds where equality does not, for a block carrying the attribute', () => {
    expect(ids('item[ :!tags<approved> ]')).toEqual(['T-1', 'T-2'])
  })

  it('holds where membership does not', () => {
    expect(ids('para[ :!caption~<Table> ]')).toEqual(['P-1'])
  })
})
