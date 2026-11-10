// the reader of codes takes its letters from the shared list: a list without B leaves B<x> as text
jest.mock('../src/markup-code-letters', () => {
  const actual = jest.requireActual('../src/markup-code-letters')
  return { ...actual, isMarkupCodeLetter: (value: unknown) => value !== 'B' && actual.isMarkupCodeLetter(value) }
})

import { scanCodes } from '../src/codes/scan'

describe('the reader of codes and the shared letters', () => {
  it('finds no code named by a letter the list refuses', () => {
    expect(scanCodes('B<x>').codes).toEqual([])
    expect(scanCodes('I<x>').codes).toHaveLength(1)
  })
})
