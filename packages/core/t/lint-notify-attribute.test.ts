import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { lintFile, lintSource } from '../src/lint'
import { DEFAULT_RULES } from '../src/lint/rules'

const RULE = 'notify-attribute'

const WRITTEN = ':notify is not a notification attribute; a notification is written :notice'
const FROM_SET = ':notify given by =set is not a notification attribute; a notification is written :notice'
const FROM_CONFIG = ':notify given by =config is not a notification attribute; a notification is written :notice'

const found = (src: string) =>
  lintSource(src, 'doc.podlite', {})
    .violations.filter(v => v.rule === RULE)
    .map(v => ({ line: v.location?.start.line, message: v.message }))

describe('notify-attribute rule', () => {
  it('exposes a stable slug and warning severity, and runs by default', () => {
    const rule = DEFAULT_RULES.find(r => r.id === RULE)
    expect(rule).toBeDefined()
    expect(rule?.severity).toBe('warning')
    const v = lintSource('=begin pod\n=begin nested :notify<tip>\nx\n=end nested\n=end pod\n', 'doc.podlite', {})
    expect(v.violations.filter(x => x.rule === RULE).map(x => x.severity)).toEqual(['warning'])
  })

  // an abbreviated block takes no attributes: what follows its name is its text
  it('warns on :notify written on a delimited and on a paragraph nested block', () => {
    const src = '=begin pod\n=begin nested :notify<tip>\nx\n=end nested\n\n=for nested :notify<note>\ny\n=end pod\n'
    expect(found(src)).toEqual([
      { line: 2, message: WRITTEN },
      { line: 6, message: WRITTEN },
    ])
  })

  it('warns on :notify given by =set, at the line of the block', () => {
    const src = '=begin pod\n=set :notify<tip>\n=begin nested\nx\n=end nested\n=end pod\n'
    expect(found(src)).toEqual([{ line: 3, message: FROM_SET }])
  })

  it('warns on each nested block :notify given by =config reaches, at the line of the block', () => {
    const src =
      '=begin pod\n=config nested :notify<tip>\n\n=begin nested\nx\n=end nested\n\n=begin nested\ny\n=end nested\n=end pod\n'
    expect(found(src)).toEqual([
      { line: 4, message: FROM_CONFIG },
      { line: 8, message: FROM_CONFIG },
    ])
  })

  it('warns once on a block written with :notice that :notify reaches from =config, naming the source', () => {
    const src = '=begin pod\n=config nested :notify<tip>\n\n=begin nested :notice<note>\nx\n=end nested\n=end pod\n'
    expect(found(src)).toEqual([{ line: 4, message: FROM_CONFIG }])
  })

  it('warns once without a source on a block written with both attributes', () => {
    const src = '=begin pod\n=begin nested :notice<tip> :notify<warning>\nx\n=end nested\n=end pod\n'
    expect(found(src)).toEqual([{ line: 2, message: WRITTEN }])
  })

  it('leaves a block above =config alone and warns on the block below', () => {
    const src =
      '=begin pod\n=begin nested\nx\n=end nested\n\n=config nested :notify<tip>\n\n=begin nested\ny\n=end nested\n=end pod\n'
    expect(found(src)).toEqual([{ line: 8, message: FROM_CONFIG }])
  })

  it('keeps =config inside a nested block to the blocks in it', () => {
    const src =
      '=begin pod\n=begin nested\n=config nested :notify<tip>\n\n=begin nested\ninner\n=end nested\n=end nested\n\n=begin nested\noutside\n=end nested\n=end pod\n'
    expect(found(src)).toEqual([{ line: 5, message: FROM_CONFIG }])
  })

  it('warns once when =set and =config give the same key, naming =set', () => {
    const src =
      '=begin pod\n=config nested :notify<tip>\n=set :notify<warning>\n=begin nested\nx\n=end nested\n=end pod\n'
    expect(found(src)).toEqual([{ line: 4, message: FROM_SET }])
  })

  it('warns once without a source when the block writes :notify that =config gives too', () => {
    const src = '=begin pod\n=config nested :notify<tip>\n\n=begin nested :notify<warning>\nx\n=end nested\n=end pod\n'
    expect(found(src)).toEqual([{ line: 4, message: WRITTEN }])
  })

  // guards: the behaviour these hold was already so before the rule
  it('leaves :notice alone', () => {
    expect(found('=begin pod\n=begin nested :notice<tip>\nx\n=end nested\n=end pod\n')).toEqual([])
  })

  it('leaves :notify on a block other than nested alone', () => {
    expect(found('=begin pod\n=for para :notify<tip>\nx\n=end pod\n')).toEqual([])
  })

  it('leaves a nested block written inside a code block alone', () => {
    expect(found('=begin pod\n=begin code\n=begin nested :notify<tip>\nx\n=end nested\n=end code\n=end pod\n')).toEqual(
      [],
    )
  })

  it('leaves the including file alone when :notify is written in the included one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'podlite-notify-'))
    writeFileSync(join(dir, 'part.podlite'), '=begin pod\n=begin nested :notify<tip>\nx\n=end nested\n=end pod\n')
    const book = join(dir, 'book.podlite')
    writeFileSync(book, '=begin pod\n=include file:./part.podlite\n=end pod\n')
    expect(lintFile(book, {}).violations.filter(v => v.rule === RULE)).toEqual([])
  })
})
