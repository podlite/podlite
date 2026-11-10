// The letters the specification names markup codes by, from its table of codes;
// Q and Y are reserved, which is still a code. The reader of codes and the
// checker take a letter from here rather than each deciding what one is.
export const MARKUP_CODE_LETTERS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
] as const

// the reader asks this of every character, so a letter is found without searching the list
const LETTERS = new Set<string>(MARKUP_CODE_LETTERS)

export const isMarkupCodeLetter = (value: unknown): boolean =>
  typeof value === 'string' && value.length === 1 && LETTERS.has(value)
