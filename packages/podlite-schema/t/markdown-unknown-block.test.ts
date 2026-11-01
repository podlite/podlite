import { podlite } from '../../core/src'
import { podlitePluggable } from '../src/pluggableParser'
import { toMarkdown, toAnyRules } from '../src'

// the parser of this package, without plugins
const p = podlitePluggable()
const bare = (doc: string) => String(p.toMarkdown(p.toAst(p.parse(doc, { podMode: 1 }))))
// the path of the command line: the core with its plugins
const core = podlite({ importPlugins: true })
const markdown = (doc: string, opt: object = { podMode: 1 }, renderMode = 'production') =>
  String(
    toMarkdown({ renderMode })
      .use(toAnyRules('toMarkdown', core.getPlugins()))
      .run(core.toAst(core.parse(doc, opt))),
  )

describe('a block without a rule of its own in markdown output', () => {
  it('writes the body in a fence and the next paragraph on its own', () => {
    expect(bare('=begin Unknown\n<b>raw</b> *\n\nAudit <Title>\n=end Unknown\n\n=para After\n')).toBe(
      '```\n<b>raw</b> *\n\nAudit <Title>\n```\n\nAfter\n\n',
    )
  })

  it('marks a diagram as mermaid and a hidden one as plain', () => {
    expect(markdown('=begin Mermaid\ngraph TD; A-->B\n=end Mermaid\n\n=para After\n')).toBe(
      '```mermaid\ngraph TD; A-->B\n```\n\nAfter\n\n',
    )
    expect(markdown('=begin Diagram\ngraph TD\n=end Diagram\n')).toBe('```mermaid\ngraph TD\n```\n\n')
    expect(markdown('=for Mermaid :masked\ngraph TD\n')).toBe('```\n█████ ██\n```\n\n')
    expect(markdown('=config Mermaid :masked\n\n=begin Mermaid\ngraph TD\n=end Mermaid\n')).toBe(
      '```\n█████ ██\n```\n\n',
    )
    expect(markdown('=for Mermaid :masked\ngraph TD\n', { podMode: 1 }, 'draft')).toBe('```mermaid\ngraph TD\n```\n\n')
    expect(markdown('=begin pod :masked\n=begin Mermaid\ngraph TD\n=end Mermaid\n=end pod\n')).toBe(
      '```\n█████ ██\n```\n\n',
    )
  })

  it('makes the fence longer than a run of backticks in the body', () => {
    expect(bare('=begin Unknown\n```\nx\n=end Unknown\n')).toBe('````\n```\nx\n````\n\n')
    expect(bare('=begin markdown\n```\nopen\n=end markdown\n\n=para After\n')).toBe(
      '````\n```\nopen\n````\n\nAfter\n\n',
    )
  })

  it('writes nothing for a body of an empty line', () => {
    expect(bare('=begin Unknown\n\n=end Unknown\n=para A\n')).toBe('A\n\n')
  })

  it('writes the body as text inside a quote', () => {
    expect(bare('=begin nested\n=begin Unknown\n<Title>\n=end Unknown\n=end nested\n')).toBe('> \\<Title>\n\n')
  })

  it('writes the body of a block inside a frame of a table as written', () => {
    const doc =
      '=begin table\n=begin row\n=begin cell :colspan(2)\n=begin Unknown\nAudit <Title>\n=end Unknown\n=end cell\n=end row\n=end table\n'
    expect(bare(doc)).toContain('```\nAudit <Title>\n```')
  })

  it('writes one fence for a body that holds lines of blocks', () => {
    expect(bare('=begin Unknown\n=begin Inner\nx\n=end Inner\n=end Unknown\n')).toBe(
      '```\n=begin Inner\nx\n=end Inner\n```\n\n',
    )
  })

  it('fences a picture and a formula without their plugins', () => {
    expect(bare('=picture x.png\n\n=para After\n')).toBe('```\nx.png\n```\n\nAfter\n\n')
    expect(markdown('=begin formula\nx^2\n=end formula\n')).toBe('```\nx^2\n```\n\n')
  })

  it('writes a picture with its plugin, its caption as a paragraph, and the next paragraph on its own', () => {
    expect(markdown('=begin picture\nx.png\nAudit B<bold>\n=end picture\n\n=para After\n')).toBe(
      '![](x.png)\n\nAudit **bold**\n\nAfter\n\n',
    )
    expect(markdown('=begin Image\nx.png\nCap\n=end Image\n=para After\n')).toBe('![](x.png)\n\nCap\n\nAfter\n\n')
    expect(markdown('=picture x.png\n\n=para After\n')).toBe('![](x.png)\n\nAfter\n\n')
  })

  it('ends a block of Markdown with a blank line', () => {
    expect(markdown('=begin markdown\n- item\n=end markdown\n\n=para After\n')).toBe('- item\n\nAfter\n\n')
    expect(markdown('=begin Markdown\n- item\n=end Markdown\n\n=para After\n')).toBe('- item\n\nAfter\n\n')
  })

  it('fences a diagram and a formula of markdown', () => {
    expect(markdown('```mermaid\ngraph TD\n```\n', { mode: 'md' })).toBe('```mermaid\ngraph TD\n```\n\n')
    expect(markdown('$$\nx+y\n$$\n', { mode: 'md' })).toBe('```\nx+y\n```\n\n')
  })
})

describe('what stays as it was', () => {
  it('writes a block with a rule and a semantic block as before', () => {
    expect(bare('=begin code\nx\n=end code\n')).toBe('```\nx\n```\n')
    expect(bare('=begin nested\nquoted\n=end nested\n')).toBe('> quoted\n\n')
    expect(bare('=SYNOPSIS T\n')).toBe('# SYNOPSIS\n\nT\n\n')
  })

  it('writes nothing for data, a comment and an empty block', () => {
    expect(bare('=begin data\nx\n=end data\n=para A\n')).toBe('A\n\n')
    expect(bare('=begin comment\nx\n=end comment\n=para A\n')).toBe('A\n\n')
    expect(bare('=begin Unknown\n=end Unknown\n=para A\n')).toBe('A\n\n')
  })

  it('keeps an inline picture of markdown in its line, in a paragraph, a heading and a cell', () => {
    expect(markdown('Before ![alt](x.png) after.\n', { mode: 'md' })).toBe('Before ![alt](x.png) after.\n')
    expect(markdown('# H ![a](y.png) z\n', { mode: 'md' })).toBe('# H ![a](y.png) z\n')
    expect(markdown('| A | B |\n| - | - |\n| a<em>b</em>c | d |\n', { mode: 'md' })).toContain('| a<em>b</em>c | d |')
    expect(markdown('=para C P<x.png> tail\n')).toBe('C ![](x.png) tail\n\n')
  })

  it('leaves an unresolved =include as it was', () => {
    expect(bare('=include file:x.podlite\n')).not.toContain('```')
  })
})
