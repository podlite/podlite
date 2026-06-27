import * as path from 'path'
import { runLint } from '../src/lint'
import { parseContent } from '../src/lint/loader'
import { syntaxValidRule, SYNTAX_VALID_RULE_ID, collectRecoveredErrors } from '../src/lint/rules/syntax-valid'
import type { LintContext } from '../src/lint/types'

const FIXTURES = path.join(__dirname, 'lint-fixtures')
const ctx: LintContext = { filePath: 'fake.podlite', fileType: 'podlite', config: {} }

describe('syntax-valid rule', () => {
  it('exposes stable slug', () => {
    expect(SYNTAX_VALID_RULE_ID).toBe('syntax-valid')
    expect(syntaxValidRule.id).toBe('syntax-valid')
  })

  it('flags a directive-like line that fails to parse', () => {
    const ast = parseContent('=config simple-diagram :fallback<para>\n', 'podlite')
    const v = syntaxValidRule.check(ast, ctx)
    expect(v).toHaveLength(1)
    expect(v[0].severity).toBe('warning')
    expect(v[0].message).toContain('=config simple-diagram :fallback<para>')
    expect(v[0].location?.start.line).toBe(1)
  })

  it('returns [] for a valid document', () => {
    const ast = parseContent('=head1 Title\n\nplain text with = inside\n\n=begin para\nok\n=end para\n', 'podlite')
    expect(syntaxValidRule.check(ast, ctx)).toEqual([])
  })

  it('does not flag a valid Mixed-case custom block config', () => {
    const ast = parseContent('=config Recipe :fallback<para>\n', 'podlite')
    expect(syntaxValidRule.check(ast, ctx)).toEqual([])
  })

  it('flags every unparsed line', () => {
    const ast = parseContent('=config bad-one :fallback<para>\n=config bad-two :fallback<code>\n', 'podlite')
    expect(collectRecoveredErrors(ast)).toHaveLength(2)
  })
})

describe('runLint syntax-valid integration', () => {
  let stdout: jest.SpyInstance

  beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })
  afterEach(() => {
    stdout.mockRestore()
  })

  it('recovered line → warning emitted, exit 0 without strict', () => {
    const code = runLint([path.join(FIXTURES, 'syntax-recovered.podlite')], { strict: false, format: 'text' })
    expect(code).toBe(0)
    const out = stdout.mock.calls.map(c => c[0]).join('')
    expect(out).toMatch(/warning: Line could not be parsed.*\(syntax-valid\)/)
  })

  it('recovered line → exit 1 under strict', () => {
    const code = runLint([path.join(FIXTURES, 'syntax-recovered.podlite')], { strict: true, format: 'text' })
    expect(code).toBe(1)
  })
})
