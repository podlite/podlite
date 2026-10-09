import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Podlite from '../src/index'
import { podlite as podliteCore } from 'podlite'

// A plugin that runs after parsing (the publisher's links plugin) changes what a heading
// says; the table of contents was built before it and links to the name the heading was
// parsed with.
const rendered = (src: string, rewrite: (text: string) => string) => {
  const p = podliteCore({ importPlugins: true })
  const tree = p.toAstResult(p.parse(src))
  // the link sits inside the heading's paragraph
  const rewriteLinks = (nodes: any[]) =>
    nodes.map((child: any) => {
      if (child && child.type === 'fcode' && child.name === 'L') return rewrite(child.meta ?? child.content.join(''))
      if (child && Array.isArray(child.content)) child.content = rewriteLinks(child.content)
      return child
    })
  const walk = (node: any) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    if (node.type === 'block' && node.name === 'head') node.content = rewriteLinks(node.content)
    else walk(node.content)
  }
  walk(tree.interator)
  const html = renderToStaticMarkup(<Podlite tree={tree} />)
  const entries = [...html.matchAll(/<li class="toc-item"><a([^>]*)>/g)].map(
    m => (m[1].match(/href="([^"]*)"/) || [])[1],
  )
  const anchors = [...html.matchAll(/<h1 id="([^"]*)"/g)].map(m => m[1])
  return { entries, anchors }
}

describe('a table of contents entry for a heading whose text changed after parsing', () => {
  it('still links to the heading', () => {
    const { entries, anchors } = rendered(
      '=toc head1\n\n=head1 About L<doc:Target> here\n\nA.\n\n=head1 Using L<doc:Missing> in practice\n\nB.\n\n=head1 Plain heading\n\nC.\n',
      target => target.replace(/^doc:/, ''),
    )
    expect(anchors).toHaveLength(3)
    expect(entries).toEqual(anchors.map(anchor => `#${anchor}`))
  })
})
