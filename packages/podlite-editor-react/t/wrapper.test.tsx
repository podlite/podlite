import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import WindowWrapper from '../src/Wrapper'

describe('WindowWrapper', () => {
  it('renders without enableCopyPng (default)', () => {
    const html = renderToStaticMarkup(
      <WindowWrapper title="Test">
        <div>content</div>
      </WindowWrapper>,
    )
    expect(html).not.toContain('<button')
    expect(html).toContain('Test')
    expect(html).toContain('content')
    expect(html).toMatchSnapshot()
  })

  it('renders with enableCopyPng', () => {
    const html = renderToStaticMarkup(
      <WindowWrapper title="Diagram" enableCopyPng>
        <div>diagram content</div>
      </WindowWrapper>,
    )
    expect(html).toContain('<button')
    expect(html).toContain('Diagram')
    expect(html).toContain('diagram content')
    expect(html).toMatchSnapshot()
  })

  it('renders without title', () => {
    const html = renderToStaticMarkup(
      <WindowWrapper>
        <div>no title</div>
      </WindowWrapper>,
    )
    expect(html).not.toContain('class="title"')
    expect(html).toContain('no title')
  })
})
