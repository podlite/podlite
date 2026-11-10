import { podlitePluggable } from '../src/pluggableParser'
import type { ParseDiagnostic } from '../src/types'

const at = (start: number, end: number) => ({
  start: { offset: start, line: 1, column: start + 1 },
  end: { offset: end, line: 1, column: end + 1 },
})

// a warning about a markup code stays whatever surrounds it
const codes = (n: number): ParseDiagnostic[] =>
  Array.from({ length: n }, (_, i) => ({
    code: 'markup-code-too-deep',
    severity: 'warning',
    message: String(i),
    location: at(0, 0),
  }))

// a report of a value inside the report of its attribute, and the same place twice
const nested = (): ParseDiagnostic[] => [
  { code: 'value-unreadable', severity: 'warning', message: 'outer', location: at(0, 4) },
  { code: 'value-unreadable', severity: 'warning', message: 'inner', location: at(1, 2) },
  { code: 'value-unreadable', severity: 'warning', message: 'duplicate', location: at(1, 2) },
]

const parse = (diagnostics: ParseDiagnostic[]) =>
  podlitePluggable().parse('=pod\n\nText.\n', { podMode: 1, diagnostics })

describe('diagnostics handed to the parser', () => {
  it.each([10, 200_000])('keeps %i reports in the same array and order', n => {
    const diagnostics = [...codes(n), ...nested()]
    const ast = parse(diagnostics)
    expect(ast.diagnostics).toBe(diagnostics)
    expect(diagnostics.map(d => d.message)).toEqual([...codes(n).map(d => d.message), 'inner'])
  })

  it('keeps the narrower report of one mistake in the array it was given', () => {
    const diagnostics = nested()
    const ast = parse(diagnostics)
    expect(ast.diagnostics).toBe(diagnostics)
    expect(diagnostics.map(d => d.message)).toEqual(['inner'])
  })
})
