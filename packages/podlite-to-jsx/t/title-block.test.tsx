import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TestPodlite as Podlite, Podlite as PodliteRaw } from '../src/index'
import { podlitePluggable, titleParts } from '@podlite/schema'

// ids are frozen to "id" by TestPodlite
const html = (src: string, props: object = {}) => renderToStaticMarkup(<Podlite {...props}>{src}</Podlite>)
const heading = (src: string, props: object = {}) => (html(src, props).match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]

describe('the =TITLE block in the output of to-jsx', () => {
  it('shows its content as the title, not the word TITLE', () => {
    expect(html('=TITLE test\n')).toBe('<div><h1 class="TITLE" id="id">test\n</h1></div>')
    expect(heading('=TITLE My B<Doc>\n')).toBe('My <strong>Doc</strong>\n')
  })

  it('shows nothing for an empty title', () => {
    expect(html('=TITLE\n\n=para Quick note\n')).toBe('<div></div><div id="id"><p>Quick note\n</p></div>')
  })

  it('writes the paragraphs of a title in one heading and other blocks under it', () => {
    expect(heading('=begin TITLE\nPodlite\n\nA lightweight markup language\n=end TITLE\n')).toBe(
      'Podlite\n A lightweight markup language\n',
    )
    const out = html('=begin TITLE\nUsing\n\n=begin code\npodlite convert\n=end code\n=end TITLE\n')
    expect(out).toMatch(
      /^<div><h1 class="TITLE" id="id">Using\n<\/h1><div class="code-block"><pre[^>]*><code>podlite convert\n/,
    )
    expect(html('=begin TITLE\n=begin code\nonly code\n=end code\n=end TITLE\n')).not.toContain('<h1')
  })

  it('takes every paragraph of an explicit =para and keeps the text of an item under the title', () => {
    expect(heading('=begin TITLE\n=begin para\nOne\n\nTwo\n=end para\n=end TITLE\n')).toBe('One\n Two\n')
    const out = html('=begin TITLE\nFirst\n\n=begin code\nx\n=end code\n\nSecond\n\n=item point\n=end TITLE\n')
    expect(heading('=begin TITLE\nFirst\n\n=begin code\nx\n=end code\n\nSecond\n\n=item point\n=end TITLE\n')).toBe(
      'First\n Second\n',
    )
    expect(out.indexOf('point')).toBeGreaterThan(out.indexOf('</h1>'))
  })

  it('puts the id of the block on the heading and keeps it on an empty title', () => {
    expect(html('=for TITLE :id<Spec>\nThe Specification\n')).toContain('<h1 class="TITLE" id="Spec">')
    expect(html('=begin TITLE :id<Spec>\n=end TITLE\n')).toBe('<div><span id="Spec"></span></div>')
  })

  it('lets a directive act from where it stands', () => {
    expect(heading('=begin TITLE\n=alias Label B<Doc>\n\nA<Label>\n=end TITLE\n')).toBe('<strong>Doc</strong>\n')
    expect(
      heading('=begin TITLE\n=alias Label First\n\nA<Label>\n\n=alias Label Second\n\nA<Label>\n=end TITLE\n'),
    ).toBe('First\n Second\n')
  })

  it('renders the content once, with one note', () => {
    const out = html('=TITLE N<Note>\n')
    expect(out.match(/\[1\]/g)).toHaveLength(2)
    expect(out).not.toContain('[2]')
  })

  it('counts what is seen in the title', () => {
    expect(html('=TITLE N<>\n')).not.toContain('<h1')
    expect(html('=TITLE N<Z<Note>>\n')).toContain('<h1')
    expect(html('=TITLE E<32>\n')).not.toContain('<h1')
    expect(heading('=TITLE E<65>\n')).toBe('A\n')
    expect(html('=TITLE Z<hidden>\n')).not.toContain('<h1')
    expect(heading('=TITLE P<mark|mark.png>\n')).toContain('<img')
    expect(heading('=TITLE P<mark|mark.png>\n', { imageSrc: (src: string) => src })).toBeTruthy()
    expect(html('=alias Label Z<Secret>\n\n=TITLE A<Label>\n')).not.toContain('<h1')
  })

  it('hides a masked title and the masked paragraph it takes apart, and shows them in a draft', () => {
    expect(heading('=for TITLE :masked\nSecret\n')).toBe('██████\n')
    const doc = '=alias Label Secret\n\n=begin TITLE\n=for para :masked\nA<Label>\n=end TITLE\n'
    expect(heading(doc)).toBe('██████\n')
    expect(heading(doc, { renderMode: 'draft' })).toBe('Secret\n')
    expect(heading('=TITLE My G<Secret>\n')).not.toContain('Secret')
    expect(heading('=TITLE My G<Secret>\n', { renderMode: 'draft' })).toContain('Secret')
  })

  it('keeps the spaces and the line break of S<>', () => {
    expect(heading('=TITLE S<Alpha  Beta>\n')).toBe('Alpha\u00a0\u00a0Beta\n')
    expect(heading('=TITLE S<Alpha\nBeta>\n')).toBe('Alpha<br/>Beta\n')
    expect(heading('=TITLE S<B<Alpha\nBeta>>\n')).toBe('<strong>Alpha<br/>Beta</strong>\n')
  })

  it('shows a title written in the plural and a title after a paragraph the same way', () => {
    expect(html('=TITLES Plural\n')).toBe('<div><h1 class="TITLES" id="id">Plural\n</h1></div>')
    expect(html('=para Intro\n\n=TITLE Late\n')).toContain('<h1 class="TITLE" id="id">Late\n</h1>')
  })

  it('numbers the notes in the order of the source', () => {
    const out = html('=begin TITLE\n=item point N<first>\n\nTitle N<second>\n=end TITLE\n')
    expect(heading('=begin TITLE\n=item point N<first>\n\nTitle N<second>\n=end TITLE\n')).toContain('[2]')
    expect(out).toContain('point <sup id="fnref:1"')
  })

  it('gives the table of contents a link to the id of the title', () => {
    const out = html('=begin pod\n=toc TITLE\n\n=for TITLE :id<Spec>\nThe Specification\n=end pod\n')
    expect(out).toContain('<a href="#Spec">')
    expect(out).toContain('<h1 class="TITLE" id="Spec">')
  })

  it('hides the text of a masked paragraph of a tree that carries no marks of its own', () => {
    const tree = {
      type: 'block',
      name: 'root',
      margin: '',
      content: [
        {
          type: 'block',
          name: 'TITLE',
          margin: '',
          content: [
            {
              type: 'block',
              name: 'para',
              margin: '',
              config: [{ name: 'masked', value: true, type: 'boolean' }],
              content: [{ type: 'para', margin: '', content: [{ type: 'text', value: 'Secret' }] }],
            },
          ],
        },
      ],
    }
    const render = (renderMode: 'production' | 'draft') =>
      renderToStaticMarkup(<PodliteRaw tree={{ interator: tree } as never} renderMode={renderMode} />)
    expect(render('production')).toContain('██████')
    expect(render('production')).not.toContain('Secret')
    expect(render('draft')).toContain('Secret')
  })

  it('leaves the tree as it was', () => {
    const p = podlitePluggable()
    const tree = p.toAst(p.parse('=begin TITLE\nOne N<note>\n\n=item point\n=end TITLE\n', { podMode: 1 }))
    const before = JSON.stringify(tree)
    const exported = p.toAstResult(p.parse('=begin TITLE\nOne N<note>\n\n=item point\n=end TITLE\n', { podMode: 1 }))
    const kept = JSON.stringify(exported.interator)
    renderToStaticMarkup(<PodliteRaw tree={exported} />)
    expect(JSON.stringify(exported.interator)).toBe(kept)
    renderToStaticMarkup(<PodliteRaw tree={{ ...exported, interator: tree }} />)
    expect(JSON.stringify(tree)).toBe(before)
  })
})

describe('titleParts', () => {
  const p = podlitePluggable()
  const title = (src: string) => p.toAst(p.parse(src, { podMode: 1 })).content[0] as any

  it('gives the parts and the rest in the order of the source, with the nodes of the tree', () => {
    const node = title(
      '=begin TITLE\nFirst N<note>\n\n=begin code\nx\n=end code\n\n=alias A b\n\nSecond\n\n=item point\n=end TITLE\n',
    )
    const entries = titleParts(node)
    const kinds = entries.filter(entry => entry.kind === 'part' || (entry.node as any).type !== 'blankline')
    expect(
      kinds.map(entry =>
        entry.kind === 'part'
          ? 'part'
          : (entry.node as any).type === 'block'
          ? (entry.node as any).name
          : (entry.node as any).type,
      ),
    ).toEqual(['part', 'code', 'alias', 'part', 'list'])
    const first = entries[0] as { kind: 'part'; content: any[] }
    expect(first.content).toBe(node.content[0].content)
    const rest = entries.filter(entry => entry.kind === 'rest') as Array<{ kind: 'rest'; node: any }>
    rest.forEach(entry => expect(node.content).toContain(entry.node))
    expect(rest.map(entry => node.content.indexOf(entry.node))).toEqual(
      [...rest.map(entry => node.content.indexOf(entry.node))].sort((a, b) => a - b),
    )
    expect(JSON.stringify(entries.filter(entry => entry.kind === 'part'))).not.toContain('point')
  })
})

describe('what stays as it was', () => {
  it('writes another semantic block under its name', () => {
    expect(html('=SYNOPSIS Text\n')).toBe('<div><h1 class="SYNOPSIS">SYNOPSIS</h1><p>Text\n</p></div>')
  })

  it('hides the text of a masked title', () => {
    expect(html('=for TITLE :masked\nSecret\n')).not.toContain('Secret')
  })
})
