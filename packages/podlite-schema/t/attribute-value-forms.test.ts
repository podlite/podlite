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

  it('square brackets are not a value form', () => {
    expect(value(':k[a,b]')).toBeUndefined()
    expect(value(':k[a]')).toBeUndefined()
    expect(value(':k[]')).toBeUndefined()
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
    expect(first.message).toBe('Bare text in parentheses; quote it or use a number')
    expect(first.location.start).toMatchObject({ line: 1, column: 13 })
  })

  it('a broken option value drops the whole hash', () => {
    const ast = parseToAst('=for para :k{:a(1_000)}\ntext\n')
    const block = findBlock(ast, 'para')[0]
    expect(block).toBeDefined()
    expect(block.config).toEqual([])
    const reported = parseRoot(':k{:a(1_000)}').diagnostics
    expect(reported).toHaveLength(1)
    expect(reported[0].message).toBe('Bare text in parentheses; quote it or use a number')
  })

  it('a hash that is not readable at all names the attribute', () => {
    expect(parseRoot(':k{a b}').diagnostics[0].message).toBe('cannot read the value of :k')
  })

  it('a document without such values carries no diagnostics', () => {
    expect(parseRoot(':k<a b>').diagnostics).toBeUndefined()
  })
})

describe('a directive line the parser could not read', () => {
  const parse = (src: string) => podlitePluggable().parse(src, { podMode: 1 }) as any

  it('is reported with its line, and the text stays in the document', () => {
    const root = parse('=begin item text after the name\ninside\n=end item\n')
    const [first] = root.diagnostics
    expect(first.code).toBe('directive-unreadable')
    expect(first.message).toBe('Line looks like a directive but could not be read; it stays as text')
    expect(first.location.start.line).toBe(1)
  })

  it('is told apart from a value that could not be read', () => {
    expect(parse('=for para :k(1_000)\ntext\n').diagnostics[0].code).toBe('value-unreadable')
  })

  it('leaves an ordinary document alone', () => {
    expect(parse('=head1 Title\n\ntext\n').diagnostics).toBeUndefined()
  })
})

describe('a value in bare delimiters', () => {
  it('holds a single word', () => {
    expect(value(":k'str'")).toMatchObject({ value: 'str', type: 'string' })
    expect(value(':k"str"')).toMatchObject({ value: 'str', type: 'string' })
    expect(value(':k｢str｣')).toMatchObject({ value: 'str', type: 'string' })
  })

  it('holds a value with spaces', () => {
    expect(value(":k'str with spaces'")).toMatchObject({ value: 'str with spaces', type: 'string' })
    expect(value(':k"str with spaces"')).toMatchObject({ value: 'str with spaces', type: 'string' })
    expect(value(':k｢str with spaces｣')).toMatchObject({ value: 'str with spaces', type: 'string' })
  })

  it('empty delimiters give an empty string', () => {
    expect(value(":k''")).toMatchObject({ value: '', type: 'string' })
    expect(value(':k""')).toMatchObject({ value: '', type: 'string' })
    expect(value(':k｢｣')).toMatchObject({ value: '', type: 'string' })
  })

  it('negation keeps the value and marks the attribute', () => {
    expect(value(":!k'str'")).toMatchObject({ value: 'str', type: 'string', isFalse: true })
  })

  it('a delimiter left open drops the attribute', () => {
    expect(value(":k'unclosed")).toBeUndefined()
    expect(value(':k｢unclosed')).toBeUndefined()
    expect(parseRoot(":k'unclosed").diagnostics[0].message).toBe(
      'Value is not closed; only a bracketed value may continue on the next configuration line',
    )
  })
})

describe('a value on a continuation line', () => {
  const parseDoc = (src: string) => {
    const p = podlitePluggable()
    const root = p.parse(src, { podMode: 1 }) as any
    const block = findBlock(p.toAst(root), 'para')[0]
    return {
      names: (block?.config || []).map((c: any) => c.name),
      messages: (root.diagnostics || []).map((d: any) => d.message),
    }
  }

  it('carries whole attributes', () => {
    const { names, messages } = parseDoc('=for para :a<1>\n=  :b<2>\ntext\n')
    expect(names).toEqual(['a', 'b'])
    expect(messages).toEqual([])
  })

  it('a bracketed value goes on where the configuration goes on', () => {
    const { names, messages } = parseDoc("=for para :a<1>\n=  :b{\n=    x=>1,\n=    y=>2\n=  }\n=  :c('done')\ntext\n")
    expect(names).toEqual(['a', 'b', 'c'])
    expect(messages).toEqual([])
    expect(value(':b{\n=    x=>1\n=  }')).toBeUndefined()
  })

  it('parentheses and options carry over the same way', () => {
    expect(parseDoc('=for para :b(\n=    1,2\n=  )\ntext\n').names).toEqual(['b'])
    expect(parseDoc('=for para :b{\n=    :x<1>,\n=    :y\n=  }\ntext\n').names).toEqual(['b'])
  })

  it('a quoted value stays on its line', () => {
    const { names, messages } = parseDoc("=for para :a<1>\n=  :b('one\n=   two')\ntext\n")
    expect(names).toEqual(['a'])
    expect(messages[0]).toBe('Value is not closed; only a bracketed value may continue on the next configuration line')
  })

  it('an angle bracket does not swallow the next line', () => {
    const { names, messages } = parseDoc('=for para :a<1>\n=  :b<one\n=   two>\ntext\n')
    expect(names).toEqual(['a'])
    expect(messages[0]).toBe('Value is not closed; only a bracketed value may continue on the next configuration line')
  })

  it('a bracket left open ends where the configuration ends', () => {
    const { names, messages } = parseDoc('=for para :a<1>\n=  :b{\n=    x=>1\ntext\n')
    expect(names).toEqual(['a'])
    expect(messages[0]).toBe('Value is not closed; only a bracketed value may continue on the next configuration line')
  })

  it('a bracket left open does not eat the closing marker of the block', () => {
    const ast = parseToAst('=begin pod\n=for para :a<1>\n=  :b{\n=end pod\n')
    expect(findBlock(ast, 'pod')[0]).toBeDefined()
    expect(findBlock(ast, 'para')[0].config.map((c: any) => c.name)).toEqual(['a'])
  })
})

describe('value forms the norm does not have', () => {
  const messageFor = (attrs: string) => parseRoot(attrs).diagnostics?.[0]?.message

  it('bare text in parentheses is rejected', () => {
    expect(value(':k(spec)')).toBeUndefined()
    expect(value(':k(text/csv)')).toBeUndefined()
    expect(messageFor(':k(spec)')).toBe('Bare text in parentheses; quote it or use a number')
  })

  it('a Q-quoted string is bare text too', () => {
    expect(value(':k(Q[str])')).toBeUndefined()
    expect(messageFor(':k(Q[str])')).toBe('Bare text in parentheses; quote it or use a number')
  })

  it('square brackets are rejected with their own message', () => {
    expect(messageFor(':k[a,b]')).toBe(
      'Square brackets are not an attribute value form; write a list with angle brackets or parentheses',
    )
  })

  it('numbers, quoted strings and their lists are untouched', () => {
    expect(value(':k(42)')).toMatchObject({ value: 42, type: 'number' })
    expect(value(':k(2,3)')).toMatchObject({ value: [2, 3], type: 'array' })
    expect(value(":k('a','b')")).toMatchObject({ value: ['a', 'b'], type: 'array' })
    expect(value(':k(True)')).toMatchObject({ value: true, type: 'boolean' })
  })

  it('a nested set is left as written', () => {
    expect(value(':k(:align<right>)')).toMatchObject({ value: ':align<right>', type: 'string' })
  })
})
