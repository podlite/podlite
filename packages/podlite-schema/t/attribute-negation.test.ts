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

const parseCode = (attrs: string) => {
  const ast = parseToAst(`=begin code :lang<python> ${attrs}\nx = 1\n=end code\n`)
  return findBlock(ast, 'code')[0]
}

const attr = (block: any, name: string) => (block?.config || []).find((c: any) => c.name === name)

describe('attribute list and negation parsing', () => {
  it('allow list of one code', () => {
    const c = attr(parseCode(':allow<G>'), 'allow')
    expect(c).toMatchObject({ name: 'allow', value: ['G'], type: 'array' })
    expect(c.isFalse).toBeUndefined()
  })

  it('allow list of several codes', () => {
    const c = attr(parseCode(':allow<B R>'), 'allow')
    expect(c.value).toEqual(['B', 'R'])
  })

  it('bang before an allow list keeps the negation flag', () => {
    const c = attr(parseCode(':!allow<G>'), 'allow')
    expect(c).toMatchObject({ name: 'allow', value: ['G'], type: 'array', isFalse: true })
  })

  it('bang before a multi-code allow list keeps the negation flag', () => {
    const c = attr(parseCode(':!allow<G B>'), 'allow')
    expect(c).toMatchObject({ value: ['G', 'B'], type: 'array', isFalse: true })
  })

  it('empty angle list parses without breaking the block', () => {
    const block = parseCode(':allow<>')
    expect(block.name).toBe('code')
    const c = attr(block, 'allow')
    expect(c).toMatchObject({ name: 'allow', value: [], type: 'array' })
    expect(c.isFalse).toBeUndefined()
  })

  it('bang before an empty angle list parses and keeps the negation flag', () => {
    const block = parseCode(':!allow<>')
    expect(block.name).toBe('code')
    const c = attr(block, 'allow')
    expect(c).toMatchObject({ name: 'allow', value: [], type: 'array', isFalse: true })
  })

  it('bang without a list stays boolean false and carries no flag', () => {
    const c = attr(parseCode(':!allow'), 'allow')
    expect(c).toMatchObject({ name: 'allow', value: false, type: 'boolean' })
    expect(c.isFalse).toBeUndefined()
  })

  it('boolean negation of a non-list key is unchanged', () => {
    const c = attr(parseCode(':!nested'), 'nested')
    expect(c).toMatchObject({ name: 'nested', value: false, type: 'boolean' })
    expect(c.isFalse).toBeUndefined()
  })
})
