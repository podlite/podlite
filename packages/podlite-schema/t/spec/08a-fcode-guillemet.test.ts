import { parse } from '../../src'

function firstFcode(text: string): { name: string; content: unknown } | null {
  const ast = parse(text, { podMode: 1 })
  const para = findBlock(ast, 'para')
  if (!para) return null
  const fcode = (para as { content: unknown[] }).content.find(n => (n as { type?: string }).type === 'fcode') as
    | { name: string; content: unknown }
    | undefined
  return fcode ?? null
}

function findBlock(node: unknown, name: string): unknown {
  if (!node || typeof node !== 'object') return null
  const n = node as { type?: string; name?: string; content?: unknown[] }
  if (n.type === 'block' && n.name === name) return n
  if (n.type === 'para') return n
  if (Array.isArray(n.content)) {
    for (const c of n.content) {
      const found = findBlock(c, name)
      if (found) return found
    }
  }
  if (Array.isArray(node)) {
    for (const c of node) {
      const found = findBlock(c, name)
      if (found) return found
    }
  }
  return null
}

describe('fcode guillemet support', () => {
  it('A«link» parses as code_A', () => {
    const fc = firstFcode('=pod\nA«link»\n')
    expect(fc?.name).toBe('A')
    expect(fc?.content).toBe('link')
  })

  it('V«code» parses as code_V (verbatim)', () => {
    const fc = firstFcode('=pod\nV«raw <text> here»\n')
    expect(fc?.name).toBe('V')
    expect(fc?.content).toBe('raw <text> here')
  })

  it('S«spaced» parses as code_S', () => {
    const fc = firstFcode('=pod\nS«keep spaces»\n')
    expect(fc?.name).toBe('S')
    expect(fc?.content).toBe('keep spaces')
  })

  it('Z«hidden» parses as code_Z', () => {
    const fc = firstFcode('=pod\nZ«comment»\n')
    expect(fc?.name).toBe('Z')
    expect(fc?.content).toBe('comment')
  })

  it('mismatched brackets A«foo> fall back', () => {
    const fc = firstFcode('=pod\nA«foo>\n')
    expect(fc?.name).not.toBe('A')
  })

  it('angle brackets still work: A<link>', () => {
    const fc = firstFcode('=pod\nA<link>\n')
    expect(fc?.name).toBe('A')
    expect(fc?.content).toBe('link')
  })
})
