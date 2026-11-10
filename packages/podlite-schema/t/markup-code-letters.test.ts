import { MARKUP_CODE_LETTERS, isMarkupCodeLetter } from '../src/markup-code-letters'

describe('markup code letters', () => {
  it('lists the 26 letters A to Z', () => {
    expect(MARKUP_CODE_LETTERS.join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ')
  })

  it.each(['B', 'Q', 'Y'])('takes %s', letter => {
    expect(isMarkupCodeLetter(letter)).toBe(true)
  })

  it.each(['b', '*', 'BI', 'B,I', '', 42, undefined])('refuses %p', value => {
    expect(isMarkupCodeLetter(value)).toBe(false)
  })
})
