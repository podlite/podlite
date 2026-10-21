import { lintSource } from '../src/lint'
import { sourcesFromFiles } from '../src/assemble'
import { parseContent } from '../src/lint/loader'
import { testUnderRuleRule, TEST_UNDER_RULE_RULE_ID } from '../src/lint/rules/test-under-rule'
import type { LintContext } from '../src/lint/types'

const ctx: LintContext = { filePath: 'fake.podlite', fileType: 'podlite', config: {} }
const check = (src: string, fileType: LintContext['fileType'] = 'podlite') =>
  testUnderRuleRule.check(parseContent(src, fileType), { ...ctx, fileType })
const withParts = (src: string, parts: Record<string, string>) =>
  testUnderRuleRule.check(parseContent(src, 'podlite'), {
    filePath: 'input.podlite',
    fileType: 'podlite',
    config: {},
    sources: sourcesFromFiles(parts),
    context: '',
    self: '/input.podlite',
  })
const lines = (v: ReturnType<typeof check>) => v.map(x => x.location?.start.line)
const messages = (v: ReturnType<typeof check>) => v.map(x => x.message)

const test = '=begin test\n=begin fixture\n=head1 A\n=end fixture\n=for assert\nhead1\n=end test\n'

describe('test-under-rule rule', () => {
  it('exposes stable slug and warning severity', () => {
    expect(TEST_UNDER_RULE_RULE_ID).toBe('test-under-rule')
    expect(testUnderRuleRule.id).toBe('test-under-rule')
    expect(testUnderRuleRule.severity).toBe('warning')
  })

  it('warns of a test right under a heading and stays quiet under a paragraph', () => {
    const v = check(`=head1 Part\n\n${test}`)
    expect(messages(v)).toEqual(['=test stands under =head1, not under a rule'])
    expect(lines(v)).toEqual([3])
    expect(check(`=head1 Part\n\nA rule.\n\n${test}`)).toEqual([])
  })

  it('takes a second test in a row for one under the same block', () => {
    expect(check(`A rule.\n${test}${test}`)).toEqual([])
    expect(lines(check(`=head1 Part\n${test}${test}`))).toEqual([2, 9])
  })

  it('warns of a test that opens a document or a block', () => {
    expect(messages(check(test))).toEqual(['=test has no rule above it'])
    expect(lines(check(`=begin nested\n${test}=end nested\n`))).toEqual([2])
    expect(check(`=begin nested\nA rule.\n\n${test}=end nested\n`)).toEqual([])
  })

  it('reads the blocks a page draws a test under as the page does', () => {
    for (const before of [
      '=for code\nx = 1\n',
      '=item one\n',
      '=table\na b\n',
      '=begin nested\nquoted\n=end nested\n',
    ]) {
      expect(check(`${before}\n${test}`)).toEqual([])
    }
    for (const [before, name] of [
      ['=comment note\n', '=comment'],
      ['=for data :key<k>\nx\n', '=data'],
      ['=toc head1\n', '=toc'],
      ['=head2 Part\n', '=head2'],
      ['=config test :caption<x>\n', '=config test'],
      ['=alias TERM Meaning\n', '=alias TERM'],
    ]) {
      expect(messages(check(`${before}\n${test}`))).toEqual([`=test stands under ${name}, not under a rule`])
    }
  })

  it('reads a test brought by an include at the place of the include', () => {
    const part = { 'part.podlite': `A rule of the part.\n\n${test}` }
    expect(withParts('A rule.\n\n=include file:part.podlite | test\n', part)).toEqual([])
    const v = withParts('=head1 Part\n\n=include file:part.podlite | test\n', part)
    expect(messages(v)).toEqual(['=test stands under =head1, not under a rule (in part.podlite:3)'])
    expect(lines(v)).toEqual([3])
  })

  it('takes a file included whole for a block a test can stand under', () => {
    const part = { 'part.podlite': 'A rule of the part.\n' }
    expect(withParts(`=include file:part.podlite\n\n${test}`, part)).toEqual([])
    expect(withParts('=include file:part.podlite\n', { 'part.podlite': test })).toHaveLength(1)
  })

  it('keeps checking the rest when an include elsewhere does not resolve', () => {
    const part = { 'part.podlite': `A rule of the part.\n\n${test}` }
    const v = withParts('=include file:missing.podlite\n\n=head1 Part\n\n=include file:part.podlite | test\n', part)
    expect(messages(v)).toEqual(['=test stands under =head1, not under a rule (in part.podlite:3)'])
  })

  it('says nothing of a test right after an include that does not resolve', () => {
    expect(withParts(`=include file:missing.podlite\n\n${test}${test}`, {})).toEqual([])
    expect(withParts(`A rule.\n\n=include file:missing.podlite\n\n${test}`, {})).toEqual([])
    expect(withParts(`=include file:missing.podlite\n\n=head1 Part\n\n${test}`, {})).toHaveLength(1)
  })

  it('does not take an include inside a test passed over for one above the next test', () => {
    const inside = '=begin test\n=include file:missing.podlite\n=for assert\nhead1\n=end test\n'
    expect(lines(withParts(`=head1 Part\n\n${inside}${test}`, {}))).toEqual([3, 8])
  })

  it('says nothing of a test an include brought right after an include that does not resolve', () => {
    const part = { 'part.podlite': test }
    expect(
      withParts('=head1 Part\n\n=include file:missing.podlite\n\n=include file:part.podlite | test\n', part),
    ).toEqual([])
    const inner = { 'part.podlite': `=include file:missing.podlite\n\n${test}` }
    expect(withParts('=head1 Part\n\n=include file:part.podlite | test\n', inner)).toEqual([])
    expect(withParts('=head1 Part\n\n=include file:part.podlite | test\n', part)).toHaveLength(1)
  })

  it('names the innermost file of a test brought through two includes', () => {
    const parts = { 'outer.podlite': '=include file:inner.podlite | test\n', 'inner.podlite': test }
    const v = withParts('A rule.\n\n=include file:outer.podlite\n', parts)
    expect(messages(v)).toEqual(['=test has no rule above it (in inner.podlite:1)'])
    expect(lines(v)).toEqual([3])
  })

  it('reads the tests of an item as the page does', () => {
    expect(check(`=begin item\nA rule.\n\n${test}=end item\n`)).toEqual([])
    expect(lines(check(`=begin item\n${test}=end item\n`))).toEqual([2])
  })

  it('reads a Markdown file as having no tests', () => {
    const src = `=head1 Part\n\n${test}`
    expect(check(src, 'md')).toEqual([])
    expect(check(src, 'podlite')).toHaveLength(1)
  })

  it('runs with the default rules', () => {
    const src = `=head1 Part\n\n${test}`
    expect(lintSource(src, 'x.podlite', {}).violations.map(v => v.rule)).toContain('test-under-rule')
    expect(
      lintSource(src, 'x.podlite', { rules: { 'test-under-rule': 'off' } }).violations.map(v => v.rule),
    ).not.toContain('test-under-rule')
  })
})
