import { Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

type Files = Record<string, string>

const render = (source: string, files: Files = {}): string =>
  renderToStaticMarkup(<Podlite includeReader={(path: string) => files[path] ?? null}>{source}</Podlite>)

const codeText = (html: string): string | undefined =>
  html
    .match(/<pre[^>]*>[\s\S]*?<\/pre>/)?.[0]
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

const body = ['    first', '    second', '      inner']

// Specification.pod6, Code blocks: the indent that opened an implicit code block is its nesting
describe('an implicit code block in JSX', () => {
  it('loses the indent of its first line on every line, inside =pod', () => {
    const html = render(['=begin pod', '', 'Text.', '', ...body, '', '=end pod', ''].join('\n'))
    expect(codeText(html)).toBe('first\nsecond\n  inner\n')
  })

  it('loses it the same way at the root of a document', () => {
    const html = render(['Text.', '', ...body, ''].join('\n'))
    expect(codeText(html)).toBe('first\nsecond\n  inner\n')
  })

  it('brought by an include into an indented block loses it once', () => {
    const html = render(
      ['=begin pod', '', '  =begin nested', '  =include file:part.podlite', '  =end nested', '', '=end pod', ''].join(
        '\n',
      ),
      {
        'part.podlite': ['=begin pod', '', 'Text.', '', ...body, '', '=end pod', ''].join('\n'),
      },
    )
    expect(codeText(html)).toBe('first\nsecond\n  inner\n')
  })
})
