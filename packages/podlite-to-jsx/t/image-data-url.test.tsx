/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { Podlite } from '../src/index'
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'
const URL = `data:image/png;base64,${PNG}`
const block = (attrs = '', type = 'image/png', key = 'Logo', body = PNG) =>
  `=begin data :key<${key}> :mime-type<${type}> :encoding<base64>${attrs}\n${body}\n=end data`
const doc = (src: string) => `=begin pod\n${src}\n=end pod\n`
const rendered = (element: React.ReactElement): string => {
  const host = document.createElement('div')
  const root = createRoot(host)
  act(() => root.render(element))
  const out = host.innerHTML
  act(() => root.unmount())
  return out
}
const forms = {
  'P<>': '=para A P<logo|data:Logo> here.',
  '=picture': '=for picture :src<data:Logo>',
}

describe('a data: picture in JSX', () => {
  for (const [form, src] of Object.entries(forms)) {
    it(`writes the data URL of ${form} without asking the image resolver`, () => {
      const calls: string[] = []
      const imageSrc = (s: string) => {
        calls.push(s)
        return `mapped:${s}`
      }
      const out = rendered(<Podlite imageSrc={imageSrc}>{doc(`${src}\n\n${block()}`)}</Podlite>)
      expect(out).toContain(`src="${URL}"`)
      expect(calls).toEqual([])
    })

    it(`removes the bytes of ${form} from a mounted page when draft turns to production`, async () => {
      const source = doc(`${src}\n\n${block(' :masked')}`)
      const host = document.createElement('div')
      document.body.appendChild(host)
      const root = createRoot(host)
      const imageSrc = (s: string) => s
      await act(async () =>
        root.render(
          <Podlite imageSrc={imageSrc} renderMode="draft">
            {source}
          </Podlite>,
        ),
      )
      expect(host.innerHTML).toContain(PNG)
      await act(async () =>
        root.render(
          <Podlite imageSrc={imageSrc} renderMode="production">
            {source}
          </Podlite>,
        ),
      )
      expect(host.innerHTML).not.toContain(PNG)
      act(() => root.unmount())
      host.remove()
    })
  }

  it('writes the data URL in the caption of a table of contents given by =set', () => {
    const out = rendered(
      <Podlite>
        {doc(`=set :caption Contents P<toccap|data:Logo>\n=for toc\nhead1\n\n=head1 Topic\n\n${block()}`)}
      </Podlite>,
    )
    expect(out).toContain(`src="${URL}"`)
  })

  it('passes a data URL the author wrote to the image resolver, as before', () => {
    const calls: string[] = []
    const imageSrc = (s: string) => {
      calls.push(s)
      return s
    }
    rendered(<Podlite imageSrc={imageSrc}>{doc(`=para P<ready|${URL}>`)}</Podlite>)
    expect(calls).toEqual([URL])
  })

  it('chooses a video by the type of the data URL and declares that type', () => {
    const out = rendered(
      <Podlite>{doc(`=for picture :src<data:Clip>\n\n${block('', 'video/webm', 'Clip', 'GkXfow==')}`)}</Podlite>,
    )
    expect(out).toContain('<video')
    expect(out).toContain('type="video/webm"')
    expect(out).toContain('src="data:video/webm;base64,GkXfow=="')
  })

  it('encodes a text type in a host without TextEncoder', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Łódź</text></svg>'
    const out = rendered(
      <Podlite>
        {doc(`=for picture :src<data:Icon>\n\n=begin data :key<Icon> :mime-type<image/svg+xml>\n${svg}\n=end data`)}
      </Podlite>,
    )
    const url = out.match(/src="(data:image\/svg\+xml;base64,[^"]+)"/)?.[1] ?? ''
    expect(Buffer.from(url.split(',')[1] ?? '', 'base64').toString('utf8')).toBe(`${svg}\n`)
  })

  it('keeps a picture whose key ends in .mov an image', () => {
    const out = rendered(
      <Podlite>{doc(`=for picture :src<data:Logo.mov>\n\n${block('', 'image/png', 'Logo.mov')}`)}</Podlite>,
    )
    expect(out).not.toContain('<video')
    expect(out).toContain(`<img src="${URL}"`)
  })
})
