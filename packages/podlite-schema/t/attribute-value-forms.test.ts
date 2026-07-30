import { podlitePluggable } from '../src/pluggableParser'

const parseToAst = (src: string) => {
  const p = podlitePluggable()
  return p.toAst(p.parse(src, { podMode: 1 }))
}

const findBlock = (node: any, name: string, out: any[] = []): any[] => {
  if (Array.isArray(node)) {
    node.forEach(n => findBlock(n, name, out))
    return out
  }
  if (!node || typeof node !== 'object') return out
  if (node.type === 'block' && node.name === name) out.push(node)
  if (node.content) findBlock(node.content, name, out)
  return out
}

const value = (attrs: string) => {
  const ast = parseToAst(`=for para ${attrs}\ntext\n`)
  const block = findBlock(ast, 'para')[0]
  return (block?.config || []).find((c: any) => c.name === 'k')
}

describe('attribute value forms', () => {
  it('angle brackets without whitespace give a string', () => {
    expect(value(':k<str>')).toMatchObject({ value: 'str', type: 'string' })
  })

  it('whitespace inside angle brackets gives a list', () => {
    expect(value(':k<a b>')).toMatchObject({ value: ['a', 'b'], type: 'array' })
  })

  it('a comma inside angle brackets stays part of the value', () => {
    expect(value(':k<a,b>')).toMatchObject({ value: 'a,b', type: 'string' })
  })

  it('quotes inside angle brackets keep whitespace in one string', () => {
    expect(value(":k<'a b'>")).toMatchObject({ value: 'a b', type: 'string' })
  })

  it('a quoted single word is a string, not a list of one', () => {
    expect(value(":k<'a'>")).toMatchObject({ value: 'a', type: 'string' })
  })

  it('empty quotes inside angle brackets give an empty string', () => {
    expect(value(":k<''>")).toMatchObject({ value: '', type: 'string' })
  })

  it('surrounding whitespace is dropped', () => {
    expect(value(':k< a >')).toMatchObject({ value: 'a', type: 'string' })
  })

  it('digits in angle brackets stay a string', () => {
    expect(value(':k<1>')).toMatchObject({ value: '1', type: 'string' })
  })

  it('square brackets give a list', () => {
    expect(value(':k[a,b]')).toMatchObject({ value: ['a', 'b'], type: 'array' })
  })

  it('square brackets with one element stay a list', () => {
    expect(value(':k[a]')).toMatchObject({ value: ['a'], type: 'array' })
  })

  it('parentheses with commas give a list', () => {
    expect(value(":k('a', 2)")).toMatchObject({ value: ['a', 2], type: 'array' })
  })

  it('parentheses with one element give the element typed by its content', () => {
    expect(value(':k(2)')).toMatchObject({ value: 2, type: 'number' })
    expect(value(":k('str')")).toMatchObject({ value: 'str', type: 'string' })
    expect(value(':k(True)')).toMatchObject({ value: true, type: 'boolean' })
  })
})
