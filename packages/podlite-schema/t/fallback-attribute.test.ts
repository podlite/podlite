import { parse, validateAstTree } from '../src'
import { makeAttrs } from '../src/helpers/config'

const findByName = (node: any, name: string, out: any[] = []): any[] => {
  if (Array.isArray(node)) {
    node.forEach(n => findByName(n, name, out))
    return out
  }
  if (!node || typeof node !== 'object') return out
  if (node.name === name) out.push(node)
  if (node.content) findByName(node.content, name, out)
  return out
}

describe('fallback attribute parsing', () => {
  it('captures fallback on a =config node', () => {
    const ast = parse('=pod\n=config Recipe :fallback<para>\n')
    const configs = findByName(ast, 'Recipe').filter((n: any) => n.type === 'config')
    expect(configs.length).toBe(1)
    const attrs = makeAttrs(configs[0])
    expect(attrs.exists('fallback')).toBe(true)
    expect(attrs.getFirstValue('fallback')).toBe('para')
  })

  it('captures fallback per-instance on a block', () => {
    const ast = parse('=pod\n=begin Recipe :fallback<code>\ncontent\n=end Recipe\n')
    const blocks = findByName(ast, 'Recipe').filter((n: any) => n.type === 'block')
    expect(blocks.length).toBe(1)
    const attrs = makeAttrs(blocks[0])
    expect(attrs.getFirstValue('fallback')).toBe('code')
  })

  it('validates a document using fallback on config and block', () => {
    const ast = parse('=pod\n=config Recipe :fallback<para>\n\n=begin Recipe :fallback<code>\ncontent\n=end Recipe\n')
    const errors = validateAstTree(ast).filter((e: any) => JSON.stringify(e).includes('fallback'))
    expect(errors).toEqual([])
  })
})
