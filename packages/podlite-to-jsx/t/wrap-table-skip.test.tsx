import { TestPodlite as Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const root = { innerHTML: '' }
function render(jsx) {
  root.innerHTML = renderToStaticMarkup(jsx)
  return root.innerHTML
}

// wrapElement that wraps every node it receives in a <div data-mark="W">.
// If the library wraps row/cell, the resulting HTML will contain
// <div data-mark="W"> as a direct child of <tbody> or <tr>, which is
// invalid HTML and breaks browser table layout.
const wrapAll = (_node: any, children: any) => <div data-mark="W">{children}</div>

describe('wrapElement skipped for row/cell to keep HTML tables valid', () => {
  it('does not place wrapping div between <tbody> and <tr>', () => {
    render(
      <Podlite wrapElement={wrapAll}>
        {`=begin table

=begin row
=cell A
=cell B
=end row

=begin row
=cell 1
=cell 2
=end row

=end table
`}
      </Podlite>,
    )
    expect(root.innerHTML).toMatch(/<table[\s>]/)
    expect(root.innerHTML).not.toMatch(/<tbody[^>]*>\s*<div[^>]*data-mark/)
    expect(root.innerHTML).not.toMatch(/<thead[^>]*>\s*<div[^>]*data-mark/)
  })

  it('does not place wrapping div between <tr> and <td>/<th>', () => {
    render(
      <Podlite wrapElement={wrapAll}>
        {`=begin table

=begin row :header
=cell H1
=cell H2
=end row

=begin row
=cell A
=cell B
=end row

=end table
`}
      </Podlite>,
    )
    expect(root.innerHTML).not.toMatch(/<tr[^>]*>\s*<div[^>]*data-mark/)
  })

  it('still wraps the outer =table block (line tracking remains)', () => {
    render(
      <Podlite wrapElement={wrapAll}>
        {`=begin table

=begin row
=cell A
=end row

=end table
`}
      </Podlite>,
    )
    // The <table> element should still be wrapped or sit next to a wrapper —
    // verify at least one wrap appears around the table-level node.
    expect(root.innerHTML).toMatch(/data-mark="W"/)
  })
})
