import { podlitePluggable } from '../src/pluggableParser'

const renderHtml = (src: string): string => {
  const p = podlitePluggable()
  return String(p.toHtml(p.toAst(p.parse(src, { podMode: 1 })))).replace(/\n\s*/g, '')
}

const parseToAst = (src: string) => {
  const p = podlitePluggable()
  return p.toAst(p.parse(src, { podMode: 1 }))
}

const findNestedTable = (node: any, depth = 0): any => {
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findNestedTable(n, depth)
      if (found) return found
    }
    return null
  }
  if (!node || typeof node !== 'object') return null
  const isTable = node.type === 'block' && node.name === 'table'
  if (isTable && depth > 0) return node
  if (node.content) return findNestedTable(node.content, depth + (isTable ? 1 : 0))
  return null
}

describe('table nested inside a cell', () => {
  it('renders a pipe table inside a structured cell as a grid', () => {
    const src = [
      '=begin table',
      '=begin row',
      '=begin cell',
      '=begin table',
      'Month | Revenue',
      'Jan   | 0.7',
      '=end table',
      '=end cell',
      '=end row',
      '=end table',
      '',
    ].join('\n')
    const inner = findNestedTable(parseToAst(src))
    expect(inner).toBeTruthy()
    const rows = (inner.content || []).filter((c: any) => c && c.type === 'block' && c.name === 'row')
    expect(rows.length).toBe(2)
    expect(renderHtml(src)).toContain('<td><table><tr><td>')
  })

  it('keeps a pipe table inside a bare cell working', () => {
    const src = ['=begin cell', '=begin table', 'A | B', '=end table', '=end cell', ''].join('\n')
    expect(renderHtml(src)).toContain('<table><tr><td>')
  })

  it('keeps a structured table inside a structured cell working', () => {
    const src = [
      '=begin table',
      '=begin row',
      '=begin cell',
      '=begin table',
      '=begin row',
      '=begin cell',
      'X',
      '=end cell',
      '=end row',
      '=end table',
      '=end cell',
      '=end row',
      '=end table',
      '',
    ].join('\n')
    expect(renderHtml(src)).toContain('<td><table><tr><td>')
  })

  it('keeps a top-level pipe table unchanged', () => {
    const html = renderHtml('=begin table\nA | B\n1 | 2\n=end table\n')
    expect(html).toContain('<tr><td> A</td><td> B</td></tr>')
  })
})
