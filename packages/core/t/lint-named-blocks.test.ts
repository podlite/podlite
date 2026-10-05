import { lintSource } from '../src/lint'
import { parseContent } from '../src/lint/loader'
import {
  directiveNamedBlockRule,
  imageNamedBlockRule,
  DIRECTIVE_NAMED_BLOCK_RULE_ID,
  IMAGE_NAMED_BLOCK_RULE_ID,
} from '../src/lint/rules/named-blocks'
import { DEFAULT_RULES } from '../src/lint/rules'
import type { LintContext } from '../src/lint/types'

const ctx: LintContext = { filePath: 'fake.podlite', fileType: 'podlite', config: {} }
const check = (rule: typeof directiveNamedBlockRule, src: string) => rule.check(parseContent(src, 'podlite'), ctx)

describe('directive-named-block rule', () => {
  it('exposes a stable slug and warning severity, and runs by default', () => {
    expect(directiveNamedBlockRule.id).toBe(DIRECTIVE_NAMED_BLOCK_RULE_ID)
    expect(DIRECTIVE_NAMED_BLOCK_RULE_ID).toBe('directive-named-block')
    expect(directiveNamedBlockRule.severity).toBe('warning')
    expect(DEFAULT_RULES).toContain(directiveNamedBlockRule)
  })

  it('warns on a named block that spells a directive, in each block form', () => {
    const src =
      '=begin pod\n=Include doc:Glossary\n\n=for Set :lang<raku>\ntext\n\n=begin Config\n=end Config\n\n=Alias NAME value\n=end pod\n'
    const v = check(directiveNamedBlockRule, src)
    expect(v.map(x => x.message)).toEqual([
      '=Include is a named block, not a directive; the directive is written =include',
      '=Set is a named block, not a directive; the directive is written =set',
      '=Config is a named block, not a directive; the directive is written =config',
      '=Alias is a named block, not a directive; the directive is written =alias',
    ])
    expect(v.every(x => x.severity === 'warning' && x.location !== undefined)).toBe(true)
  })

  it('leaves the directives and a semantic block written in upper case alone', () => {
    const src = '=begin pod\n=include doc:Glossary\n\n=config head1 :numbered\n\n=INCLUDE\ntext\n=end pod\n'
    expect(check(directiveNamedBlockRule, src)).toEqual([])
  })
})

describe('image-named-block rule', () => {
  it('exposes its own slug and warning severity, and runs by default', () => {
    expect(imageNamedBlockRule.id).toBe(IMAGE_NAMED_BLOCK_RULE_ID)
    expect(IMAGE_NAMED_BLOCK_RULE_ID).toBe('image-named-block')
    expect(imageNamedBlockRule.severity).toBe('warning')
    expect(DEFAULT_RULES).toContain(imageNamedBlockRule)
  })

  it('warns on =Image in each block form', () => {
    const src =
      '=begin pod\n=Image media/a.png\n\n=for Image\nmedia/b.png\n\n=begin Image\nmedia/c.png\n=end Image\n=end pod\n'
    const v = check(imageNamedBlockRule, src)
    expect(v).toHaveLength(3)
    expect(v[0].message).toBe('=Image is not in the specification; a picture is written =picture')
  })

  it('leaves =picture alone', () => {
    expect(check(imageNamedBlockRule, '=begin pod\n=picture media/a.png\n=end pod\n')).toEqual([])
  })

  it('is turned off by its slug without touching the directive rule', () => {
    const body = '=Image media/a.png\n\n=Include doc:Glossary\n'
    const ruleIds = (src: string, config = {}) => lintSource(src, 'doc.podlite', config).violations.map(v => v.rule)
    const muted = ruleIds(`=begin pod :lint-ignore<image-named-block>\n${body}=end pod\n`)
    const off = ruleIds(`=begin pod\n${body}=end pod\n`, { rules: { [IMAGE_NAMED_BLOCK_RULE_ID]: 'off' } })
    for (const rules of [muted, off]) {
      expect(rules).toContain(DIRECTIVE_NAMED_BLOCK_RULE_ID)
      expect(rules).not.toContain(IMAGE_NAMED_BLOCK_RULE_ID)
    }
  })
})
