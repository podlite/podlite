import * as path from 'path'
import { runLint } from '../src/lint'
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

  it('clean fixture → exit 0', () => {
    const code = runLint([path.join(FIXTURES, 'id-unique-clean.podlite')], { strict: false, format: 'text' })
    expect(code).toBe(0)
    expect(stdout).not.toHaveBeenCalled()
  })

  it('markdown without ids → exit 0', () => {
    const code = runLint([path.join(FIXTURES, 'no-ids.md')], { strict: false, format: 'text' })
    expect(code).toBe(0)
  })
})
