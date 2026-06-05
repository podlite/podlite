import * as path from 'path'
import { runLint } from '../src/lint'
import { scanSourceRules, DELIMITED_BLOCK_BALANCE_RULE_ID, delimitedBlockBalanceRule } from '../src/lint/grammar/scan'

const FIXTURES = path.join(__dirname, 'lint-fixtures')

describe('delimited-block-balance rule', () => {
  it('exposes stable slug and error severity', () => {
    expect(DELIMITED_BLOCK_BALANCE_RULE_ID).toBe('delimited-block-balance')
    expect(delimitedBlockBalanceRule.id).toBe('delimited-block-balance')
    expect(delimitedBlockBalanceRule.severity).toBe('error')
  })

  it('balanced =begin/=end produces no violations', () => {
    const src = '=begin code\nbody\n=end code\n'
    expect(scanSourceRules(src)).toEqual([])
  })

  it('flags orphan =end', () => {
    const v = scanSourceRules('=end table\n')
    expect(v).toHaveLength(1)
    expect(v[0].message).toMatch(/=end table without matching =begin/)
  })

  it('flags mismatched =end name', () => {
    const v = scanSourceRules('=begin code\nbody\n=end para\n')
    expect(v).toHaveLength(1)
    expect(v[0].message).toMatch(/=end para does not match =begin code/)
  })

  it('flags nested same-name trap', () => {
    const src = '=begin code\n=begin code\ninner\n=end code\n=end code\n'
    const v = scanSourceRules(src)
    const nested = v.find(d => d.message.includes('nested inside'))
    expect(nested).toBeDefined()
    expect(nested?.message).toMatch(/=begin code nested inside =begin code/)
  })

  it('flags unclosed =begin at end of file', () => {
    const v = scanSourceRules('=begin pod\nbody\n')
    expect(v).toHaveLength(1)
    expect(v[0].message).toMatch(/=begin pod is not closed before end of file/)
  })

  it('reports each unclosed block when several remain open', () => {
    const v = scanSourceRules('=begin pod\n=begin nested\nbody\n')
    expect(v).toHaveLength(2)
    expect(v[0].message).toMatch(/is not closed/)
    expect(v[1].message).toMatch(/is not closed/)
  })

  it('pure markdown text produces no violations', () => {
    const src = '# Heading\n\nParagraph with > a literal angle.\n\n- item\n'
    expect(scanSourceRules(src)).toEqual([])
  })

  it('descending names balanced through stack', () => {
    const src = '=begin pod\n=begin code\nx\n=end code\n=end pod\n'
    expect(scanSourceRules(src)).toEqual([])
  })

  it('attr-nested-angle still works alongside delim rules', () => {
    const src = '=for defn :id<x> :snippet<text B<bold> tail>\n'
    const v = scanSourceRules(src)
    const attr = v.find(d => d.rule === 'attr-nested-angle')
    expect(attr).toBeDefined()
  })
})

describe('runLint delimited-block-balance integration', () => {
  let stdout: jest.SpyInstance

  beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })
  afterEach(() => {
    stdout.mockRestore()
  })

  it('orphan-end fixture → exit 1', () => {
    const code = runLint([path.join(FIXTURES, 'delim-orphan-end.podlite')], { strict: false, format: 'text' })
    expect(code).toBe(1)
    const out = stdout.mock.calls.map(c => c[0]).join('')
    expect(out).toMatch(/error: =end table without matching =begin.*\(delimited-block-balance\)/)
  })

  it('mismatch fixture → exit 1', () => {
    const code = runLint([path.join(FIXTURES, 'delim-mismatch.podlite')], { strict: false, format: 'text' })
    expect(code).toBe(1)
    const out = stdout.mock.calls.map(c => c[0]).join('')
    expect(out).toMatch(/error: =end para does not match =begin code/)
  })

  it('nested-trap fixture → exit 1', () => {
    const code = runLint([path.join(FIXTURES, 'delim-nested-trap.podlite')], { strict: false, format: 'text' })
    expect(code).toBe(1)
    const out = stdout.mock.calls.map(c => c[0]).join('')
    expect(out).toMatch(/error: =begin code nested inside =begin code/)
  })

  it('unclosed fixture → exit 1', () => {
    const code = runLint([path.join(FIXTURES, 'delim-unclosed.podlite')], { strict: false, format: 'text' })
    expect(code).toBe(1)
    const out = stdout.mock.calls.map(c => c[0]).join('')
    expect(out).toMatch(/error: =begin pod is not closed/)
  })

  it('balanced fixture → exit 0', () => {
    const code = runLint([path.join(FIXTURES, 'delim-balanced.podlite')], { strict: false, format: 'text' })
    expect(code).toBe(0)
  })
})
