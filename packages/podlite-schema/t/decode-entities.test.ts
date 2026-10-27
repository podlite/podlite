import { decodeEntities } from '../src'

describe('decodeEntities', () => {
  it('gives the character of a code point and of a name', () => {
    expect(
      decodeEntities([
        { type: 'number', value: 0x1f600 },
        { type: 'html_named', value: 'hellip' },
      ]),
    ).toBe('\u{1F600}…')
  })

  it('gives nothing for a number that is not a Unicode scalar value', () => {
    expect(decodeEntities([{ type: 'number', value: 65.5 }])).toBe('')
    expect(decodeEntities([{ type: 'number', value: 0xd800 }])).toBe('')
    expect(decodeEntities([{ type: 'number', value: NaN }])).toBe('')
  })
})
