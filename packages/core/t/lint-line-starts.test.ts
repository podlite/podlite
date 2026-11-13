import { lineStarts, placeAtLine } from '../src/lint/line-starts'

describe('lineStarts and placeAtLine', () => {
  it('count lines by \\n and keep a \\r on its line', () => {
    expect(lineStarts('a\r\nb\rc\nd')).toEqual([0, 3, 7])
    expect(placeAtLine([0, 3, 7], 2)).toEqual({
      start: { line: 2, column: 1, offset: 3 },
      end: { line: 2, column: 1, offset: 3 },
    })
  })
})
