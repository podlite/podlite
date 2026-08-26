import { TestPodlite as Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const render = (jsx: React.ReactElement) => renderToStaticMarkup(jsx)

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
