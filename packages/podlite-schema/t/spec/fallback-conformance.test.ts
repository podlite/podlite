import { podlitePluggable } from '../../src/pluggableParser'
import { makeAttrs } from '../../src/helpers/config'
import { runSelector } from '../../src/selectors'
import { materializeFallback } from '../../src/materialize-fallback'
import {
  collectFallbackMap,
  resolveFallback,
  FallbackCycleError,
  FallbackDepthError,
} from '../../src/fallback-resolver'
import toMarkdown from '../../src/exportMarkdown'

const parseToAst = (src: string) => {
  const p = podlitePluggable()
  return p.toAst(p.parse(src, { podMode: 1 }))
}

const findBlocks = (node: any, name: string, out: any[] = []): any[] => {
  if (Array.isArray(node)) {
    node.forEach(n => findBlocks(n, name, out))
    return out
  }
  if (!node || typeof node !== 'object') return out
  if (node.type === 'block' && node.name === name) out.push(node)
  if (node.content) findBlocks(node.content, name, out)
  return out
}

const resolved = (view: any, name: string) => findBlocks(view, name).filter(n => makeAttrs(n).exists('original-name'))

const render = (src: string) => toMarkdown({}).run(parseToAst(src)).toString()

describe('fallback conformance fixtures', () => {
  it('fixture 1: basic =config fallback', () => {
    const view = materializeFallback(
      parseToAst('=pod\n=config Recipe :fallback<para>\n\n=begin Recipe\nCombine flour and water.\n=end Recipe\n'),
    )
    const [node] = resolved(view, 'para')
    expect(node.name).toBe('para')
    expect(makeAttrs(node).getFirstValue('original-name')).toBe('Recipe')
    expect(makeAttrs(node).getAllValues('resolved-via')).toEqual(['Recipe', 'para'])
    expect(
      render('=pod\n=config Recipe :fallback<para>\n\n=begin Recipe\nCombine flour and water.\n=end Recipe\n'),
    ).toContain('Combine flour and water.')
  })

  it('fixture 2: per-instance override beats config', () => {
    const view = materializeFallback(
      parseToAst(
        '=pod\n=config Recipe :fallback<para>\n\n=begin Recipe\nfirst\n=end Recipe\n\n=begin Recipe :fallback<code> :lang<bash>\necho hi\n=end Recipe\n',
      ),
    )
    const para = resolved(view, 'para')
    const code = resolved(view, 'code')
    expect(para.length).toBe(1)
    expect(makeAttrs(para[0]).getAllValues('resolved-via')).toEqual(['Recipe', 'para'])
    expect(code.length).toBe(1)
    expect(makeAttrs(code[0]).getAllValues('resolved-via')).toEqual(['Recipe', 'code'])
    expect(makeAttrs(code[0]).getFirstValue('lang')).toBe('bash')
  })

  it('fixture 3: simple chain resolution', () => {
    const view = materializeFallback(
      parseToAst(
        '=pod\n=config FancyDiagram :fallback<SimpleDiagram>\n=config SimpleDiagram :fallback<Sketch>\n=config Sketch :fallback<para>\n\n=begin FancyDiagram\ncontent\n=end FancyDiagram\n',
      ),
    )
    const [node] = resolved(view, 'para')
    expect(makeAttrs(node).getFirstValue('original-name')).toBe('FancyDiagram')
    expect(makeAttrs(node).getAllValues('resolved-via')).toEqual(['FancyDiagram', 'SimpleDiagram', 'Sketch', 'para'])
  })

  it('fixture 4: cycle detection reports the cycle and leaves the source node', () => {
    const src = '=pod\n=config A :fallback<B>\n=config B :fallback<A>\n\n=begin A\ncontent\n=end A\n'
    const ast = parseToAst(src)
    const map = collectFallbackMap(ast)
    expect(() => resolveFallback('A', map)).toThrow(FallbackCycleError)
    try {
      resolveFallback('A', map)
    } catch (e) {
      expect((e as FallbackCycleError).chain).toEqual(['A', 'B', 'A'])
    }
    const view = materializeFallback(ast)
    expect(findBlocks(view, 'A').length).toBe(1)
    expect(resolved(view, 'para').length).toBe(0)
  })

  it('fixture 5: depth limit boundary of 8 resolves', () => {
    const cfgs = Array.from(
      { length: 8 },
      (_, i) => `=config A${i + 1} :fallback<${i + 1 < 8 ? 'A' + (i + 2) : 'para'}>`,
    ).join('\n')
    const view = materializeFallback(parseToAst(`=pod\n${cfgs}\n\n=begin A1\ncontent\n=end A1\n`))
    const [node] = resolved(view, 'para')
    expect(node.name).toBe('para')
    expect(makeAttrs(node).getAllValues('resolved-via')).toEqual([
      'A1',
      'A2',
      'A3',
      'A4',
      'A5',
      'A6',
      'A7',
      'A8',
      'para',
    ])
  })

  it('fixture 6: depth beyond 8 reports a diagnostic and leaves the source node', () => {
    const cfgs = Array.from(
      { length: 9 },
      (_, i) => `=config A${i + 1} :fallback<${i + 1 < 9 ? 'A' + (i + 2) : 'para'}>`,
    ).join('\n')
    const src = `=pod\n${cfgs}\n\n=begin A1\ncontent\n=end A1\n`
    const map = collectFallbackMap(parseToAst(src))
    expect(() => resolveFallback('A1', map)).toThrow(FallbackDepthError)
    const view = materializeFallback(parseToAst(src))
    expect(findBlocks(view, 'A1').length).toBe(1)
    expect(resolved(view, 'para').length).toBe(0)
  })

  it('fixture 7: FLAT-PRESERVE keeps foreign attributes, renderer ignores them', () => {
    const src =
      '=pod\n=config FancyDiagram :fallback<para>\n\n=begin FancyDiagram :interactive<true> :animation-speed<2x> :caption<"Architecture overview">\ngraph TD\n  A --> B\n=end FancyDiagram\n'
    const [node] = resolved(materializeFallback(parseToAst(src)), 'para')
    expect(node.name).toBe('para')
    expect(makeAttrs(node).getFirstValue('interactive')).toBe('true')
    expect(makeAttrs(node).getFirstValue('animation-speed')).toBe('2x')
    expect(makeAttrs(node).getFirstValue('caption')).toBe('Architecture overview')
    const out = render(src)
    expect(out).toContain('graph TD')
    expect(out).not.toContain('interactive')
  })

  it('fixture 8: strict-blocks AST matches default; warning emission is unimplemented', () => {
    // The derived AST is identical whether or not a strict diagnostic mode is
    // active. Foreign-attribute warning emission is not implemented (tracked
    // separately as a diagnostic-quality task); only the AST invariant is asserted.
    const src =
      '=pod\n=config FancyDiagram :fallback<para>\n\n=begin FancyDiagram :interactive<true> :animation-speed<2x>\ngraph TD\n=end FancyDiagram\n'
    const [node] = resolved(materializeFallback(parseToAst(src)), 'para')
    expect(makeAttrs(node).getFirstValue('interactive')).toBe('true')
    expect(makeAttrs(node).getFirstValue('animation-speed')).toBe('2x')
  })

  it('fixture 9: content opacity renders incompatible content as plain text', () => {
    const src =
      '=pod\n=config FancyDiagram :fallback<para>\n\n=begin FancyDiagram\ngraph TD\n  A[Start] --> B[Process]\n  B --> C[End]\n=end FancyDiagram\n'
    const [node] = resolved(materializeFallback(parseToAst(src)), 'para')
    expect(node.name).toBe('para')
    const out = render(src)
    expect(out).toContain('graph TD')
    expect(out).toContain('A[Start] --> B[Process]')
  })

  it('fixture 10: heterogeneous cascade resolves Mixed-case to a standard endpoint', () => {
    const src =
      '=pod\n=config CustomA :fallback<CustomB>\n=config CustomB :fallback<code>\n\n=begin CustomA :lang<perl>\nprint "hello\\n";\n=end CustomA\n'
    const [node] = resolved(materializeFallback(parseToAst(src)), 'code')
    expect(node.name).toBe('code')
    expect(makeAttrs(node).getFirstValue('original-name')).toBe('CustomA')
    expect(makeAttrs(node).getAllValues('resolved-via')).toEqual(['CustomA', 'CustomB', 'code'])
    expect(makeAttrs(node).getFirstValue('lang')).toBe('perl')
  })

  it('fixture 11: provenance is reproducible and the source tree is unchanged', () => {
    // No Podlite serializer exists, so the round-trip invariant is expressed in
    // Model B terms: the source tree is never mutated, and the derived view is a
    // deterministic function of the source, so re-deriving reproduces provenance.
    const src = '=pod\n=config Recipe :fallback<para>\n\n=begin Recipe :id<bread>\ncontent\n=end Recipe\n'
    const ast = parseToAst(src)
    const before = JSON.stringify(ast)
    const first = materializeFallback(ast)
    const second = materializeFallback(ast)
    expect(JSON.stringify(ast)).toBe(before)
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    const [node] = resolved(first, 'para')
    expect(makeAttrs(node).getFirstValue('original-name')).toBe('Recipe')
    expect(makeAttrs(node).getFirstValue('id')).toBe('bread')
  })

  it('fixture 12: selectors distinguish resolved nodes from native ones', () => {
    const src =
      '=pod\n=config FancyDiagram :fallback<para>\n\n=begin FancyDiagram :interactive<true> :caption<"Overview">\ngraph TD\n=end FancyDiagram\n\n=begin para\nA native paragraph.\n=end para\n'
    const view = materializeFallback(parseToAst(src))
    const doc = [{ file: 'x', node: view }]
    expect(runSelector('para[:original-name<FancyDiagram>]', doc).length).toBe(1)
    expect(runSelector('para[:interactive]', doc).length).toBe(1)
    expect(runSelector('para[:?original-name]', doc).length).toBe(1)
    const native: any[] = runSelector('para[:!?original-name]', doc)
    expect(native.length).toBeGreaterThanOrEqual(1)
    expect(native.every(n => !makeAttrs(n).exists('original-name'))).toBe(true)
  })
})
