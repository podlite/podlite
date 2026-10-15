import { Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const render = (text: string): string => renderToStaticMarkup(<Podlite>{`=para ${text}\n`}</Podlite>)

// Specification.pod6, release/v3.0; plan T814, decisions 2026-10-16
describe('markup codes read by their letter, in JSX', () => {
  it('keeps what G<> and Z<> hide inside a reserved code, and shows the code as written', () => {
    const html = render('Q<G<hunter2>> and Y<Z<note>>')
    expect(html).not.toContain('hunter2')
    expect(html).not.toContain('note')
    expect(html).toContain('Q&lt;')
    expect(html).toContain('Y&lt;&gt;')
    expect(html).not.toContain('not supported')
  })

  it('renders P<> as a picture with its text and address', () => {
    const html = render('An P<astronaut|astronaut.png> floats.')
    expect(html).toMatch(/<img[^>]*src="astronaut.png"/)
    expect(html).toMatch(/<img[^>]*alt="astronaut"/)
    expect(html).not.toContain('P&lt;')
  })

  it('shows the text of M<> with a module it cannot run', () => {
    const html = render('A M<hello|NoSuchModule> word.')
    expect(html).toContain('A hello word.')
    expect(html).not.toContain('NoSuchModule')
  })

  it('formats the codes inside S<> and keeps its whitespace', () => {
    expect(render('S<a  B<b>  c>')).toContain('a  <strong>b</strong>  c')
  })
})
