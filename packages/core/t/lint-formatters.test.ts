import { formatText, FileReport } from '../src/lint/formatters/text'
import { formatJson } from '../src/lint/formatters/json'
import type { Violation } from '../src/lint/types'

function mkViolation(over: Partial<Violation> = {}): Violation {
  return {
    rule: 'some-rule',
    severity: 'error',
    message: 'something happened',
    location: { start: { line: 3, column: 5, offset: 0 }, end: { line: 3, column: 5, offset: 0 } },
    ...over,
  }
}

describe('formatText', () => {
  it('emits flat lines and summary for violations', () => {
    const reports: FileReport[] = [
      {
        filePath: 'a.podlite',
        violations: [mkViolation({ rule: 'id-unique', severity: 'error', message: 'Duplicate :id<x>' })],
      },
    ]
    const out = formatText(reports, { color: false })
    expect(out).toBe('a.podlite:3:5: error: Duplicate :id<x> (id-unique)\n\n1 file checked, 1 error, 0 warnings\n')
  })

  it('summary uses singular forms for 1, plural otherwise', () => {
    const reports: FileReport[] = [
      { filePath: 'a.podlite', violations: [mkViolation({ severity: 'error' })] },
      {
        filePath: 'b.podlite',
        violations: [mkViolation({ severity: 'warning' }), mkViolation({ severity: 'warning' })],
      },
    ]
    const out = formatText(reports, { color: false })
    expect(out).toMatch(/2 files checked, 1 error, 2 warnings\n$/)
  })

  it('clean reports emit only summary', () => {
    const reports: FileReport[] = [{ filePath: 'ok.podlite', violations: [] }]
    expect(formatText(reports, { color: false })).toBe('1 file checked, 0 errors, 0 warnings\n')
  })

  it('empty reports → empty string', () => {
    expect(formatText([], { color: false })).toBe('')
  })

  it('color: true wraps severity in ANSI codes', () => {
    const reports: FileReport[] = [{ filePath: 'a.podlite', violations: [mkViolation({ severity: 'error' })] }]
    const out = formatText(reports, { color: true })
    expect(out).toContain('\x1b[31merror\x1b[0m')
  })

  it('color: false omits ANSI codes', () => {
    const reports: FileReport[] = [{ filePath: 'a.podlite', violations: [mkViolation({ severity: 'warning' })] }]
    const out = formatText(reports, { color: false })
    expect(out).not.toContain('\x1b[')
  })
})

describe('formatJson', () => {
  it('emits array with file field merged into each violation', () => {
    const reports: FileReport[] = [
      {
        filePath: 'a.podlite',
        violations: [mkViolation({ rule: 'id-unique', severity: 'error', message: 'Duplicate :id<x>' })],
      },
    ]
    const out = formatJson(reports)
    const parsed = JSON.parse(out)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toMatchObject({
      file: 'a.podlite',
      rule: 'id-unique',
      severity: 'error',
      message: 'Duplicate :id<x>',
    })
  })

  it('empty reports → empty array', () => {
    expect(JSON.parse(formatJson([]))).toEqual([])
  })

  it('clean reports → empty array', () => {
    const out = formatJson([{ filePath: 'a.podlite', violations: [] }])
    expect(JSON.parse(out)).toEqual([])
  })
})
