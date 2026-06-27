import { podlitePluggable } from '../src/pluggableParser'
import { makeAttrs } from '../src/helpers/config'
import { runSelector } from '../src/selectors'
import { materializeFallback } from '../src/materialize-fallback'

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

describe('materializeFallback', () => {
  it('derives an unknown block to its configured fallback type', () => {
    const ast = parseToAst(
      '=pod\n=config Recipe :fallback<para>\n\n=begin Recipe :id<bread>\nCombine flour.\n=end Recipe\n',
    )
    const view = materializeFallback(ast)
    const derived = findBlock(view, 'para').filter(n => makeAttrs(n).exists('original-name'))
    expect(derived.length).toBe(1)
    expect(makeAttrs(derived[0]).getFirstValue('original-name')).toBe('Recipe')
    expect(makeAttrs(derived[0]).getFirstValue('id')).toBe('bread')
  })

  it('records the full resolution chain in resolved-via', () => {
    const ast = parseToAst('=pod\n=config Recipe :fallback<para>\n\n=begin Recipe\nText.\n=end Recipe\n')
    const view = materializeFallback(ast)
    const derived = findBlock(view, 'para').filter(n => makeAttrs(n).exists('original-name'))[0]
    expect(makeAttrs(derived).getAllValues('resolved-via')).toEqual(['Recipe', 'para'])
  })

  it('honours a per-instance fallback over the configured default', () => {
    const ast = parseToAst(
      '=pod\n=config Recipe :fallback<para>\n\n=begin Recipe :fallback<code>\ncontent\n=end Recipe\n',
    )
    const view = materializeFallback(ast)
    const derived = findBlock(view, 'code').filter(n => makeAttrs(n).exists('original-name'))
    expect(derived.length).toBe(1)
    expect(makeAttrs(derived[0]).getAllValues('resolved-via')).toEqual(['Recipe', 'code'])
  })

  it('resolves a heterogeneous cascade to its endpoint', () => {
    const src =
      '=pod\n=config FancyDiagram :fallback<Sketch>\n=config Sketch :fallback<Outline>\n=config Outline :fallback<para>\n\n=begin FancyDiagram :animation<true>\ngraph TD\n=end FancyDiagram\n'
    const view = materializeFallback(parseToAst(src))
    const derived = findBlock(view, 'para').filter(n => makeAttrs(n).exists('original-name'))[0]
    expect(makeAttrs(derived).getFirstValue('original-name')).toBe('FancyDiagram')
    expect(makeAttrs(derived).getAllValues('resolved-via')).toEqual(['FancyDiagram', 'Sketch', 'Outline', 'para'])
    expect(makeAttrs(derived).getFirstValue('animation')).toBe('true')
  })

  it('leaves a block unchanged when a fallback chain cycles', () => {
    const ast = parseToAst(
      '=pod\n=config Loop :fallback<Ring>\n=config Ring :fallback<Loop>\n\n=begin Loop\nx\n=end Loop\n',
    )
    const view = materializeFallback(ast)
    expect(findBlock(view, 'Loop').length).toBe(1)
    expect(findBlock(view, 'para').filter(n => makeAttrs(n).exists('original-name')).length).toBe(0)
  })

  it('leaves a custom block without a fallback untouched', () => {
    const ast = parseToAst('=pod\n=begin Card\ntext\n=end Card\n')
    const view = materializeFallback(ast)
    expect(findBlock(view, 'Card').length).toBe(1)
  })

  it('does not mutate the source ast', () => {
    const ast = parseToAst('=pod\n=config Recipe :fallback<para>\n\n=begin Recipe\ntext\n=end Recipe\n')
    const before = JSON.stringify(ast)
    materializeFallback(ast)
    expect(JSON.stringify(ast)).toBe(before)
    expect(findBlock(ast, 'Recipe').length).toBe(1)
  })

  it('exposes provenance to selectors on the derived view', () => {
    const ast = parseToAst('=pod\n=config Recipe :fallback<para>\n\n=begin Recipe\ntext\n=end Recipe\n')
    const view = materializeFallback(ast)
    const matched = runSelector('para[:original-name<Recipe>]', [{ file: 'x', node: view }])
    expect(matched.length).toBe(1)
  })
})
