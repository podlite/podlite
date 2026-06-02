import * as path from 'path'
import { runLint } from '../src/lint'
import { makeSyntaxViolation, SYNTAX_VALID_RULE_ID, syntaxValidRule } from '../src/lint/rules/syntax-valid'

const FIXTURES = path.join(__dirname, 'lint-fixtures')

describe('runLint', () => {
  let stdout: jest.SpyInstance

  beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })
  afterEach(() => {
    stdout.mockRestore()
  })

  it('valid file returns 0 and emits no violations', () => {
    const code = runLint([path.join(FIXTURES, 'valid.podlite')], { strict: false, format: 'text' })
    expect(code).toBe(0)
    expect(stdout).not.toHaveBeenCalled()
  })

  it('missing file emits io error and returns 1', () => {
    const code = runLint([path.join(FIXTURES, 'nonexistent.podlite')], { strict: false, format: 'text' })
    expect(code).toBe(1)
    const out = stdout.mock.calls.map(c => c[0]).join('')
    expect(out).toMatch(/error: Cannot read file/)
  })

  it('json format emits parsable JSON array', () => {
    const code = runLint([path.join(FIXTURES, 'nonexistent.podlite')], { strict: false, format: 'json' })
    expect(code).toBe(1)
    const out = stdout.mock.calls.map(c => c[0]).join('')
    const parsed = JSON.parse(out)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed[0]).toMatchObject({ rule: 'io', severity: 'error' })
  })

  it('valid file with json format emits empty array', () => {
    const code = runLint([path.join(FIXTURES, 'valid.podlite')], { strict: false, format: 'json' })
    expect(code).toBe(0)
    const out = stdout.mock.calls.map(c => c[0]).join('')
    expect(JSON.parse(out)).toEqual([])
  })
})

describe('syntax-valid rule', () => {
  it('exports stable rule id', () => {
    expect(SYNTAX_VALID_RULE_ID).toBe('syntax-valid')
    expect(syntaxValidRule.id).toBe('syntax-valid')
    expect(syntaxValidRule.severity).toBe('error')
  })

  it('makeSyntaxViolation extracts location from PEG-style error', () => {
    const err = { message: 'Expected end of input', location: { start: { line: 7, column: 3, offset: 42 } } }
    const v = makeSyntaxViolation(err, 'doc.podlite')
    expect(v.rule).toBe('syntax-valid')
    expect(v.severity).toBe('error')
    expect(v.message).toBe('Expected end of input')
    expect(v.location?.start?.line).toBe(7)
    expect(v.location?.start?.column).toBe(3)
  })

  it('makeSyntaxViolation handles error without location', () => {
    const v = makeSyntaxViolation(new Error('boom'), 'doc.podlite')
    expect(v.message).toBe('boom')
    expect(v.location).toBeUndefined()
  })
})
