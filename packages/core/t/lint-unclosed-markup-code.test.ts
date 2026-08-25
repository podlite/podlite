import { scanSourceRules } from '../src/lint/grammar/scan'
import { UNCLOSED_MARKUP_CODE_RULE_ID, unclosedMarkupCodeRule } from '../src/lint/rules/unclosed-markup-code'

const check = (src: string) => scanSourceRules(src).filter(v => v.rule === UNCLOSED_MARKUP_CODE_RULE_ID)

describe('unclosed-markup-code rule', () => {
  it('exposes stable slug and warning severity', () => {
    expect(UNCLOSED_MARKUP_CODE_RULE_ID).toBe('unclosed-markup-code')
    expect(unclosedMarkupCodeRule.severity).toBe('warning')
  })

  describe('reports a code the block had to close', () => {
    it('catches one broken off by a blank line', () => {
      const found = check('Pairs like B<key=value are separated by a space.\n\nnext paragraph\n')
      expect(found).toHaveLength(1)
      expect(found[0].message).toContain('B<>')
    })

    it('catches one broken off by the end of the block', () => {
      expect(check('=begin pod\n\nText before. C<unclosed to the end\n\n=end pod\n')).toHaveLength(1)
    })

    it('catches a doubled bracket closed by a single one', () => {
      expect(check('Doubled: B<< unclosed double code.\n')).toHaveLength(1)
    })

    it('catches a guillemet with no closing guillemet', () => {
      expect(check('Guillemets: B«unclosed code.\n')).toHaveLength(1)
    })

    it('catches one in an abbreviated block', () => {
      expect(check('=head1 Heading with B<unclosed code\n')).toHaveLength(1)
    })

    // an angle after a capital reads as markup whatever the prose meant by it;
    // no document in the corpus writes a comparison that way
    it('takes a capital before an angle as an opening, not as a comparison', () => {
      expect(check('The guard holds while A<B and nothing else.\n')).toHaveLength(1)
    })

    it('points at the line the code was opened on', () => {
      const found = check('=begin pod\n\nfirst line\nsecond with B<unclosed\nthird line\n\n=end pod\n')
      expect(found[0].location?.start.line).toBe(4)
    })
  })

  describe('stays quiet on markup that is whole', () => {
    it('leaves a code closed by its own bracket', () => {
      expect(check('Pairs like B<key=value> are separated by a space.\n')).toEqual([])
    })

    it('leaves an angle used as a plain sign', () => {
      expect(check('Plain compare: if a < b then all is well.\n')).toEqual([])
    })

    it('leaves a doubled bracket closed by its pair', () => {
      expect(check('Doubled: C<< text >> and more.\n')).toEqual([])
    })

    it('leaves a single code written inside a doubled one', () => {
      expect(check('Replace C<< **x** >> with C<< B<x> >> everywhere.\n')).toEqual([])
    })

    it('leaves a code named by writing it empty', () => {
      expect(check('=TITLE ADR: P<> Inline Picture Markup Attribute Syntax\n')).toEqual([])
      expect(check('The code C<> names itself.\n')).toEqual([])
    })

    it('leaves an example inside a block kept as written', () => {
      expect(check('=begin code\ntext with B<unclosed\n=end code\n')).toEqual([])
    })

    it('leaves the same example written in the short forms of that block', () => {
      expect(check('=for code\ntext with B<unclosed\n')).toEqual([])
      expect(check('=code text with B<unclosed\n')).toEqual([])
    })

    it('reads the line after such a block again', () => {
      expect(check('=for code\nkept as written B<here\n\nprose with C<unclosed\n')).toHaveLength(1)
    })

    it('leaves a document with no markup codes at all', () => {
      expect(check('=head1 Title\n\nplain prose only\n')).toEqual([])
    })
  })
})
