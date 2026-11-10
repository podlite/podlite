/*
=begin pod :kind<module>

=TITLE The letters of markup codes

The letters the specification names markup codes by, from its table of codes.
The reader of codes and the checker take a letter from here rather than each
deciding what one is.

=end pod
*/

/*
=begin pod :kind<export>

=head2 MARKUP_CODE_LETTERS

The 26 letters C<A> to C<Z>. C<Q> and C<Y> are reserved and still listed: a
reserved code written in a document is read as a code.

=end pod
*/
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

/*
=begin pod :kind<export>

=head2 isMarkupCodeLetter

Whether a value is one letter of a markup code: a string of exactly one
character from C<MARKUP_CODE_LETTERS>. C<"BI">, C<"B,I">, a lower-case letter and
anything not a string are not. It costs the same for every value, since the
reader of codes asks it of each character.

=end pod
*/
export const isMarkupCodeLetter = (value: unknown): boolean =>
  typeof value === 'string' && value.length === 1 && LETTERS.has(value)
