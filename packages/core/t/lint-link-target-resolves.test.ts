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
