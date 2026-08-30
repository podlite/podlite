import Podlite from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// The real component, not TestPodlite: that one freezes every node id to the
// literal `id`, and anchors are derived from ids, so every target would collapse
// to one name and the preview would look broken when it is not.
const render = (doc: string, props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(<Podlite {...props}>{`=begin pod\n\n${doc}\n\n=end pod\n`}</Podlite>)

const anchors = (html: string) => html.match(/<a[^>]*>/g) || []

type Found = { text: string; kind: string } | undefined
const collect = () => {
  const seen: Array<[string, Found]> = []
  const linkPreview = (target: string, resolved: Found) => {
    seen.push([target, resolved])
    return resolved ? <span className="pv">{resolved.text}</span> : null
  }
  return { seen, linkPreview }
}

const page = `=head1 Setup

The first paragraph under the heading.

=for para :id<note>
A named paragraph.

L<go|#Setup> and W<back|#note> and L<out|https://example.com> and L<miss|#nowhere>`

describe('a renderer given no resolver', () => {
  it('writes no attribute and no markup of its own', () => {
    expect(anchors(render(page)).join('')).not.toContain('title=')
    expect(render(page)).not.toContain('class="pv"')
  })

  it('still writes a title the author asked for', () => {
    expect(anchors(render(`=head1 Setup\n\nUnder it.\n\nL<go|#Setup :title('mine')>`))[0]).toContain('title="mine"')
  })
})

describe('what a resolver is told about the target', () => {
  it('gets the text found under a heading', () => {
    const { seen, linkPreview } = collect()
    render(page, { linkPreview })
    expect(seen[0]).toEqual(['#Setup', { text: 'The first paragraph under the heading.', kind: 'heading' }])
  })

  it('gets the text of a node the author named', () => {
    const { seen, linkPreview } = collect()
    render(page, { linkPreview })
    expect(seen[1]).toEqual(['#note', { text: 'A named paragraph.', kind: 'explicit-id' }])
  })

  it('is told nothing was found for a link that leaves the document', () => {
    const { seen, linkPreview } = collect()
    render(page, { linkPreview })
    expect(seen[2]).toEqual(['https://example.com', undefined])
  })

  it('is told nothing was found when the target does not exist', () => {
    const { seen, linkPreview } = collect()
    render(page, { linkPreview })
    expect(seen[3]).toEqual(['#nowhere', undefined])
  })

  it('steps over what renders nothing', () => {
    const { seen, linkPreview } = collect()
    render(`=head1 Setup\n\n=comment hidden\n\nVisible text.\n\nL<go|#Setup>`, { linkPreview })
    expect(seen[0][1]).toEqual({ text: 'Visible text.', kind: 'heading' })
  })

  it('stops at the next heading of the same level', () => {
    const { seen, linkPreview } = collect()
    render(`=head1 One\n\n=head1 Two\n\nBelongs to Two.\n\nL<go|#One>`, { linkPreview })
    expect(seen[0][1]).toEqual({ text: '', kind: 'heading' })
  })

  // A heading below the target is text like any other, so it is what the search
  // stops on. Whether a preview should read past it to the prose is open.
  it('takes a heading that sits below it as the text', () => {
    const { seen, linkPreview } = collect()
    render(`=head1 One\n\n=head2 Under one\n\nInside the section.\n\nL<go|#One>`, { linkPreview })
    expect(seen[0][1]).toEqual({ text: 'Under one', kind: 'heading' })
  })
})

describe('what a resolver decides', () => {
  it('puts its own markup beside the link', () => {
    const { linkPreview } = collect()
    expect(render(page, { linkPreview })).toContain('<span class="pv">The first paragraph under the heading.</span>')
  })

  it('shows nothing when it returns null', () => {
    const html = render(page, { linkPreview: () => null })
    expect(html).not.toContain('class="pv"')
    expect(anchors(html).join('')).not.toContain('title=')
  })

  it('reaches both link codes', () => {
    const { seen, linkPreview } = collect()
    render(page, { linkPreview })
    expect(seen.map(([t]) => t)).toEqual(['#Setup', '#note', 'https://example.com', '#nowhere'])
  })
})
