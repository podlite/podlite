import { podlitePluggable } from '../src/pluggableParser'
import type { ParseDiagnostic } from '../src/types'

const parse = (src: string) => {
  const diagnostics: ParseDiagnostic[] = []
  const p = podlitePluggable()
  const tree = p.parse(src, { podMode: 1, diagnostics })
  return { tree, diagnostics, html: String(p.toHtml(p.toAst(tree))).replace(/\n/g, '') }
}

const abbreviated =
  '=begin table\n=for row :header\n=cell Name\n=cell Value\n\n=row\n=cell one\n=cell two\n=end table\n'
const delimited =
  '=begin table\n=begin row :header\n=cell Name\n=cell Value\n=end row\n=begin row\n=cell one\n=cell two\n=end row\n=end table\n'

describe('cells written under an abbreviated row', () => {
  it('attaches them to the row above', () => {
    const { html } = parse(abbreviated)
    expect(html).toContain('<thead><tr><th><p>Name</p></th><th><p>Value</p></th></tr></thead>')
    expect(html).toContain('<tbody><tr><td><p>one</p></td><td><p>two</p></td></tr></tbody>')
  })

  it('gives the same output as the delimited form', () => {
    expect(parse(abbreviated).html).toEqual(parse(delimited).html)
  })

  it('reports the recovery with a place', () => {
    const { diagnostics } = parse(abbreviated)
    expect(diagnostics.map(d => d.code)).toContain('table-cell-outside-row')
    expect(diagnostics[0].location.start.line).toBe(1)
  })

  it('says nothing about a table written with delimited rows', () => {
    expect(parse(delimited).diagnostics).toEqual([])
  })

  it('opens a row for a cell that has none above it', () => {
    const { html, diagnostics } = parse('=begin table\n=cell alone\n=end table\n')
    expect(html).toContain('<tr><td><p>alone</p></td></tr>')
    expect(diagnostics.map(d => d.code)).toContain('table-cell-outside-row')
  })

  it('leaves a text table alone', () => {
    const { diagnostics } = parse('=begin table\n A | B\n ==|==\n 1 | 2\n=end table\n')
    expect(diagnostics).toEqual([])
  })
})
