import { TestPodlite as Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const render = (body: string) => renderToStaticMarkup(<Podlite>{`=begin pod\n${body}\n=end pod\n`}</Podlite>)

const inner = (html: string) => html.replace(/^<div id="[^"]*">/, '').replace(/<\/div>$/, '')

const count = (html: string, what: string) => html.split(what).length - 1

const blocks = {
  nested: (attrs: string) => `=begin nested ${attrs}\nInner text\n=end nested`,
  para: (attrs: string) => `=for para ${attrs}\nPara text`,
  code: (attrs: string) => `=begin code ${attrs}\nlet x = 1\n=end code`,
}

// markup each block has without the attribute
const plain = {
  nested: '<blockquote><p>Inner text\n</p></blockquote>',
  para: '<div id="id"><p>Para text\n</p></div>',
  code: '<div class="code-block"><pre id="id"><code>let x = 1\n</code></pre></div>',
}

describe(':folded attribute on paragraph, code and nested blocks', () => {
  for (const [name, block] of Object.entries(blocks)) {
    it(`${name} with :folded renders a closed <details>`, () => {
      const html = render(block(':folded'))
      expect(html).toContain('<details class="folded">')
      expect(count(html, '<details')).toBe(1)
    })

    it(`${name} with :!folded renders an open <details>`, () => {
      expect(render(block(':!folded'))).toContain('<details class="folded" open="">')
    })

    it(`${name} without :folded keeps its markup`, () => {
      expect(inner(render(block('')))).toBe(plain[name])
    })

    it(`${name} with :folded wraps the markup it has without the attribute`, () => {
      expect(inner(render(block(':folded')))).toBe(
        `<details class="folded"><div class="folded-content">${plain[name]}</div></details>`,
      )
    })

    it(`${name} with :folded and no :caption has no summary`, () => {
      const html = render(block(':folded'))
      expect(html).toContain('<details class="folded">')
      expect(html).not.toContain('<summary')
    })

    it(`${name} with :folded and :caption shows the caption as summary`, () => {
      expect(render(block(':folded :caption<Details>'))).toContain('<summary class="folded-summary">Details</summary>')
    })
  }

  it('=config para :folded folds an explicit and an implicit paragraph once each', () => {
    const html = render('=config para :folded\n\n=for para\nExplicit text\n\nImplicit text\n')
    expect(count(html, '<details class="folded">')).toBe(2)
    expect(html).toMatch(/<details class="folded"><div class="folded-content"><div[^>]*><p>Explicit text/)
    expect(html).toMatch(/<details class="folded"><div class="folded-content"><p>Implicit text/)
  })

  it('=config para :folded folds each description of a definition inside its <dd>', () => {
    const html = render('=config para :folded\n\n=begin defn\nTerm\nDescription\n\nSecond description\n=end defn\n')
    expect(html).toContain('<dt>Term</dt>')
    expect(html.match(/<dd[^>]*><details class="folded">/g)).toHaveLength(2)
    expect(html).toMatch(/<dd[^>]*><details class="folded"><div class="folded-content">Description/)
  })

  it('=config code :folded folds a code block and indented code', () => {
    const html = render('=config code :folded\n\n=begin code\nlet x = 1\n=end code\n\n    let y = 2\n')
    expect(count(html, '<details class="folded">')).toBe(2)
  })

  it('=config nested :folded folds a nested block once', () => {
    const html = render('=config nested :folded\n\n=begin nested\nInner text\n=end nested\n')
    expect(count(html, '<details')).toBe(1)
    expect(html).toContain('<details class="folded">')
  })

  it('=set :!folded opens a block folded by =config', () => {
    const html = render('=config para :folded\n\n=set :!folded\n=for para\nOpened text\n')
    expect(html).toContain('<details class="folded" open="">')
  })

  it('a paragraph with :nested and :folded keeps the nesting inside the fold', () => {
    expect(inner(render('=for para :nested :folded\nPara text'))).toBe(
      '<details class="folded"><div class="folded-content"><blockquote><div id="id"><p>Para text\n</p></div></blockquote></div></details>',
    )
  })

  it('masks the summary of a folded nested block that is masked', () => {
    const html = render("=begin nested :folded :caption('Sarn') :masked\nbody\n=end nested")
    expect(html).toContain('<details class="folded"><summary class="folded-summary">████</summary>')
    expect(html).not.toContain('Sarn')
  })
})

describe(':folded keeps the form of blocks that fold on their own', () => {
  it('a notice block keeps a single wrapper', () => {
    const html = render('=begin nested :notice<warning> :folded\nWarn\n=end nested')
    expect(count(html, '<details')).toBe(1)
    expect(html).toContain('<details class="notify warning folded">')
  })

  it('a table keeps a single wrapper', () => {
    const html = render('=for table :folded :caption<Cap>\n a | b')
    expect(count(html, '<details')).toBe(1)
    expect(html).toContain('<details class="folded table-folded">')
  })

  it('a heading keeps a single wrapper', () => {
    const html = render('=for head1 :folded\nTitle\n\nBody text')
    expect(count(html, '<details')).toBe(1)
    expect(html).toContain('<details class="folded-section">')
  })
})
