import { lintSource } from '../src/lint'
import { scanSourceRules } from '../src/lint/grammar/scan'
import { MARKDOWN_IN_POD_RULE_ID, markdownInPodRule } from '../src/lint/rules/markdown-in-pod'

const check = (src: string) => scanSourceRules(src).filter(v => v.rule === MARKDOWN_IN_POD_RULE_ID)

describe('markdown-in-pod rule', () => {
  it('exposes stable slug and warning severity', () => {
    expect(MARKDOWN_IN_POD_RULE_ID).toBe('markdown-in-pod')
    expect(markdownInPodRule.severity).toBe('warning')
  })

  describe('names the construct that will arrive as text', () => {
    it('catches a heading written with hashes', () => {
      const found = check('# Heading\n\ntext\n')
      expect(found).toHaveLength(1)
      expect(found[0].message).toContain('=head1')
    })

    it('catches it at every hash depth', () => {
      expect(check('### Deeper heading\n\ntext\n')).toHaveLength(1)
    })

    it('catches a pair of asterisks', () => {
      const found = check('Some **bold** words.\n')
      expect(found).toHaveLength(1)
      expect(found[0].message).toContain('B<>')
    })

    it('catches a row of bars and dashes', () => {
      const found = check('| a | b |\n|---|---|\n| 1 | 2 |\n')
      expect(found).toHaveLength(1)
      expect(found[0].message).toContain('=begin table')
    })

    it('gives one warning per line, not one per construct', () => {
      expect(check('# **Heading**\n\ntext\n')).toHaveLength(1)
    })
  })

  describe('stays quiet where the markup is legal or shown', () => {
    it('leaves a block that keeps its content as written', () => {
      expect(check('=begin code :lang<sh>\n# a shell comment\necho **x**\n=end code\n')).toEqual([])
    })

    it('leaves embedded data alone', () => {
      expect(check('=begin data :key<rows>\n| a | b |\n|---|---|\n=end data\n')).toEqual([])
    })

    it('leaves the separator of a real table alone', () => {
      expect(check('=begin table\n a | b\n ---|---\n 1 | 2\n=end table\n')).toEqual([])
    })

    it('leaves the separator of a table written the short way', () => {
      expect(check('=table\n a | b\n ---|---\n 1 | 2\n')).toEqual([])
    })

    it('leaves a line that shows the markup inside a code span', () => {
      expect(check('A heading in markdown is C<# Title>, here it is =head1.\n')).toEqual([])
      expect(check('Bold in markdown is C<**word**>.\n')).toEqual([])
    })

    it('leaves a single asterisk alone', () => {
      expect(check('One * star and another * star.\n')).toEqual([])
    })

    it('leaves a document written in Podlite', () => {
      expect(
        check('=head1 Title\n\nSome B<bold> words.\n\n=begin table\n a | b\n =====|=====\n 1 | 2\n=end table\n'),
      ).toEqual([])
    })
  })
})

describe('the rule belongs to Podlite documents', () => {
  it('says nothing about a markdown file, where markdown is the language', () => {
    const src = '# Heading\n\nSome **bold** words.\n\n| a | b |\n|---|---|\n'
    expect(scanSourceRules(src, 'md').filter(v => v.rule === MARKDOWN_IN_POD_RULE_ID)).toEqual([])
  })

  it('reads the same text as foreign in a Podlite document', () => {
    const src = '# Heading\n\nSome **bold** words.\n\n| a | b |\n|---|---|\n'
    expect(scanSourceRules(src, 'podlite').filter(v => v.rule === MARKDOWN_IN_POD_RULE_ID).length).toBeGreaterThan(0)
  })
})

describe('markdown-in-pod and a lone # that starts an item, a heading or a definition', () => {
  const HEADING = 'a heading written with hashes is text here; write =head1 and its levels'
  const BOLD = 'a pair of asterisks is text here; bold is written as B<>'
  const lines = (src: string) => check(src).map(v => [v.location?.start.line, v.message])

  describe('leaves the # that numbers the block or stands for itself', () => {
    it.each([
      ['=for item1', '=for item1\n# Retreat to remote Himalayan monastery\n'],
      ['=for item :!numbered', '=for item :!numbered\n# introduces a comment\n'],
      ['=begin item', '=begin item\n# first\n=end item\n'],
      ['=for head1', '=for head1\n# The Problem\n'],
      ['=begin head1', '=begin head1\n# title\n=end head1\n'],
      ['=item1 with nothing after it', '=item1\n# Visito\n'],
      ['=item1 with trailing spaces', '=item1   \n# Visito\n'],
      ['=item2 under a parent', '=item1 one\n\n=item2\n# Veni\n'],
      ['=head86', '=head86\n# deep\n'],
      ['a bare =head', '=head\n# title\n'],
      ['=for defn', '=for defn\n# TERM\nDefinition.\n'],
      ['=defn', '=defn\n# TERM\nDefinition.\n'],
      ['=begin defn', '=begin defn\n# TERM\nDefinition.\n=end defn\n'],
      ['=for item1 :numbered', '=for item1 :numbered\n# x\n'],
      ['a continuation line', '=for item1\n= :caption<y>\n# x\n'],
      ['a value over two lines', '=for item :caption(\n= "a b")\n# first\n'],
      ['an indented marker', '  =for item\n  = :x<y>\n  # first\n'],
      ['an item inside =begin pod', '=begin pod\n\n=for item1\n# first\n\n=end pod\n'],
      ['a blank line inside =begin item', '=begin item\n\n# first\n=end item\n'],
      ['a line of spaces inside =begin item', '=begin item\n \t\n# first\n=end item\n'],
      ['a new marker after =for item', '=for item\n=for head1\n# title\n'],
      ['=config inside =begin item', '=begin item\n=config para :lang<en>\n# first\n=end item\n'],
      ['=config inside =begin head1', '=begin head1\n=config para :lang<en>\n# first\n=end head1\n'],
      ['=alias inside =begin item', '=begin item\n=alias X word\n# A<X>\n=end item\n'],
      ['=set inside =begin item', '=begin item\n=set :lang<en>\n# first\n=end item\n'],
      ['an =alias over two lines inside =begin item', '=begin item\n  =alias X one\n  = two\n# A<X>\n=end item\n'],
    ])('after %s', (_, src) => {
      expect(lines(src)).toEqual([])
    })

    it('still reports bold on that line', () => {
      expect(lines('=for item\n# **bold**\n')).toEqual([[2, BOLD]])
    })

    it('reports only the second # with CRLF lines', () => {
      expect(lines('=for item\r\n# first\r\n# second\r\n')).toEqual([[3, HEADING]])
    })
  })

  describe('reports every other #', () => {
    it.each<[string, string, number]>([
      ['outside any block', '=pod\n\n# Heading\n', 3],
      ['on the second line of an item', '=for item1\nfirst\n# second\n', 3],
      ['after text on the line of =item1', '=item1 text\n# x\n', 2],
      ['after an option on the line of =item', '=item :numbered\n# second\n', 2],
      ['in the definition after its term', '=for defn\nTERM\n# definition\n', 3],
      ['after a blank line that ends =for item', '=for item\n\n# outside\n', 3],
      ['after a blank line that ends =item', '=item\n\n# outside\n', 3],
      ['in the second paragraph of =begin item', '=begin item\nfirst\n\n# second\n=end item\n', 4],
      ['after =end item', '=begin item\n=end item\n# outside\n', 3],
      ['after a first line in code', '=begin item\nC<first>\n# second\n=end item\n', 3],
      ['in a paragraph', '=for para\n# x\n', 2],
      ['after the text of a heading', '=head3 tst\n# Part Activations\n', 2],
      ['after =config ends =for item', '=for item\n=config para :lang<en>\n# outside\n', 3],
      ['after =config once the item has begun', '=begin item\nfirst\n=config para :lang<en>\n# second\n=end item\n', 4],
      ['on the second line of an item with CRLF lines', '=for item\r\nfirst\r\n# second\r\n', 3],
    ])('%s', (_, src, line) => {
      expect(lines(src)).toEqual([[line, HEADING]])
    })

    it.each(['##', '###', '####', '#####', '######'])('%s at the start of an item', hashes => {
      expect(lines(`=for item\n${hashes} heading\n`)).toEqual([[2, HEADING]])
    })
  })
})

describe('markdown-in-pod and implicit code', () => {
  const report = (src: string) =>
    lintSource(src, 'doc.podlite', {}).violations.map(v => [v.rule, v.location?.start.line, v.message.slice(0, 24)])
  const mip = (src: string) => report(src).filter(([rule]) => rule === MARKDOWN_IN_POD_RULE_ID)

  describe('leaves the lines the parser reads as implicit code', () => {
    it.each([
      ['=begin pod', '=begin pod\ntext\n\n  # comment\n=end pod\n'],
      ['=pod', '=pod\n\ntext\n\n  # comment\n'],
      ['=begin item', '=begin item\nfirst\n\n  # comment\n=end item\n'],
      ['=begin nested', '=begin nested\ntext\n\n  # comment\n=end nested\n'],
      ['=begin defn', '=begin defn\nTERM\nBody.\n\n  # comment\n=end defn\n'],
      ['bold in =begin pod', '=begin pod\ntext\n\n  **bold**\n=end pod\n'],
      ['code after =end para', '=begin pod\n=begin para\nx\n=end para\n  **code**\n=end pod\n'],
      ['code after =set', '=begin pod\n=set :lang<en>\n  **code**\n=end pod\n'],
      ['a code line without an indent', '=begin pod\ntext\n\n  first\n# second\n=end pod\n'],
      ['the last line without a newline', 'first\n\n  **code**'],
      ['CRLF lines', '=begin pod\r\ntext\r\n\r\n  # comment\r\n=end pod\r\n'],
    ])('in %s', (_, src) => {
      expect(mip(src)).toEqual([])
    })

    it('drops only its warning in a block left open, and keeps the others', () => {
      const found = lintSource('=begin pod\ntext\n\n  # comment\n', 'doc.podlite', {}).violations
      expect(found.map(v => [v.rule, v.severity, v.location?.start.line, v.message])).toEqual([
        ['delimited-block-balance', 'error', 1, '=begin pod is not closed before end of file'],
        ['syntax-valid', 'warning', 1, 'Line could not be parsed as a directive or block: =begin pod'],
      ])
    })
  })

  describe('keeps every other warning', () => {
    it.each([
      ['a heading without an indent', '=begin pod\n# heading\n=end pod\n', 2],
      ['indented text in =begin para', '=begin para\nfirst\n\n  # x\n=end para\n', 4],
      ['indented text in a semantic block, read as text', '=begin SYNOPSIS\nfirst\n\n  # x\n=end SYNOPSIS\n', 4],
      ['a line after the code ends at its first column', '=begin pod\n  code\n=head1 **text**\n=end pod\n', 3],
      ['a paragraph after code', '=begin pod\nfirst\n\n  **code**\n=para **text**\n=end pod\n', 5],
    ])('%s', (_, src, line) => {
      expect(mip(src).map(([, at]) => at)).toEqual([line])
    })

    it('keeps the whole report of a document with a lone carriage return', () => {
      const found = lintSource('  code\r=head1 **text**\r', 'doc.podlite', {}).violations
      expect(found.map(v => [v.rule, v.severity, v.location?.start.line, v.message])).toEqual([
        ['markdown-in-pod', 'warning', 1, 'a pair of asterisks is text here; bold is written as B<>'],
      ])
    })

    it('keeps the order of the warnings around a line of code', () => {
      const found = report('=head1 **a**\n\n=begin pod\ntext\n\n  B<broken **bold**\n=end pod\n\n=para **b**\n')
      expect(found.map(([rule, line]) => [rule, line])).toEqual([
        [MARKDOWN_IN_POD_RULE_ID, 1],
        [MARKDOWN_IN_POD_RULE_ID, 9],
      ])
    })

    it('keeps the lone # of an item and warns about the next paragraph', () => {
      expect(mip('=for item1\n# x\n\n# y\n').map(([, at]) => at)).toEqual([4])
    })
  })

  it('counts a mute on the warnings it no longer has to silence as unused', () => {
    const { violations, silenced } = lintSource(
      '=begin pod :lint-ignore<markdown-in-pod>\ntext\n\n  **code**\n=end pod\n',
      'doc.podlite',
      {},
    )
    expect(violations.filter(v => v.rule === MARKDOWN_IN_POD_RULE_ID)).toEqual([])
    expect(silenced).toBe(0)
    expect(violations.map(v => [v.rule, v.message])).toEqual([
      ['lint-ignore', ':lint-ignore<markdown-in-pod> silenced nothing here'],
    ])
  })
})
