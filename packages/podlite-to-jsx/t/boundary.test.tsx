import { TestPodlite as Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const root = { innerHTML: '' }
function render(jsx) {
  root.innerHTML = renderToStaticMarkup(jsx)
  return root.innerHTML
}

describe('=boundary block renders as void <hr>', () => {
  it('bare =boundary renders without throwing', () => {
    expect(() =>
      render(
        <Podlite>
          {`=begin pod
=boundary
=end pod
`}
        </Podlite>,
      ),
    ).not.toThrow()
    expect(root.innerHTML).toContain('<hr')
  })

  it('=boundary Text renders without throwing', () => {
    expect(() =>
      render(
        <Podlite>
          {`=begin pod
=boundary Text
=end pod
`}
        </Podlite>,
      ),
    ).not.toThrow()
    expect(root.innerHTML).toContain('<hr')
  })

  it('=boundary :caption renders without throwing', () => {
    expect(() =>
      render(
        <Podlite>
          {`=begin pod
=boundary :caption("Section")
=end pod
`}
        </Podlite>,
      ),
    ).not.toThrow()
    expect(root.innerHTML).toContain('<hr')
  })
})
