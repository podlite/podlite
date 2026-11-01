import { Podlite, HookedImage } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const img = (out: string) => (out.match(/<img[^>]*>/) || [''])[0]
const hook = (src: string) => `r/${src}`

describe('the title of a picture in JSX', () => {
  it('shows the title of a picture of markdown as its hint, with and without a hook', () => {
    const doc = '![alt](x.png "Tip")\n'
    expect(img(renderToStaticMarkup(<Podlite mode="md">{doc}</Podlite>))).toBe(
      '<img src="x.png" alt="alt" title="Tip"/>',
    )
    expect(
      img(
        renderToStaticMarkup(
          <Podlite mode="md" imageSrc={hook}>
            {doc}
          </Podlite>,
        ),
      ),
    ).toBe('<img src="r/x.png" alt="alt" title="Tip"/>')
  })

  it('hides the title of a hidden picture and shows it in a draft', () => {
    const doc = '=begin markdown :masked\n![alt](x.png "Secret")\n=end markdown\n'
    expect(img(renderToStaticMarkup(<Podlite>{doc}</Podlite>))).toBe('<img src="x.png" alt="███" title="██████"/>')
    expect(img(renderToStaticMarkup(<Podlite renderMode="draft">{doc}</Podlite>))).toBe(
      '<img src="x.png" alt="alt" title="Secret"/>',
    )
  })

  it('passes the title of a picture of the tree to the image, hidden or not, with and without a hook', () => {
    const tree = (image: object): any => ({
      interator: {
        type: 'block',
        name: 'root',
        margin: '',
        content: [{ type: 'para', margin: '', text: '', content: [{ type: 'image', src: 'x', alt: 'a', ...image }] }],
      },
    })
    expect(img(renderToStaticMarkup(<Podlite tree={tree({ title: '' })} />))).toBe('<img src="x" alt="a" title=""/>')
    expect(img(renderToStaticMarkup(<Podlite tree={tree({ title: 'Tip' })} imageSrc={hook} />))).toBe(
      '<img src="r/x" alt="a" title="Tip"/>',
    )
    const hidden = tree({ title: 'Secret', guarded: true })
    expect(img(renderToStaticMarkup(<Podlite tree={hidden} />))).toBe('<img src="x" alt="█" title="██████"/>')
    expect(img(renderToStaticMarkup(<Podlite tree={hidden} renderMode="draft" />))).toBe(
      '<img src="x" alt="a" title="Secret"/>',
    )
  })

  it('takes a title on the hooked image a host renders itself', () => {
    expect(renderToStaticMarkup(<HookedImage src="x.png" alt="a" title="Tip" hook={hook} />)).toBe(
      '<img src="r/x.png" alt="a" title="Tip"/>',
    )
    expect(renderToStaticMarkup(<HookedImage src="x.png" alt="a" hook={hook} />)).toBe('<img src="r/x.png" alt="a"/>')
  })
})
