import { podlitePluggable } from '../src/pluggableParser'

// the parser of this package, so a run against its earlier source reads that source
const p = podlitePluggable()
const markdown = (doc: string) => String(p.toMarkdown(p.toAst(p.parse(doc, { podMode: 1 }))))

describe('a character reference in an address or a title in markdown output', () => {
  it('keeps the reference of a link address as written', () => {
    expect(markdown('=para L<ok|https://example.org/?a=&copy;>\n')).toContain('[ok](https://example.org/?a=\\&copy;)')
    expect(markdown('=para L<ok|https://example.org/?a=&#65;>\n')).toContain('(https://example.org/?a=\\&#65;)')
    expect(markdown('=para L<ok|https://example.org/?a=&#x41;>\n')).toContain('(https://example.org/?a=\\&#x41;)')
    expect(markdown('=para L<ok|https://example.org/?a=&amp;>\n')).toContain('(https://example.org/?a=\\&amp;)')
    expect(markdown('=para W<ok|https://example.org/?a=&copy;>\n')).toContain('(https://example.org/?a=\\&copy;)')
  })

  it('keeps the reference of an address in angle brackets', () => {
    expect(markdown('=para L<ok|https://example.org/a b?c=&copy;>\n')).toContain(
      '[ok](<https://example.org/a b?c=\\&copy;>)',
    )
  })

  it('doubles a backslash of the address', () => {
    expect(markdown('=para L<ok|file:./a\\&copy;>\n')).toContain('[ok](file:./a\\\\\\&copy;)')
  })

  it('keeps the reference of a picture address and its alternative text', () => {
    expect(markdown('=para P<cap|x.png?a=&copy;>\n')).toContain('![cap](x.png?a=\\&copy;)')
    expect(markdown('=para P<R&amp;D|x.png>\n')).toContain('![R\\&amp;D](x.png)')
  })

  it('keeps the reference and the backslash of a link title', () => {
    expect(markdown('=config L<> :title<R&amp;D>\n\n=para L<ok|https://example.org/>\n')).toContain(
      '[ok](https://example.org/ "R\\&amp;D")',
    )
    expect(markdown("=para L<ok|https://example.org/ :title('R&amp;D')>\n")).toContain(
      '[ok](https://example.org/ "R\\&amp;D")',
    )
    expect(markdown("=config L<> :title('R\\&amp;D')\n\n=para L<ok|https://example.org/>\n")).toContain(
      '[ok](https://example.org/ "R\\\\\\&amp;D")',
    )
  })
})

describe('what stays as it was', () => {
  it('writes an ampersand that starts no reference as it stands', () => {
    expect(markdown('=para L<ok|https://example.org/?a=1&b=2>\n')).toContain('(https://example.org/?a=1&b=2)')
    expect(markdown('=para L<ok|https://example.org/?a=&copy>\n')).toContain('(https://example.org/?a=&copy)')
    expect(markdown('=para L<ok|https://example.org/?a=&copy=2>\n')).toContain('(https://example.org/?a=&copy=2)')
    expect(markdown('=para L<ok|https://example.org/?a&>\n')).toContain('(https://example.org/?a&)')
  })

  it('writes a link to a heading of the document by its anchor', () => {
    expect(markdown('=head1 Fish & Chips\n\n=para L<ok|#Fish & Chips>\n')).toContain('[ok](#fish--chips)')
  })

  it('writes a link inside code as it was', () => {
    expect(markdown('=config C<> :allow<L>\n\n=para C<L<ok|https://example.org/?a=&copy;>>\n')).toContain(
      '`[ok](https://example.org/?a=&copy;)`',
    )
  })

  it('keeps the row of a table whose cell holds a link', () => {
    const doc =
      '=begin table\n=begin row :header\n=cell Link\n=cell Tail\n=end row\n=begin row\n=cell L<ok|https://example.org/?a=&copy;>\n=cell End\n=end row\n=end table\n'
    expect(markdown(doc)).toContain('| [ok](https://example.org/?a=\\&copy;) | End |')
  })
})
