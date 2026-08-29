import { TestPodlite as Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const render = (src: string) =>
  renderToStaticMarkup(
    <Podlite>{`
=begin pod

${src}

=end pod
`}</Podlite>,
  )

const img = (out: string) => (out.match(/<img[^>]*>/) || [''])[0]

const complaints = (src: string): string[] => {
  const said: string[] = []
  const seen = jest.spyOn(console, 'error').mockImplementation((...args) => said.push(String(args[0])))
  render(src)
  seen.mockRestore()
  return said
}

describe('an image rendered to react', () => {
  it('does not hand react a value it has to reject', () => {
    expect(complaints('=for Image :alt\nok.png')).toEqual([])
  })

  it('carries the same alternative text as the other renderers', () => {
    expect(img(render('=for Image :alt\nok.png'))).not.toContain('alt=')
    expect(img(render('=for Image :!alt\nok.png'))).not.toContain('alt=')
    expect(img(render('=for Image :alt<x>\nok.png'))).toContain('alt="x"')
    expect(img(render('=for Image :alt(2)\nok.png'))).toContain('alt="2"')
  })
})
