import { podlitePluggable } from '../src/pluggableParser'

const render = (src: string): string => {
  const p = podlitePluggable()
  return String(p.toHtml(p.toAst(p.parse(src, { podMode: 1 })))).replace(/\n/g, '')
}

const textTable = (attrs: string) => render(`=begin table${attrs}\n A | B\n ==|==\n 1 | C<code> B<bold>\n=end table\n`)

describe(':allow on a table', () => {
  it('leaves the default untouched', () => {
    expect(textTable('')).toContain('<code>code</code>')
    expect(textTable('')).toContain('<strong>bold</strong>')
  })

  it('makes every cell literal when the set is empty', () => {
    const html = textTable(' :allow<>')
    expect(html).toContain('C&lt;code&gt;')
    expect(html).toContain('B&lt;bold&gt;')
  })

  it('keeps only the codes it names', () => {
    const html = textTable(' :allow<B>')
    expect(html).toContain('C&lt;code&gt;')
    expect(html).toContain('<strong>bold</strong>')
  })

  it('takes the set from =config', () => {
    const html = render('=config table :allow<>\n\n=begin table\n A | B\n ==|==\n 1 | C<code>\n=end table\n')
    expect(html).toContain('C&lt;code&gt;')
  })

  it('lets a cell override the table', () => {
    const html = render(
      '=begin table :allow<>\n=begin row\n=begin cell :allow<B>\nB<bold> C<code>\n=end cell\n=begin cell\nB<bold>\n=end cell\n=end row\n=end table\n',
    )
    expect(html).toContain('<strong>bold</strong> C&lt;code&gt;')
    expect(html).toContain('B&lt;bold&gt;')
  })

  it('lets a row override the table', () => {
    const html = render('=begin table :allow<>\n=begin row :allow<B>\n=cell B<bold> C<code>\n=end row\n=end table\n')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('C&lt;code&gt;')
  })

  it('holds the declaration to the table it is written on', () => {
    const html = render(
      '=begin table :allow<>\n A\n =\n C<one>\n=end table\n\n=begin table\n A\n =\n C<two>\n=end table\n',
    )
    expect(html).toContain('C&lt;one&gt;')
    expect(html).toContain('<code>two</code>')
  })
})
