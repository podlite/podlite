import { toHtml, toMarkdown } from '../src'

const doc = (body: string) => `=begin pod\n${body}\n=end pod`
const html = (body: string) => toHtml({}).run(doc(body)).toString()
const markdown = (body: string) => toMarkdown({}).run(doc(body)).toString()

describe('=alias substitution', () => {
  it('puts the replacement in place of the code', () => {
    expect(html('=alias SIGN pear\n\n=para\nA<SIGN> and more')).toContain('pear and more')
  })

  it('substitutes in markdown too', () => {
    expect(markdown('=alias SIGN pear\n\n=para\nA<SIGN> and more')).toContain('pear and more')
  })

  it('keeps the replacement markup', () => {
    expect(html('=alias SIGN B<pear>\n\n=para\nA<SIGN>')).toContain('<strong>pear</strong>')
  })

  it('writes an undeclared name as it stands', () => {
    expect(html('=para\nA<MISSING>')).toContain('A&lt;MISSING&gt;')
  })

  it('a declaration inside a block does not reach what follows it', () => {
    const out = html('=begin nested\n=alias SIGN pear\n\n=para\nA<SIGN>\n=end nested\n\n=para\nA<SIGN>')
    expect(out).toContain('pear')
    expect(out).toContain('A&lt;SIGN&gt;')
  })
})
