import { podlitePluggable } from '../src/pluggableParser'

const doc = (src: string) => `=begin pod\n\n=head1 Setup\n\n${src}\n\n=end pod\n`

const html = (src: string): string => {
  const p = podlitePluggable()
  return String(p.toHtml(p.toAst(p.parse(doc(src), { podMode: 1 })))).replace(/\n/g, '')
}

const markdown = (src: string): string => {
  const p = podlitePluggable()
  return String(p.toMarkdown(p.toAst(p.parse(doc(src), { podMode: 1 })))).replace(/\n+/g, ' ')
}

describe('the address a link carries into an export', () => {
  it('reads a target written without a bar', () => {
    expect(html('L<#Setup>')).toContain('href="#Setup"')
    expect(html('L<plain>')).toContain('href="plain"')
    expect(markdown('L<plain>')).toContain('](plain)')
  })

  it('reads a target written after a bar', () => {
    expect(html('L<text|url>')).toContain('href="url"')
    expect(markdown('L<text|url>')).toContain('](url)')
  })

  it('reads a target on a backlink and keeps its class', () => {
    expect(html('W<term>')).toContain('href="term"')
    expect(html('W<term>')).toContain('class="backlink"')
  })

  // An `a` with no href is what HTML gives a link whose target the author never
  // wrote; an empty href would claim the current document instead.
  it('leaves out the address when the author gave none', () => {
    expect(html('L<>')).toContain('<a></a>')
    expect(html('L<>')).not.toContain('href')
    expect(html('W<>')).not.toContain('href')
  })

  it('carries no address into markdown when the author gave none', () => {
    expect(markdown('L<>')).not.toContain('](')
    expect(markdown('W<>')).not.toContain('](')
  })

  // the parser leaves the bar in the content here, so the tree says the target
  // is the text `|url`; splitting that is a question for the parser, not export
  it('takes the target the tree gives, bar and all', () => {
    expect(html('L<|url>')).toContain('href="|url"')
  })

  it('never writes the word undefined as an address', () => {
    for (const src of ['L<>', 'L<|url>', 'W<>']) {
      expect(html(src)).not.toContain('undefined')
      expect(markdown(src)).not.toContain('undefined')
    }
  })
})
