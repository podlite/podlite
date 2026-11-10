import { runLint } from '../src/lint'
import { parseContent } from '../src/lint/loader'
import { linkTargetResolvesRule, LINK_TARGET_RESOLVES_RULE_ID } from '../src/lint/rules/link-target-resolves'
import type { LintContext } from '../src/lint/types'

const ctx: LintContext = { filePath: 'fake.podlite', fileType: 'podlite', config: {} }
const check = (src: string) => linkTargetResolvesRule.check(parseContent(src, 'podlite'), ctx)

describe('link-target-resolves rule', () => {
  it('exposes stable slug and error severity', () => {
    expect(LINK_TARGET_RESOLVES_RULE_ID).toBe('link-target-resolves')
    expect(linkTargetResolvesRule.id).toBe('link-target-resolves')
    expect(linkTargetResolvesRule.severity).toBe('error')
  })

  it('flags an anchor with no matching id', () => {
    const v = check('=for para :id<A>\nSee L<there|#nowhere>.\n')
    expect(v).toHaveLength(1)
    expect(v[0].message).toMatch(/#nowhere/)
    expect(v[0].location).toBeDefined()
  })

  it('stays silent when the anchor resolves', () => {
    expect(check('=for para :id<A>\nSee L<there|#A>.\n')).toEqual([])
  })

  it('reads the target from content when the link has no display text', () => {
    expect(check('=for para :id<A>\nSee L<#A>.\n')).toEqual([])
    expect(check('=for para :id<A>\nSee L<#B>.\n')).toHaveLength(1)
  })

  it('covers contextual backlinks', () => {
    expect(check('=for para :id<A>\nSee W<there|#A>.\n')).toEqual([])
    expect(check('=for para :id<A>\nSee W<there|#nowhere>.\n')).toHaveLength(1)
  })

  it('accepts a link to a heading by name', () => {
    expect(check('=head1 Getting Started\n\nSee L<there|#Getting Started>.\n')).toEqual([])
  })

  it('accepts a heading target written in another case', () => {
    expect(check('=head1 Getting Started\n\nSee L<there|#getting-started>.\n')).toEqual([])
  })

  it('accepts a heading target with the punctuation dropped', () => {
    expect(check('=head1 infix //\n\nSee L<there|#infix>.\n')).toEqual([])
  })

  it('still flags a target that names neither an id nor a heading', () => {
    const v = check('=head1 Getting Started\n\nSee L<there|#nowhere>.\n')
    expect(v).toHaveLength(1)
    expect(v[0].message).toMatch(/#nowhere/)
  })

  it('accepts an id that differs from the target only in shaping', () => {
    expect(check("=for para :id('my section')\nSee L<there|#my section>.\n")).toEqual([])
  })

  it('leaves external targets alone', () => {
    const src =
      '=for para :id<A>\nL<a|https://example.com> L<b|file:other.podlite> L<c|doc:Other#Z> L<d|mailto:x@y.z>\n'
    expect(check(src)).toEqual([])
  })

  it('skip silent without links or ids', () => {
    expect(check('=head1 Title\n\nProse.\n')).toEqual([])
  })
})

describe('runLint link-target-resolves integration', () => {
  let stdout: jest.SpyInstance

  beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })
  afterEach(() => {
    stdout.mockRestore()
  })

  it('broken anchor exits 1 and names the target', () => {
    const file = require('path').join(__dirname, 'lint-fixtures', 'link-target-broken.podlite')
    require('fs').writeFileSync(file, '=for para :id<A>\nSee L<there|#nowhere>.\n')
    const code = runLint([file], { strict: false, format: 'text' })
    require('fs').unlinkSync(file)
    expect(code).toBe(1)
    expect(stdout.mock.calls.map(c => c[0]).join('')).toMatch(/error: Link target #nowhere.*\(link-target-resolves\)/)
  })
})

describe('link-target-resolves rule inside a comment', () => {
  it('leaves a link inside a delimited comment', () => {
    expect(check('=begin comment\nSee L<x|#nowhere-at-all>.\n=end comment\n')).toEqual([])
  })

  it('leaves a link inside an abbreviated comment', () => {
    expect(check('=comment See L<x|#nowhere-at-all>.\n')).toEqual([])
  })

  it('leaves a link inside a paragraph comment', () => {
    expect(check('=for comment\nSee L<x|#nowhere-at-all>.\n')).toEqual([])
  })

  it('reports only the link after a comment nested in another block', () => {
    const v = check(
      '=begin nested\n=begin comment\nL<x|#inside> B<L<y|#inside2>> W<term|#inside3>\n=end comment\n\nSee L<z|#outside>.\n=end nested\n',
    )
    expect(v).toHaveLength(1)
    expect(v[0].message).toMatch(/#outside/)
    expect(v[0].location?.start.line).toBe(6)
  })

  it('still reports the same link outside a comment', () => {
    expect(check('See L<x|#nowhere-at-all>.\n')).toHaveLength(1)
  })

  it('still reports a link inside a nested block', () => {
    expect(check('=begin nested\nSee L<x|#nowhere-at-all>.\n=end nested\n')).toHaveLength(1)
  })

  it('still reports a link in the paragraph after a comment', () => {
    expect(check('=begin comment\nplain text\n=end comment\n\nSee L<x|#nowhere-at-all>.\n')).toHaveLength(1)
  })

  it('still reports a link in code whose lines only look like a comment', () => {
    expect(
      check('=begin code :allow<L>\n=begin comment\nL<x|#nowhere-at-all>\n=end comment\n=end code\n'),
    ).toHaveLength(1)
  })

  it('still reports a link inside a block named in another case', () => {
    expect(check('=begin COMMENT\nSee L<x|#nowhere-at-all>.\n=end COMMENT\n')).toHaveLength(1)
  })

  it('still reports a link in a paragraph that carries a comment attribute', () => {
    expect(check('=for para :comment<yes>\nSee L<x|#nowhere-at-all>.\n')).toHaveLength(1)
  })

  it('does not take declarations in a comment body as targets', () => {
    const body = '=head1 Secret\n\n=for para :id<inner>\nhidden\n'
    const links = '\nSee L<a|#Secret> and L<b|#inner>.\n'
    expect(check(`=begin comment\n${body}=end comment\n${links}`)).toHaveLength(2)
    expect(check(`${body}${links}`)).toEqual([])
  })
})
