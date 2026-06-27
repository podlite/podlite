import { podlitePluggable } from '../src/pluggableParser'
import toMarkdown from '../src/exportMarkdown'
import toHtml from '../src/exportHtml'

const parseToAst = (src: string) => {
  const p = podlitePluggable()
  return p.toAst(p.parse(src, { podMode: 1 }))
}

const md = (src: string) => toMarkdown({}).run(parseToAst(src)).toString()
const html = (src: string) => toHtml({}).run(parseToAst(src)).toString()

describe('fallback rendering', () => {
  it('renders an unknown block through its fallback type in markdown', () => {
    const out = md(
      '=pod\n=config Recipe :fallback<para>\n\n=begin Recipe :id<bread>\nCombine flour and water.\n=end Recipe\n',
    )
    expect(out).toContain('Combine flour and water.')
    expect(out).not.toContain('# Recipe')
    expect(out).not.toContain('original-name')
  })

  it('ignores attributes foreign to the fallback type', () => {
    const out = md('=pod\n=config Recipe :fallback<para>\n\n=begin Recipe :interactive<true>\ntext body\n=end Recipe\n')
    expect(out).toContain('text body')
    expect(out).not.toContain('interactive')
  })

  it('renders incompatible content as plain text down a cascade', () => {
    const out = md(
      '=pod\n=config FancyDiagram :fallback<Sketch>\n=config Sketch :fallback<para>\n\n=begin FancyDiagram\ngraph TD A-->B\n=end FancyDiagram\n',
    )
    expect(out).toContain('graph TD A-->B')
  })

  it('renders an unknown block through its fallback type in html', () => {
    const out = html('=pod\n=config Recipe :fallback<para>\n\n=begin Recipe\nCombine flour.\n=end Recipe\n')
    expect(out).toContain('Combine flour.')
    expect(out).not.toContain('original-name')
  })

  it('leaves a custom block without a fallback rendering its content', () => {
    const out = md('=pod\n=begin Card\ncard body\n=end Card\n')
    expect(out).toContain('card body')
  })
})
