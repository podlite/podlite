import { podlitePluggable } from '../src/pluggableParser'

const md = (src: string): string => {
  const p = podlitePluggable()
  return String(p.toMarkdown(p.toAst(p.parse(src, { podMode: 1 }))))
}

const structured =
  '=begin table\n=begin row :header\n=cell Name\n=cell Value\n=end row\n=begin row\n=cell one\n=cell two\n=end row\n=end table\n'
const text = '=begin table\n A | B\n ==|==\n 1 | C<code>\n=end table\n'

describe('table cells in markdown', () => {
  it('keeps a row on one line when cells hold blocks', () => {
    expect(md(structured)).toContain('| Name | Value |')
    expect(md(structured)).toContain('| one | two |')
  })

  it('leaves a text table as it was', () => {
    expect(md(text)).toContain('| 1 | `code` |')
  })

  it('folds a cell that holds more than one paragraph', () => {
    const src = '=begin table\n=begin row\n=begin cell\nfirst\n\nsecond\n=end cell\n=cell plain\n=end row\n=end table\n'
    const out = md(src)
    expect(out).toContain('| first second | plain |')
  })

  it('keeps markup inside a folded cell', () => {
    const src = '=begin table\n=begin row\n=cell B<bold> and C<code>\n=end row\n=end table\n'
    expect(md(src)).toContain('| **bold** and `code` |')
  })
})
