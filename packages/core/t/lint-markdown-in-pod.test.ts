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
