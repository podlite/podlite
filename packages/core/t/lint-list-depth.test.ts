import { podlite } from '../src'
import { lintSource } from '../src/lint'

const levels = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `=item${from + i} x${from + i}\n\n`).join('')

describe('a list nested a thousand levels deep', () => {
  const src = levels(1, 1000)

  it('is parsed and written as HTML and Markdown', () => {
    const p = podlite({ importPlugins: true })
    const tree = p.parse(src)
    expect(() => p.toAst(tree)).not.toThrow()
    expect(String(p.toHtml(tree))).toContain('x1000')
    expect(String(p.toMarkdown(tree))).toContain('x1000')
  })

  it('gives one lint warning about its depth, at the first item past the limit', () => {
    const report = lintSource(src, 'x.podlite', {})
    expect(report.violations.map(v => [v.rule, v.severity, v.message, v.location?.start.line])).toEqual([
      ['list-depth', 'warning', 'list item at level 51 is deeper than 50 levels; it is shown at level 50', 101],
    ])
  })

  it('still has a skipped level reported by the rule about the order of levels', () => {
    const rules = lintSource(`${levels(1, 99)}=item101 x\n`, 'x.podlite', {}).violations.map(v => v.rule)
    expect(rules).toContain('item-hierarchy')
    expect(rules).toContain('list-depth')
  })
})
