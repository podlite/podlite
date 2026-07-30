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

  it('True and False in angle brackets stay strings', () => {
    expect(value(':k<True>')).toMatchObject({ value: 'True', type: 'string' })
    expect(value(':k<False>')).toMatchObject({ value: 'False', type: 'string' })
  })

  it('square brackets give a list', () => {
    expect(value(':k[a,b]')).toMatchObject({ value: ['a', 'b'], type: 'array' })
  })

  it('square brackets with one element stay a list', () => {
    expect(value(':k[a]')).toMatchObject({ value: ['a'], type: 'array' })
  })

  it('empty parentheses give an empty list', () => {
    expect(value(':k()')).toMatchObject({ value: [], type: 'array' })
  })

  it('empty braces give an empty hash', () => {
    const attr = value(':k{}')
    expect(attr).toMatchObject({ type: 'map' })
    expect(attr.value).toEqual({})
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

describe('options inside braces', () => {
  const mapValue = (attrs: string) => value(attrs)?.value

  it('an option with a value becomes an entry', () => {
    expect(mapValue(':k{:a<x>}')).toEqual({ a: 'x' })
    expect(mapValue(':k{:a(42)}')).toEqual({ a: 42 })
    expect(mapValue(":k{:a('s')}")).toEqual({ a: 's' })
  })

  it('an option with no value is true, a negated one is false', () => {
    expect(mapValue(':k{:a}')).toEqual({ a: true })
    expect(mapValue(':k{:!a}')).toEqual({ a: false })
  })

  it('options and arrow entries mix in one hash', () => {
    expect(mapValue(':k{:a<x>, :b}')).toEqual({ a: 'x', b: true })
    expect(mapValue(':k{a=>1, :b<x>}')).toEqual({ a: 1, b: 'x' })
  })

  it('an arrow entry reads its value as one string, an option reads it as a list', () => {
    expect(mapValue(":k{a=>'x y'}")).toEqual({ a: 'x y' })
    expect(mapValue(':k{:a<x y>}')).toEqual({ a: ['x', 'y'] })
  })

  it('a numeric option key is not a valid key', () => {
    const ast = parseToAst('=for para :k{:1}\ntext\n')
    const block = findBlock(ast, 'para')[0]
    expect(block).toBeDefined()
    expect(block.config).toEqual([])
  })
})

const parseRoot = (attrs: string): any => {
  const p = podlitePluggable()
  return p.parse(`=for para ${attrs}\ntext\n`, { podMode: 1 })
}

describe('a value that cannot be read', () => {
  it('drops its own attribute and keeps the block', () => {
    const ast = parseToAst('=for para :id<one> :k(1_000)\ntext\n')
    const block = findBlock(ast, 'para')[0]
    expect(block).toBeDefined()
    expect(block.config.map((c: any) => c.name)).toEqual(['id'])
  })

  it('reports the position of the dropped value', () => {
    const [first, ...rest] = parseRoot(':k(1_000)').diagnostics
    expect(rest).toEqual([])
    expect(first.severity).toBe('warning')
    expect(first.message).toBe('cannot read the value of :k')
    expect(first.location.start).toMatchObject({ line: 1, column: 13 })
  })

  it('a broken option value drops the whole hash', () => {
    const ast = parseToAst('=for para :k{:a(1_000)}\ntext\n')
    const block = findBlock(ast, 'para')[0]
    expect(block).toBeDefined()
    expect(block.config).toEqual([])
  })

  it('a bare word in parentheses still reads as a string', () => {
    expect(value(':k(spec)')).toMatchObject({ value: 'spec', type: 'string' })
  })

  it('a document without such values carries no diagnostics', () => {
    expect(parseRoot(':k<a b>').diagnostics).toBeUndefined()
  })
})
