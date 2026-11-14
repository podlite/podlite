import { lintSource } from '../src/lint'

const lint = (src: string) => lintSource(src, 'doc.podlite', {})
const linesOf = (src: string, rule: string) =>
  lint(src)
    .violations.filter(v => v.rule === rule)
    .map(v => v.location?.start.line)
const mip = (src: string) => linesOf(src, 'markdown-in-pod')
const unclosed = (src: string) => linesOf(src, 'unclosed-markup-code')

describe('markdown-in-pod in a verbatim block written the short way', () => {
  it.each([
    ['=for code', '=for code\n# c\n**b**\n'],
    ['=for markdown', '=for markdown\n# Title\n'],
    ['=for input', '=for input\n## x\n'],
    ['=for data', '=for data\n# x\n'],
    ['a named block', '=for MyBlock\n# x\n'],
    ['=code with its body below', '=code\n# c\n**b**\n'],
    ['=code with text on its line', '=code **b**\n# c\n'],
    ['=markdown with text on its line', '=markdown **b**\n'],
    ['a continued configuration', '=for code\n= :lang<perl>\n# c\n'],
    ['a line of = and digits in the body', '=for code\n=123\n**body**\n'],
    ['CRLF', '=for code\r\n# c\r\n**b**\r\n'],
  ])('is silent in %s', (_, src) => {
    expect(mip(src)).toEqual([])
  })

  it.each([
    ['after a blank line', '=for code\n# c\n\n# heading\n', [4]],
    ['after a line of spaces and a tab', '=for code\n# c\n \t\n# heading\n', [4]],
    ['on the next directive', '=for code\n# c\n=head1 **x**\n', [3]],
    ['in a delimited block that follows', '=for code\n# c\n=begin pod\n# h\n=end pod\n', [4]],
    ['in a heading', '=head1 **x**\n', [1]],
    ['in the paragraph after a table', '=for table\na|b\n--|--\n\n**b**\n', [5]],
    ['on a table separator after a continued configuration, as before', '=for table\n= :caption<x>\na|b\n--|--\n', [4]],
    ['in the configuration of a short code block', '=for code :caption<**bad**>\nbody\n', [1]],
    ['in the second line of a continued configuration', '=for code\n= :lang<perl>\n= :caption<**bad**>\nbody\n', [3]],
    ['in a continued configuration written with no space after =', '=for code\n=:caption<**bad**>\nbody\n', [2]],
    ['in an item after its lone #', '=for item\n# x\n\n# y\n', [4]],
    ['after =for and a tab, which opens no block', '=for\tcode\n**body**\n', [2]],
    ['after =for and two spaces, which opens no block', '=for  code\n**body**\n', [2]],
    ['after =for code with text in place of configuration', '=for code **b**\n**outside**\n', [1, 2]],
    ['after a table and the =end of its container', '=begin pod\n=for table\na|b\n--|--\n=end pod\n**outside**\n', [6]],
    ['after =for code with an attribute and text after it', '=for code :lang<perl> **bad**\n**body**\n', [1, 2]],
    ['after =for code and a lone colon', '=for code :\n**body**\n', [2]],
  ])('warns again %s', (_, src, lines) => {
    expect(mip(src)).toEqual(lines)
  })
})

describe('unclosed-markup-code in code', () => {
  it.each([
    ['a short code block with a continued configuration', '=for code\n= :lang<perl>\n# c\nB<open\n'],
    ['implicit code in =begin pod', '=begin pod\ntext\n\n  B<open\n=end pod\n'],
    ['implicit code in =pod', '=pod\n\ntext\n\n  B<open\n'],
    ['implicit code in =begin item', '=begin item\nfirst\n\n  B<open\n=end item\n'],
    ['implicit code with CRLF', '=begin pod\r\ntext\r\n\r\n  B<open\r\n=end pod\r\n'],
    ['implicit code on the last line without a newline', 'text\n\n  B<open'],
    ['a short code block with a line of =begin after a no-break space', '=for code\n\u00a0=begin para\nB<open\n'],
    ['a short code block with a line of =end after a no-break space', '=for code\n\u00a0=end pod\nB<open\n'],
    ['=code with a line separator in its text', '=code a\u2028b\n**body** B<open\n'],
    ['=for code with a line separator in a value', '=for code :caption("a\u2028b")\n**body** B<open\n'],
    ['=code with no newline at the end', '=code **body**'],
    ['a body line of = and a no-break space', '=for code\n=\u00a0**bad**\nB<open\n'],
    ['=for code with a continued configuration and no newline at the end', '=for code\n= :lang<perl>\n# c'],
    ['=for formula', '=for formula\n# body\n'],
    ['a named block of another name', '=for Weird-Name\n# x\n'],
    ['Markdown in a short code block that allows B', '=for code\n= :allow<B>\n**md**\n'],
    ['a code block with an =end of another name inside', '=begin code\n**b**\n=end Recipe\n**c** B<open\n=end code\n'],
  ])('is silent in %s', (_, src) => {
    expect(lint(src).violations).toEqual([])
  })

  it.each([
    ['after implicit code', '=begin pod\n  B<code\n=para B<outside\n=end pod\n', [3]],
    ['in a paragraph', '=para B<open\n', [1]],
    ['in indented text of a semantic block, read as text', '=begin SYNOPSIS\nfirst\n\n  B<open\n=end SYNOPSIS\n', [4]],
    ['in indented text of an abbreviated item', '=item first\n  B<open\n', [2]],
  ])('warns %s', (_, src, lines) => {
    expect(unclosed(src)).toEqual(lines)
  })

  it('reports a mute it no longer needs', () => {
    const report = lint('=begin pod :lint-ignore<unclosed-markup-code>\ntext\n\n  B<open\n=end pod\n')
    expect(report.silenced).toBe(0)
    expect(report.violations.map(v => [v.rule, v.message])).toEqual([
      ['lint-ignore', ':lint-ignore<unclosed-markup-code> silenced nothing here'],
    ])
  })
})

it('leaves the report of a document with a lone carriage return as it was', () => {
  expect(lint('=for code\rB<open\r').violations).toEqual([])
  expect(lint('  code\r**text**\r').violations.map(v => v.rule)).toEqual(['markdown-in-pod'])
})

it('keeps only the warning about the dropped attribute in a short code block the parser keeps', () => {
  expect(lint('=for code :lang<perl\n**body** B<open\n').violations.map(v => v.rule)).toEqual(['attr-value-dropped'])
})

describe('warnings the code does not hide', () => {
  it.each([
    [
      'in the cells of a table with a continued configuration',
      '=for table\n= :caption<x>\nB<open | **bold**\n',
      [
        ['markdown-in-pod', 3],
        ['unclosed-markup-code', 3],
      ],
    ],
    ['an open code a short code block allows', '=for code\n= :allow<B>\nB<open\n', [['unclosed-markup-code', 3]]],
    [
      'an open code implicit code allows through =config',
      '=config code :allow<B>\n\n  B<open\n',
      [['unclosed-markup-code', 3]],
    ],
  ])('%s', (_, src, found) => {
    expect(lint(src).violations.map(v => [v.rule, v.location?.start.line])).toEqual(found)
  })
})
