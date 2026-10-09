import { Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

type Mode = 'production' | 'draft'

const page = (body: string, mode: Mode = 'production', props = {}) =>
  renderToStaticMarkup(
    <Podlite renderMode={mode} {...props}>
      {`=begin pod\n\n${body}\n\n=end pod\n`}
    </Podlite>,
  )

const hidden = (body: string, words: string[], props = {}) => {
  const production = page(body, 'production', props)
  const draft = page(body, 'draft', props)
  for (const word of words) {
    expect(production).not.toContain(word)
    expect(draft).toContain(word)
  }
  return production
}

describe('text the page writes from a hidden block is hidden with it', () => {
  it('hides the caption of a table', () => {
    hidden("=begin table :caption('Dravo Sales') :masked\na b\n=end table", ['Dravo'])
  })

  it('hides the summary of a folded block', () => {
    hidden("=begin code :folded :caption('Trem') :masked\nx\n=end code", ['Trem'])
  })

  it('hides the title of a note block', () => {
    hidden("=begin nested :notice<note> :caption('Sarn') :masked\nbody\n=end nested", ['Sarn'])
  })

  it('hides the title of a table of contents', () => {
    hidden('=begin pod :masked\n=for toc :title<Tocz> :folded\nhead1\n\n=head1 x\n=end pod', ['Tocz'])
  })

  it('hides the caption of highlighted code', () => {
    hidden('=begin code :lang<javascript> :caption<Capz> :masked\nconst a = 1\n=end code', ['Capz'])
  })

  // a diagram and a formula are drawn in the browser, so the server output of a draft
  // carries the place for the drawing rather than its source
  it('hides a diagram and does not hand its source to the drawing', () => {
    const doc = "=begin Mermaid :caption('Quon') :masked\ngraph LR; Quonsrc-->B\n=end Mermaid"
    hidden(doc, ['Quon'])
    expect(page(doc)).toContain('<pre class="mermaid source">')
    expect(page(doc)).not.toContain('<div class="mermaid">')
    expect(page(doc, 'draft')).toContain('<div class="mermaid">')
  })

  it('hides a formula and does not hand its source to the typesetting', () => {
    const doc = "=begin formula :caption('Yelt') :masked\nYeltvar^2\n=end formula"
    hidden(doc, ['Yelt'])
    expect(page(doc)).toContain('████████')
    expect(page(doc)).not.toContain('<div class="formula"></div>')
    expect(page(doc, 'draft')).toContain('<div class="formula"></div>')
  })

  it('hides the alternative text of a picture', () => {
    hidden('=for picture :masked :alt<Altz>\nimg.png', ['Altz'])
  })

  it('hides the title and the file name written on a link', () => {
    hidden("=for para :masked\nL<words|https://example.org :title('Titz') :download('Dlz')>", ['Titz', 'Dlz'])
  })

  it('hides text kept with its spaces and characters written as codes', () => {
    hidden('=for para :masked\nS<Snib Space> and E<9731>E<alpha>', ['Snib', '☃', 'α'])
  })

  it('hides the kind of a note when it serves as the title', () => {
    const out = hidden('=begin nested :masked :notice<warning>\nBody\n=end nested', ['Warning'])
    expect(out).toContain('class="notify"')
  })

  it('hides the name a block written in capitals shows as its heading', () => {
    const out = page('=begin SECRETNAME :masked\nBody\n=end SECRETNAME')
    expect(out).toContain('>██████████</h1>')
    expect(page('=begin SECRETNAME :masked\nBody\n=end SECRETNAME', 'draft')).toContain('>SECRETNAME</h1>')
  })

  it('hides what a link preview shows of a hidden markdown block', () => {
    const linkPreview = (_target: string, found?: { text: string }) => (found ? <aside>{found.text}</aside> : null)
    hidden(
      '=head1 Open\n\n=begin markdown :masked\nSecretPreview **SecretBold**\n=end markdown\n\nSee L<jump|#Open>.',
      ['SecretPreview'],
      {
        linkPreview,
      },
    )
  })

  it('hides what a link preview shows of a hidden paragraph', () => {
    const linkPreview = (_target: string, found?: { text: string }) => (found ? <aside>{found.text}</aside> : null)
    hidden('=head1 Open\n\n=for para :masked\nSecretPreview words\n\nSee L<jump|#Open>.', ['SecretPreview'], {
      linkPreview,
    })
  })
})
