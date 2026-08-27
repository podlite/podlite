import { podlite } from '../src/index'
import { parseContent } from '../src/lint/loader'
import { linkNotEmptyRule, LINK_NOT_EMPTY_RULE_ID } from '../src/lint/rules/link-not-empty'
import type { LintContext } from '../src/lint/types'

const ctx: LintContext = { filePath: 'fake.podlite', fileType: 'podlite', config: {} }
const check = (src: string, fileType: LintContext['fileType'] = 'podlite') =>
  linkNotEmptyRule.check(parseContent(src, fileType), { ...ctx, fileType })

describe('link-not-empty rule', () => {
  it('exposes stable slug and error severity', () => {
    expect(LINK_NOT_EMPTY_RULE_ID).toBe('link-not-empty')
    expect(linkNotEmptyRule.id).toBe('link-not-empty')
    expect(linkNotEmptyRule.severity).toBe('error')
  })

  describe('reports a link with nowhere to go', () => {
    it('catches one written with nothing inside', () => {
      const v = check('See L<> here.\n')
      expect(v).toHaveLength(1)
      expect(v[0].location).toBeDefined()
    })

    it('catches one holding only a space', () => {
      expect(check('See L< > here.\n')).toHaveLength(1)
    })

    it('catches one whose address was left off after the bar', () => {
      expect(check('See L<text|> here.\n')).toHaveLength(1)
    })

    it('catches the markdown form with an empty address', () => {
      expect(check('[text]()\n', 'md')).toHaveLength(1)
    })
  })

  describe('stays quiet', () => {
    it('on a link carrying its address as its text', () => {
      expect(check('See L<https://example.com> here.\n')).toEqual([])
    })

    it('on a link with both text and address', () => {
      expect(check('See L<text|https://example.com> here.\n')).toEqual([])
    })

    it('on an anchor', () => {
      expect(check('=for para :id<A>\nSee L<there|#A>.\n')).toEqual([])
    })

    it('on a link whose address is its only content', () => {
      expect(check('=for para :id<A>\nSee L<#A> here.\n')).toEqual([])
      expect(check('See L<https://example.com> here.\n')).toEqual([])
    })

    it('on a document with no links at all', () => {
      expect(check('=head1 Title\n\nplain prose\n')).toEqual([])
    })

    // the walk is reachable from a processed tree too, where the address is a
    // node with a value rather than the bare string the parser leaves
    it('on a link whose address the tree carries as a node', () => {
      const processed = podlite({ importPlugins: true }).toAst(
        parseContent('=for para :id<A>\nSee L<#A> here.\n', 'podlite'),
      )
      expect(linkNotEmptyRule.check(processed, ctx)).toEqual([])
    })
  })
})
