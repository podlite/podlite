import { lintSource } from '../src/lint'

// one line per rule that sets off its warning, and nothing else in the document does
const TRIGGER: Record<string, string> = {
  'markdown-in-pod': '**bold**',
  'unclosed-markup-code': 'B<open',
  'abbreviated-attrs': '=head1 :id<x>\nText.',
}

const lint = (src: string) => lintSource(src, 'doc.podlite', {})
const placesOf = (src: string, rule: string) =>
  lint(src)
    .violations.filter(v => v.rule === rule)
    .map(v => v.location)
// the location of a warning set off by the line at that index, written out by hand
const at = (index: number, line: number) => {
  const place = { line, column: 1, offset: index }
  return { start: place, end: place }
}

describe('the warnings of the rules that read the source', () => {
  describe.each(Object.keys(TRIGGER))('%s', rule => {
    const trigger = TRIGGER[rule]
    const doc =
      `=para before\n\n=begin pod :lint-ignore<${rule}>\n` +
      `text\n\n${trigger}\n=end pod\n\n=para after\n\n${trigger}\n`

    it('is silenced in the middle of a file only inside the muting block', () => {
      const report = lint(doc)
      expect(report.silenced).toBe(1)
      expect(report.violations.map(v => v.rule)).toEqual([rule])
      const outside = doc.lastIndexOf(trigger)
      expect(report.violations[0].location).toEqual(at(outside, doc.slice(0, outside).split('\n').length))
    })

    it('is not silenced after a muting block at the start of the file', () => {
      const src = `=begin pod :lint-ignore<${rule}>\ntext\n=end pod\n\n${trigger}\n`
      const report = lint(src)
      expect(report.violations.map(v => v.rule)).toEqual([rule, 'lint-ignore'])
      expect(report.violations[0].location).toEqual(at(src.indexOf(trigger), 5))
    })
  })

  describe('places a warning at the start of its line', () => {
    it.each([
      ['the first line of the file', '**bold**\n', 0, 1],
      ['a line after LF', 'text\n\n**bold**\n', 6, 3],
      ['a line after CRLF', 'text\r\n\r\n**bold**\r\n', 8, 3],
      ['an indented line in a paragraph', 'text\n  more **bold**\n', 5, 2],
      ['a tab on the line before', 'a\tb\n\n**bold**\n', 5, 3],
      ['the last line without a newline', 'text\n\n**bold**', 6, 3],
      ['a character of two code units before, LF', '😀\n\n**bold**\n', 4, 3],
      ['a character of two code units before, CRLF', '😀\r\n\r\n**bold**\r\n', 6, 3],
      ['a byte order mark before text', '\uFEFFtext\n\n**bold**\n', 7, 3],
    ])('%s', (_, src, offset, line) => {
      expect(placesOf(src, 'markdown-in-pod')).toEqual([at(offset, line)])
    })

    it.each([
      ['LF', '=para first\n\nB<one\nplain\nI<two\n', 13, 25],
      ['CRLF', '=para first\r\n\r\nB<one\r\nplain\r\nI<two\r\n', 15, 29],
    ])('gives each unclosed code of one paragraph the start of its own line, %s', (_, src, first, second) => {
      expect(placesOf(src, 'unclosed-markup-code')).toEqual([at(first, 3), at(second, 5)])
    })

    it.each([
      ['LF', '=para x\n\n=head1 :id<x>\nText.\n', 9],
      ['CRLF', '=para x\r\n\r\n=head1 :id<x>\r\nText.\r\n', 11],
      ['its content on the last line without a newline', '=para x\r\n\r\n=head1 :id<x>\r\nText.', 11],
    ])('places an abbreviated block with attributes on its own line, %s', (_, src, offset) => {
      expect(placesOf(src, 'abbreviated-attrs')).toEqual([at(offset, 3)])
    })
  })

  it('keeps a warning when a byte order mark stands right before the muting block', () => {
    const src = '\uFEFF=begin pod :lint-ignore<markdown-in-pod>\n**bold**\n=end pod\n'
    expect(lint(src).violations.filter(v => v.rule === 'markdown-in-pod')).toHaveLength(1)
  })
})
