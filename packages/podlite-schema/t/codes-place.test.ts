import * as place from '../src/codes/place'
import { podlitePluggable } from '../src/pluggableParser'

jest.mock('../src/codes/place', () => {
  const actual = jest.requireActual('../src/codes/place')
  return { ...actual, lineStarts: jest.fn(actual.lineStarts), placeInSource: jest.fn(actual.placeInSource) }
})

const lineStarts = place.lineStarts as jest.Mock
const placeInSource = place.placeInSource as jest.Mock

describe('placing the warnings of a parse', () => {
  beforeEach(() => {
    lineStarts.mockClear()
    placeInSource.mockClear()
  })

  // a thousand warnings in one paragraph: the source is walked for its line starts
  // once, not once a warning
  it('counts the line starts of the source once and gives them to every warning', () => {
    const source = `=para ${'M<x|Unknown> '.repeat(1000)}\n`
    const diagnostics: any[] = []
    podlitePluggable().parse(source, { diagnostics })

    expect(diagnostics.filter(d => d.code === 'markup-code-unsupported')).toHaveLength(1000)
    expect(lineStarts.mock.calls.filter(([text]) => text === source)).toHaveLength(1)
    expect(placeInSource).toHaveBeenCalledTimes(1000)
    const shared = placeInSource.mock.calls[0][3]
    expect(Array.isArray(shared)).toBe(true)
    expect(placeInSource.mock.calls.every(call => call[3] === shared)).toBe(true)
  })

  it('counts no line starts when a parse gives no warning to place', () => {
    podlitePluggable().parse('=para plain text\n', { diagnostics: [] })
    expect(lineStarts).not.toHaveBeenCalled()
    expect(placeInSource).not.toHaveBeenCalled()
  })
})
