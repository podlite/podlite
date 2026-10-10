import * as path from 'path'
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { lintFile, runLint } from '../src/lint'
import { sourcesFromFiles } from '../src/assemble'
import { parseContent, readFile } from '../src/lint/loader'
import { idUniqueRule, ID_UNIQUE_RULE_ID, collectExplicitIds } from '../src/lint/rules/id-unique'
import type { LintContext } from '../src/lint/types'

const FIXTURES = path.join(__dirname, 'lint-fixtures')
const ctx: LintContext = { filePath: 'fake.podlite', fileType: 'podlite', config: {} }

describe('id-unique rule', () => {
  it('exposes stable slug and error severity', () => {
    expect(ID_UNIQUE_RULE_ID).toBe('id-unique')
    expect(idUniqueRule.id).toBe('id-unique')
    expect(idUniqueRule.severity).toBe('error')
  })

  it('flags duplicate explicit ids', () => {
    const ast = parseContent(readFile(path.join(FIXTURES, 'id-duplicate.podlite')), 'podlite')
    const v = idUniqueRule.check(ast, ctx)
    expect(v).toHaveLength(1)
    expect(v[0].message).toMatch(/Duplicate :id<intro>/)
  })

  it('returns [] when all explicit ids are unique', () => {
    const ast = parseContent(readFile(path.join(FIXTURES, 'id-unique-clean.podlite')), 'podlite')
    expect(idUniqueRule.check(ast, ctx)).toEqual([])
  })

  it('skip silent when no explicit :id<> present (markdown)', () => {
    const ast = parseContent(readFile(path.join(FIXTURES, 'no-ids.md')), 'md')
    expect(idUniqueRule.check(ast, ctx)).toEqual([])
  })

  it('flags only the second and later occurrences, not the first', () => {
    const src =
      '=begin para :id<x>\nA.\n=end para\n\n=begin para :id<x>\nB.\n=end para\n\n=begin para :id<x>\nC.\n=end para\n'
    const ast = parseContent(src, 'podlite')
    const v = idUniqueRule.check(ast, ctx)
    expect(v).toHaveLength(2)
  })

  it('case-sensitive id comparison', () => {
    const src = '=begin para :id<MyID>\nA.\n=end para\n\n=begin para :id<myid>\nB.\n=end para\n'
    const ast = parseContent(src, 'podlite')
    expect(idUniqueRule.check(ast, ctx)).toEqual([])
  })

  it('collectExplicitIds ignores auto-generated node.id', () => {
    const ast = parseContent('=head1 Title\n\nProse.\n', 'podlite')
    expect(collectExplicitIds(ast)).toEqual([])
  })
})

describe('runLint id-unique integration', () => {
  let stdout: jest.SpyInstance

  beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })
  afterEach(() => {
    stdout.mockRestore()
  })

  it('duplicate ids → exit 1 with error emitted', () => {
    const code = runLint([path.join(FIXTURES, 'id-duplicate.podlite')], { strict: false, format: 'text' })
    expect(code).toBe(1)
    const out = stdout.mock.calls.map(c => c[0]).join('')
    expect(out).toMatch(/error: Duplicate :id<intro>.*\(id-unique\)/)
  })

  it('clean fixture → exit 0, only summary emitted', () => {
    const code = runLint([path.join(FIXTURES, 'id-unique-clean.podlite')], { strict: false, format: 'text' })
    expect(code).toBe(0)
    const out = stdout.mock.calls.map(c => c[0]).join('')
    expect(out).toBe('1 file checked, 0 errors, 0 warnings\n')
  })

  it('markdown without ids → exit 0', () => {
    const code = runLint([path.join(FIXTURES, 'no-ids.md')], { strict: false, format: 'text' })
    expect(code).toBe(0)
  })
})

describe('id-unique and headings', () => {
  it('says nothing about two headings with the same text', () => {
    const src = '=head1 Introduction\n\n=head1 Introduction\n'
    expect(idUniqueRule.check(parseContent(src, 'podlite'), ctx)).toEqual([])
  })
})

describe('id-unique over the document its includes assemble', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'podlite-id-unique-'))
  mkdirSync(path.join(dir, 'sub'))
  writeFileSync(path.join(dir, 'sub', 'other.podlite'), '=begin pod\n\n=for para :id<dup>\nOther.\n\n=end pod\n')
  writeFileSync(path.join(dir, 'sub', 'one.podlite'), '=begin pod\n\n=for para :id<solo>\nOnly.\n\n=end pod\n')
  writeFileSync(path.join(dir, 'sub', 'outer.podlite'), '=begin pod\n\n=include file:other.podlite\n\n=end pod\n')
  writeFileSync(path.join(dir, 'sub', 'plain1.podlite'), '=begin pod\n\n=para\nFirst.\n\n=end pod\n')
  writeFileSync(path.join(dir, 'sub', 'plain2.podlite'), '=begin pod\n\n=para\nFirst.\n\n=para\nSecond.\n\n=end pod\n')
  const ids = (name: string, src: string) => {
    const file = path.join(dir, name)
    writeFileSync(file, src)
    return lintFile(file, {}).violations.filter(v => v.rule === ID_UNIQUE_RULE_ID)
  }
  const doc = (body: string) => `=begin pod\n\n${body}\n\n=end pod\n`

  it('names both files when an included block repeats an id of the document', () => {
    const v = ids('main.podlite', doc('=for para :id<dup>\nMain.\n\n=include file:sub/other.podlite'))
    expect(v.map(x => [x.message, x.location?.start.line])).toEqual([
      ['Duplicate :id<dup> (in sub/other.podlite:3); first at line 3', 6],
    ])
  })

  it('names both files when the included block comes first', () => {
    const v = ids('after.podlite', doc('=include file:sub/other.podlite\n\n=for para :id<dup>\nMain.'))
    expect(v.map(x => x.message)).toEqual(['Duplicate :id<dup>; first at line 3 (in sub/other.podlite:3)'])
  })

  it('counts a file included twice as two occurrences', () => {
    const v = ids('twice.podlite', doc('=include file:sub/one.podlite\n\n=include file:sub/one.podlite'))
    expect(v.map(x => [x.message, x.location?.start.line])).toEqual([
      ['Duplicate :id<solo> (in sub/one.podlite:3); first at line 3 (in sub/one.podlite:3)', 5],
    ])
  })

  it('reports a block of a nested include at the outer directive', () => {
    const v = ids('nested.podlite', doc('=for para :id<dup>\nMain.\n\n=include file:sub/outer.podlite'))
    expect(v.map(x => x.location?.start.line)).toEqual([6])
  })

  it('takes an id given by =config to the blocks it places, not to the directive', () => {
    expect(ids('config1.podlite', doc('=config para :id<x>\n\n=include file:sub/plain1.podlite'))).toEqual([])
    expect(ids('config2.podlite', doc('=config para :id<x>\n\n=include file:sub/plain2.podlite'))).toHaveLength(1)
  })

  it('takes an id given by =config in one file the same way', () => {
    const one = parseContent(doc('=config para :id<x>\n\n=para\nOnly.'), 'podlite')
    const two = parseContent(doc('=config para :id<x>\n\n=para\nFirst.\n\n=para\nSecond.'), 'podlite')
    expect(idUniqueRule.check(one, ctx)).toEqual([])
    expect(idUniqueRule.check(two, ctx)).toHaveLength(1)
  })

  it('is silenced by lint-ignore around the directive', () => {
    const src =
      '=begin pod :lint-ignore<id-unique>\n\n=for para :id<dup>\nMain.\n\n=include file:sub/other.podlite\n\n=end pod\n'
    expect(ids('ignored.podlite', src)).toEqual([])
  })

  it('names a file of a given set from the context it is resolved from', () => {
    const src = doc('=for para :id<dup>\nMain.\n\n=include file:lib/part.podlite')
    const v = idUniqueRule.check(parseContent(src, 'podlite'), {
      filePath: 'input.podlite',
      fileType: 'podlite',
      config: {},
      sources: sourcesFromFiles({ 'lib/part.podlite': doc('=for para :id<dup>\nPart.') }),
      context: '',
      self: '/input.podlite',
    })
    expect(v.map(x => x.message)).toEqual(['Duplicate :id<dup> (in lib/part.podlite:3); first at line 3'])
  })
  it('reads the given files anew when one context is checked again', () => {
    const src = doc('=include file:part.podlite')
    const ast = parseContent(src, 'podlite')
    const host = {
      filePath: 'input.podlite',
      fileType: 'podlite' as const,
      config: {},
      context: '',
      self: '/input.podlite',
    }
    const checked = { ...host, sources: sourcesFromFiles({ 'part.podlite': doc('=for para :id<x>\nOne.') }) }
    expect(idUniqueRule.check(ast, checked)).toEqual([])
    checked.sources = sourcesFromFiles({ 'part.podlite': doc('=for para :id<x>\nOne.\n\n=for para :id<x>\nTwo.') })
    expect(idUniqueRule.check(ast, checked)).toHaveLength(1)
  })
})
