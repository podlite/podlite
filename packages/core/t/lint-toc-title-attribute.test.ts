import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { lintFile, lintSource } from '../src/lint'
import { DEFAULT_RULES } from '../src/lint/rules'

const RULE = 'toc-title-attribute'

const WRITTEN = ':title on =toc gives no caption; a caption is written :caption'
const WRITTEN_OLD = ':title on =Toc gives no caption; a caption is written :caption'
const FROM_SET = ':title given by =set on =toc gives no caption; a caption is written :caption'
const FROM_CONFIG = ':title given by =config on =toc gives no caption; a caption is written :caption'

const found = (src: string) =>
  lintSource(src, 'doc.podlite', {})
    .violations.filter(v => v.rule === RULE)
    .map(v => ({ line: v.location?.start.line, message: v.message }))

// every table of contents here selects head1 by the first line of its body
describe('toc-title-attribute rule', () => {
  it('exposes a stable slug and warning severity, and runs by default', () => {
    const rule = DEFAULT_RULES.find(r => r.id === RULE)
    expect(rule).toBeDefined()
    expect(rule?.severity).toBe('warning')
    const v = lintSource('=begin pod\n=for toc :title<X>\nhead1\n\n=head1 One\n=end pod\n', 'doc.podlite', {})
    expect(v.violations.filter(x => x.rule === RULE).map(x => x.severity)).toEqual(['warning'])
  })

  it('warns on :title written on a paragraph and on a delimited table of contents', () => {
    const src =
      '=begin pod\n=for toc :title<X>\nhead1\n\n=begin toc :title<Y>\nhead1\n=end toc\n\n=head1 One\n=end pod\n'
    expect(found(src)).toEqual([
      { line: 2, message: WRITTEN },
      { line: 5, message: WRITTEN },
    ])
  })

  it('names the older spelling as written', () => {
    expect(found("=begin pod\n=for Toc :title('List of tables')\ntable\n=end pod\n")).toEqual([
      { line: 2, message: WRITTEN_OLD },
    ])
  })

  it('warns on :title written on a continuation line of the directive', () => {
    expect(found('=begin pod\n=for toc :id<t>\n= :title<X>\nhead1\n=end pod\n')).toEqual([
      { line: 2, message: WRITTEN },
    ])
  })

  it('warns on an empty :title', () => {
    expect(found("=begin pod\n=for toc :title('')\nhead1\n=end pod\n")).toEqual([{ line: 2, message: WRITTEN }])
  })

  it('warns where :caption stands next to :title', () => {
    expect(found('=begin pod\n=for toc :caption<A> :title<B>\nhead1\n=end pod\n')).toEqual([
      { line: 2, message: WRITTEN },
    ])
  })

  it('warns on :title given by =set to the next block only, at the line of the block', () => {
    const src = '=begin pod\n=set :title<X>\n=toc head1\n\n=toc head1\n=end pod\n'
    expect(found(src)).toEqual([{ line: 3, message: FROM_SET }])
  })

  it('warns on each table of contents :title given by =config reaches, at the line of the block', () => {
    const src = '=begin pod\n=config toc :title<X>\n\n=toc head1\n\n=toc head1\n=end pod\n'
    expect(found(src)).toEqual([
      { line: 4, message: FROM_CONFIG },
      { line: 6, message: FROM_CONFIG },
    ])
  })

  it('keeps =config inside a nested block to the blocks in it', () => {
    const src = '=begin pod\n=begin nested\n=config toc :title<X>\n\n=toc head1\n=end nested\n\n=toc head1\n=end pod\n'
    expect(found(src)).toEqual([{ line: 5, message: FROM_CONFIG }])
  })

  it('names its own :title over =set and =config, and =set over =config', () => {
    const own = '=begin pod\n=config toc :title<A>\n=set :title<B>\n=for toc :title<C>\nhead1\n=end pod\n'
    expect(found(own)).toEqual([{ line: 4, message: WRITTEN }])
    const set = '=begin pod\n=config toc :title<A>\n=set :title<B>\n=toc head1\n=end pod\n'
    expect(found(set)).toEqual([{ line: 4, message: FROM_SET }])
  })

  // guards: the behaviour these hold was already so before the rule
  it('leaves :caption alone', () => {
    expect(found('=begin pod\n=for toc :caption<X>\nhead1\n=end pod\n')).toEqual([])
  })

  it('leaves :title on another block alone', () => {
    expect(found('=begin pod\n=for table :title<X>\n a | b\n=end pod\n')).toEqual([])
  })

  it('leaves a table of contents without attributes alone', () => {
    expect(found('=begin pod\n=toc head1\n=end pod\n')).toEqual([])
  })

  it('leaves :title in the predicate of a selector alone', () => {
    expect(found('=begin pod\n=toc head1[ :title<X> ]\n=end pod\n')).toEqual([])
  })

  it('leaves a table of contents written inside a code block alone', () => {
    expect(found('=begin pod\n=begin code\n=for toc :title<X>\nhead1\n=end code\n=end pod\n')).toEqual([])
  })

  // the chosen edge: a :title that reaches a table of contents only when the files are assembled
  it('leaves a :title given by =set before =include alone in the tree of one file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'podlite-toc-title-'))
    writeFileSync(join(dir, 'part.podlite'), '=comment empty\n')
    const book = join(dir, 'book.podlite')
    writeFileSync(book, '=begin pod\n=set :title<X>\n=include file:./part.podlite\n\n=toc head1\n=end pod\n')
    expect(lintFile(book, {}).violations.filter(v => v.rule === RULE)).toEqual([])
  })
})
