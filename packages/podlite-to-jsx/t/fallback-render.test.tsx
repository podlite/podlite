import { TestPodlite as Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const render = (jsx: React.ReactElement) => renderToStaticMarkup(jsx)

describe('fallback rendering in jsx', () => {
  it('renders an unknown block through its fallback type', () => {
    const html = render(
      <Podlite>
        {`=begin pod
=config Recipe :fallback<para>

=begin Recipe
Combine flour and water.
=end Recipe
=end pod
`}
      </Podlite>,
    )
    expect(html).toContain('Combine flour and water.')
    expect(html).not.toContain('not supported')
  })

  it('renders diagram source as text down a cascade', () => {
    const html = render(
      <Podlite>
        {`=begin pod
=config FancyDiagram :fallback<Sketch>
=config Sketch :fallback<para>

=begin FancyDiagram
graph TD A-->B
=end FancyDiagram
=end pod
`}
      </Podlite>,
    )
    expect(html).toContain('graph TD A--&gt;B')
    expect(html).not.toContain('not supported')
  })
})
