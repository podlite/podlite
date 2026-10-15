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

describe('a node the page cannot render is named without its content', () => {
  const capture = (channel: 'warn' | 'error', render: () => string) => {
    const spy = jest.spyOn(console, channel).mockImplementation(() => {})
    try {
      const html = render()
      return { html, log: spy.mock.calls.map(call => call.join(' ')) }
    } finally {
      spy.mockRestore()
    }
  }
  const fromTree = (node: object) => () =>
    renderToStaticMarkup(
      <Podlite tree={{ interator: { type: 'block', name: 'root', margin: '', content: [node] } } as never} />,
    )
  const secret = { type: 'text', value: 'SECRET743', guarded: true }

  it('names a block of a document that has no rule, on the page and in the log', () => {
    const { html, log } = capture('warn', () => page('=begin set :masked\nG<SECRET743>\n=end set'))
    expect(html).not.toContain('SECRET743')
    expect(html).not.toContain('"type"')
    expect(html).toContain('<code>not supported node set (block) at line 3</code>')
    expect(log).toEqual(['[to-jsx] not supported node set (block) at line 3'])
  })

  it('names a block of a given tree by name, type and line', () => {
    const node = { type: 'block', name: 'widget', margin: '', location: { start: { line: 12 } }, content: [secret] }
    const { html, log } = capture('warn', fromTree(node))
    expect(html).toBe('<code>not supported node widget (block) at line 12</code>')
    expect(log).toEqual(['[to-jsx] not supported node widget (block) at line 12'])
  })

  it('leaves out a place that is missing or not a number', () => {
    const plain = { type: 'block', name: 'widget', margin: '', content: [secret] }
    const odd = { ...plain, location: { start: { line: '12 SECRET743' } } }
    expect(capture('warn', fromTree(plain)).log).toEqual(['[to-jsx] not supported node widget (block)'])
    expect(capture('warn', fromTree(odd)).log).toEqual(['[to-jsx] not supported node widget (block)'])
  })

  it('names an item whose content is not a list without printing it', () => {
    const item = {
      type: 'block',
      name: 'item',
      margin: '',
      level: 1,
      location: { start: { line: 4 } },
      config: [{ name: 'masked', value: 1 }],
      content: 'SECRET743',
    }
    expect(capture('error', fromTree(item)).log).toEqual(['[to-jsx] item: content is not a list at line 4'])
  })
})

describe('text inside S<> in guillemets', () => {
  it('is drawn as text, with a guarded word hidden', () => {
    const production = page('S«a G<secret> b»')
    expect(production).not.toContain('[object Object]')
    expect(production).not.toContain('secret')
    expect(production.replace(/<\/?span[^>]*>/g, '')).toContain('a\u00a0██████\u00a0b')
    expect(page('S«a G<secret> b»', 'draft').replace(/<\/?span[^>]*>/g, '')).toContain('a\u00a0secret\u00a0b')
  })

  it('draws no comment', () => {
    expect(page('S«a Z<cmt> b»')).toContain('a\u00a0\u00a0b')
    expect(page('S«a Z<cmt> b»', 'draft')).toContain('a\u00a0\u00a0b')
  })
})
