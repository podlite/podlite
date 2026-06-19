import { Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const root = { innerHTML: '' }
function render(jsx) {
  root.innerHTML = renderToStaticMarkup(jsx)
  return root.innerHTML
}

describe('image src resolution via ctx.imageSrc (data provider pattern)', () => {
  it('without hook: =picture src renders raw (backward compat)', () => {
    render(
      <Podlite>
        {`=begin pod
=picture relative/foo.png
A caption
=end pod
`}
      </Podlite>,
    )
    expect(root.innerHTML).toMatch(/src="relative\/foo\.png"/)
  })

  it('with sync hook: =picture src is rewritten', () => {
    const imageSrc = (src: string) => `https://cdn.example/${src}`
    render(
      <Podlite imageSrc={imageSrc}>
        {`=begin pod
=picture relative/foo.png
A caption
=end pod
`}
      </Podlite>,
    )
    expect(root.innerHTML).toMatch(/src="https:\/\/cdn\.example\/relative\/foo\.png"/)
    expect(root.innerHTML).not.toMatch(/src="relative\/foo\.png"/)
  })

  it('with sync hook: markdown ![]() src is rewritten', () => {
    const imageSrc = (src: string) => `data:resolved/${src}`
    render(
      <Podlite mode="md" imageSrc={imageSrc}>
        {`![alt text](rel/path.png)\n`}
      </Podlite>,
    )
    expect(root.innerHTML).toMatch(/src="data:resolved\/rel\/path\.png"/)
  })

  it('hook receives imageBaseDir', () => {
    const calls: Array<{ src: string; baseDir?: string }> = []
    const imageSrc = (src: string, baseDir?: string) => {
      calls.push({ src, baseDir })
      return `mapped:${src}`
    }
    render(
      <Podlite imageSrc={imageSrc} imageBaseDir="/abs/host/dir">
        {`=begin pod
=picture foo.png
=end pod
`}
      </Podlite>,
    )
    expect(calls).toContainEqual({ src: 'foo.png', baseDir: '/abs/host/dir' })
  })

  it('async hook (Promise): SSR renders no img until resolved', () => {
    const imageSrc = (src: string) => Promise.resolve(`async:${src}`)
    render(
      <Podlite imageSrc={imageSrc}>
        {`=begin pod
=picture foo.png
=end pod
`}
      </Podlite>,
    )
    expect(root.innerHTML).not.toMatch(/<img/)
    expect(root.innerHTML).not.toMatch(/foo\.png/)
  })

  it('mp4 src goes through hook', () => {
    const imageSrc = (src: string) => `https://media.example/${src}`
    render(
      <Podlite imageSrc={imageSrc}>
        {`=begin pod
=picture clip.mp4
=end pod
`}
      </Podlite>,
    )
    expect(root.innerHTML).toMatch(/src="https:\/\/media\.example\/clip\.mp4"/)
  })
})
