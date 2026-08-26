import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { extractPlainAndDecorations } from '../src/HighlightedCode'
import HighlightedCode from '../src/HighlightedCode'

const render = (jsx: React.ReactElement) => renderToStaticMarkup(jsx)

const codeNode = (config: Array<{ name: string; value: string }>) => ({
  type: 'block',
  name: 'code',
  content: [{ type: 'verbatim', value: 'const x = 42' }],
  config,
})

describe('extractPlainAndDecorations', () => {
  it('walks a flat verbatim array', () => {
    const result = extractPlainAndDecorations([{ type: 'verbatim', value: 'console.log("hi")' }])
    expect(result.plain).toBe('console.log("hi")')
    expect(result.decorations).toEqual([])
  })

  it('records a B<> fcode as a strong decoration', () => {
    const result = extractPlainAndDecorations([
      { type: 'verbatim', value: 'foo ' },
      { type: 'fcode', name: 'B', content: [{ type: 'verbatim', value: 'bar' }] },
      { type: 'verbatim', value: ' baz' },
    ])
    expect(result.plain).toBe('foo bar baz')
    expect(result.decorations).toEqual([{ start: 4, end: 7, tagName: 'strong', properties: { class: 'fc-B' } }])
  })

  it('skips empty fcodes', () => {
    const result = extractPlainAndDecorations([{ type: 'fcode', name: 'B', content: [] }])
    expect(result.decorations).toEqual([])
  })
})

describe('a block whose language is not declared', () => {
  it('renders as plain text', () => {
    const html = render(
      <HighlightedCode node={codeNode([])} ctx={{}} keyProp="k">
        const x = 42
      </HighlightedCode>,
    )
    expect(html).toContain('<pre')
    expect(html).toContain('const x = 42')
  })
})

describe('the box the code sits in', () => {
  it('is a pre element while the highlighter has not answered', () => {
    const html = render(
      <HighlightedCode node={codeNode([{ name: 'lang', value: 'javascript' }])} ctx={{}} keyProp="k">
        const x = 42
      </HighlightedCode>,
    )
    expect(html).toContain('<pre')
  })

  it('carries the id it was given', () => {
    const html = render(
      <HighlightedCode node={codeNode([])} ctx={{}} keyProp="k" id="block-one">
        const x = 42
      </HighlightedCode>,
    )
    expect(html).toContain('id="block-one"')
  })

  it('wraps in a code-block div and shows the caption when asked to', () => {
    const html = render(
      <HighlightedCode node={codeNode([{ name: 'caption', value: 'Example' }])} ctx={{}} keyProp="k" wrap="block">
        const x = 42
      </HighlightedCode>,
    )
    expect(html).toContain('class="code-block"')
    expect(html).toContain('class="caption"')
    expect(html).toContain('Example')
  })
})
