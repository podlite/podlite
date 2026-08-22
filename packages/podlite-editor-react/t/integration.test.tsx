/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { parse as parseSchema, toHtml } from '@podlite/schema'
import Podlite from '@podlite/to-jsx'
import { podlite } from 'podlite'
import { podliteTreeLang } from '../src/podliteMarkdown'
import { podliteDecorations } from '../src/podliteDecorations'

// One document carrying the constructs that cross package boundaries: a heading
// for the table of contents, a table built by the table plugin, an item list, a
// link, inline codes and a fenced block.
const document = [
  '=head1 Handbook',
  '',
  'Opening prose with B<bold>, C<code> and L<Podlite|https://podlite.org>.',
  '',
  '=begin table',
  ' Name  | Count',
  ' ======|======',
  ' alpha | 1',
  '=end table',
  '',
  '=item1 first',
  '=item2 nested',
  '',
  '=begin code :lang<js>',
  'const x = 1',
  '=end code',
  '',
].join('\n')

const mount = (element: React.ReactElement): string => {
  const host = window.document.createElement('div')
  window.document.body.appendChild(host)
  const root = createRoot(host)
  act(() => {
    root.render(element)
  })
  const html = host.innerHTML
  act(() => root.unmount())
  host.remove()
  return html
}

describe('the chain from parse to editor', () => {
  it('reads the document the same way in the parser and in the core', () => {
    const bare = parseSchema(document, { podMode: 1 })
    const core = podlite({ importPlugins: true })
    const withPlugins = core.toAst(core.parse(document, { podMode: 1 }))
    expect(Array.isArray(bare)).toBe(true)
    expect(withPlugins.name).toBe('root')
    expect(String(toHtml({}).run(withPlugins).toString())).toContain('<table>')
  })

  it('hands the core tree to the jsx renderer without reshaping it', () => {
    const core = podlite({ importPlugins: true })
    const tree = core.toAstResult(core.parse(document))
    const html = mount(<Podlite tree={tree} />)
    expect(html).toContain('Handbook')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('href="https://podlite.org"')
    // the jsx renderer stamps an id on the block, the html one does not
    expect(html).toContain('<table')
    expect(html).toContain('<li')
  })

  it('renders the same content through html and through jsx', () => {
    const core = podlite({ importPlugins: true })
    const asHtml = String(
      toHtml({})
        .run(core.toAst(core.parse(document, { podMode: 1 })))
        .toString(),
    )
    const asJsx = mount(<Podlite tree={core.toAstResult(core.parse(document))} />)
    for (const text of ['Handbook', 'alpha', 'first', 'nested', 'const x = 1']) {
      expect(asHtml).toContain(text)
      expect(asJsx).toContain(text)
    }
  })

  it('takes the same document in the editor language layer', () => {
    const state = EditorState.create({
      doc: document,
      extensions: [podliteTreeLang([]), podliteDecorations()],
    })
    const view = new EditorView({ state, parent: window.document.body })
    expect(view.state.doc.toString()).toBe(document)
    expect(view.dom.textContent).toContain('Handbook')
    view.destroy()
  })

  it('keeps a wrapper given by the editor on the block nodes', () => {
    const core = podlite({ importPlugins: true })
    const tree = core.toAstResult(core.parse(document))
    const wrapElement = (node: any, children: any) =>
      node?.location?.start?.line ? (
        <div key={node.location.start.line} className="line-src" data-line={node.location.start.line}>
          {children}
        </div>
      ) : (
        children
      )
    const html = mount(<Podlite tree={tree} wrapElement={wrapElement} />)
    expect(html).toContain('class="line-src"')
    expect(html).toContain('data-line="1"')
  })
})
