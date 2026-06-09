import { TestPodlite as Podlite } from '../src/index'
import { extractPlainAndDecorations } from '../src/HighlightedCode'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const render = (jsx: React.ReactElement) => renderToStaticMarkup(jsx)

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

  it('maps I<> to em, C<> to code, U<> to u', () => {
    const result = extractPlainAndDecorations([
      { type: 'fcode', name: 'I', content: [{ type: 'verbatim', value: 'a' }] },
      { type: 'fcode', name: 'C', content: [{ type: 'verbatim', value: 'b' }] },
      { type: 'fcode', name: 'U', content: [{ type: 'verbatim', value: 'c' }] },
    ])
    expect(result.plain).toBe('abc')
    expect(result.decorations.map(d => d.tagName)).toEqual(['em', 'code', 'u'])
  })

  it('falls back to span with fc-X class for unknown fcodes', () => {
    const result = extractPlainAndDecorations([
      { type: 'fcode', name: 'X', content: [{ type: 'verbatim', value: 'hi' }] },
    ])
    expect(result.decorations[0].tagName).toBe('span')
    expect(result.decorations[0].properties).toEqual({ class: 'fc-X' })
  })

  it('handles nested fcodes', () => {
    const result = extractPlainAndDecorations([
      {
        type: 'fcode',
        name: 'B',
        content: [
          { type: 'verbatim', value: 'aa ' },
          { type: 'fcode', name: 'I', content: [{ type: 'verbatim', value: 'bb' }] },
        ],
      },
    ])
    expect(result.plain).toBe('aa bb')
    expect(result.decorations).toEqual([
      { start: 3, end: 5, tagName: 'em', properties: { class: 'fc-I' } },
      { start: 0, end: 5, tagName: 'strong', properties: { class: 'fc-B' } },
    ])
  })

  it('skips empty fcodes', () => {
    const result = extractPlainAndDecorations([{ type: 'fcode', name: 'B', content: [] }])
    expect(result.decorations).toEqual([])
  })
})

describe('=code rendering fallback', () => {
  it('renders pre+code wrapper before shiki finishes (SSR-safe)', () => {
    const html = render(
      <Podlite>{`
=begin pod
=begin code :lang<javascript>
const x = 42
=end code
=end pod
`}</Podlite>,
    )
    expect(html).toContain('<pre')
    expect(html).toContain('<code')
    expect(html).toContain('const x = 42')
  })

  it('wraps in code-block div when used as named =code block', () => {
    const html = render(
      <Podlite>{`
=begin pod
=begin code :lang<javascript> :caption<Example>
ok
=end code
=end pod
`}</Podlite>,
    )
    expect(html).toContain('class="code-block"')
    expect(html).toContain('class="caption"')
    expect(html).toContain('Example')
  })

  it('renders without language attribute', () => {
    const html = render(
      <Podlite>{`
=begin pod
=begin code
plain
=end code
=end pod
`}</Podlite>,
    )
    expect(html).toContain('plain')
  })
})
