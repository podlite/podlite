jest.mock('../src/lint/loader', () => {
  const actual = jest.requireActual('../src/lint/loader')
  return {
    ...actual,
    parseContent: () => {
      throw new Error('cannot read')
    },
  }
})

import { lintSource } from '../src/lint'

describe('markdown-in-pod when the parse throws', () => {
  it('keeps the whole report, the warning on a line of code too', () => {
    const found = lintSource('=begin pod\ntext\n\n  # comment\n=end pod\n', 'doc.podlite', {}).violations
    expect(found.map(v => [v.rule, v.severity, v.location?.start.line])).toEqual([
      ['markdown-in-pod', 'warning', 4],
      ['syntax-valid', 'error', undefined],
    ])
  })
})
