import { scanSourceRules } from '../src/lint/grammar/scan'
import { ABBREVIATED_ATTRS_RULE_ID, abbreviatedAttrsRule } from '../src/lint/rules/abbreviated-attrs'

const check = (src: string) => scanSourceRules(src).filter(v => v.rule === ABBREVIATED_ATTRS_RULE_ID)

describe('abbreviated-attrs rule', () => {
  it('exposes stable slug and warning severity', () => {
    expect(ABBREVIATED_ATTRS_RULE_ID).toBe('abbreviated-attrs')
    expect(abbreviatedAttrsRule.severity).toBe('warning')
  })

  describe('reports a line that holds nothing but attributes', () => {
    it('names the block and points at the line', () => {
      const found = check('=item1 :id<X> :state<open>\nthe item content\n')
      expect(found).toHaveLength(1)
      expect(found[0].message).toContain('=item1')
      expect(found[0].location?.start.line).toBe(1)
    })

    it('offers the form that does take configuration', () => {
      expect(check('=item1 :id<X>\nthe item content\n')[0].message).toContain('=for item1')
    })

    it('catches a header marker written the short way', () => {
      expect(check('=table\n=row :header\n a | b\n')).toHaveLength(1)
    })

    it('reads a value written in any of the delimiters', () => {
      expect(check('=item1 :count(3)\ntext\n')).toHaveLength(1)
      expect(check('=item1 :spec{:a<1>}\ntext\n')).toHaveLength(1)
    })
  })

  describe('stays quiet where the markup is what the author meant', () => {
    it('leaves the paragraph form alone', () => {
      expect(check('=for item :id<X>\nthe item content\n')).toEqual([])
    })

    it('leaves the delimited form alone', () => {
      expect(check('=begin item :id<X>\nthe item content\n=end item\n')).toEqual([])
    })

    it('leaves a line that mixes attributes with prose', () => {
      expect(check('=defn :id<term-1> Concept name\nthe meaning\n')).toEqual([])
    })

    it('leaves an attribute written with nothing inside', () => {
      expect(check('=item1 :type<>\ndocumenting the attribute itself\n')).toEqual([])
      expect(check('=item1 :type<> :state<>\ntwo of them\n')).toEqual([])
    })

    it('leaves a block whose name carries both cases', () => {
      expect(check('=Confidence :level<high>\nthe reasoning\n')).toEqual([])
    })

    it('leaves an example written inside a code block', () => {
      expect(check('=begin code :lang<podlite>\n=item1 :id<X>\ntext\n=end code\n')).toEqual([])
    })

    it('leaves a line with no content under it', () => {
      expect(check('=item1 :id<X>\n\ntext after a blank line\n')).toEqual([])
      expect(check('=item1 :id<X>\n=item1 next block\n')).toEqual([])
    })

    it('leaves a document that writes no attributes at all', () => {
      expect(check('=head1 Title\n\n=item1 first\n=item1 second\n')).toEqual([])
    })
  })
})
