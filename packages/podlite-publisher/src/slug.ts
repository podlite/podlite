// the 60 digits of NewBase60: no I, O or l
const DIGITS = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ_abcdefghijkmnopqrstuvwxyz'

// days since the Unix epoch in base 60; empty before the epoch and for an invalid date
export const dayInBase60 = (date: Date): string => {
  let day = Math.floor(date.getTime() / 86400000)
  if (!Number.isFinite(day) || day < 0) return ''
  if (day === 0) return '0'
  let digits = ''
  for (; day > 0; day = Math.floor(day / 60)) digits = DIGITS[day % 60] + digits
  return digits
}

const LETTERS = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяіѣѳѵ'
const LATIN = 'a b v g d e yo zh z i j k l m n o p r s t u f x cz ch sh shh `` y` ` e` yu ya i` ye fh yh'.split(' ')
const table = new Map<string, string>()
LATIN.forEach((latin, at) => {
  table.set(LETTERS[at], latin)
  table.set(LETTERS[at].toUpperCase(), latin.toUpperCase())
})
// addresses already published carry these
for (let unit = 0x1c80; unit <= 0x1c87; unit++) table.set(String.fromCharCode(unit), 'undefined')
table.set('№', '#')
table.set('’', "'")

// the letters that keep a Latin i without a mark after it, in either case
const KEEPS_I = new Set([...'аеиоуъАЕИОУЪ', 'ᲂ', 'ᲆ'])
const LINE_ENDS = new Set(['\n', '\r', '\u2028', '\u2029'])

// Cyrillic in Latin letters, GOST 7.79 system B, counted in UTF-16 units as published addresses were
export const latinOf = (text: string): string => {
  let marked = ''
  for (let at = 0; at < text.length; at++) {
    marked += text[at]
    const next = text[at + 1]
    const after = text[at + 2]
    if ((text[at] === 'i' || text[at] === 'I') && next !== undefined && !LINE_ENDS.has(next))
      if (after !== undefined && !/\s/.test(after) && !KEEPS_I.has(after)) marked += '`'
  }
  let latin = ''
  for (const unit of marked.split('')) latin += table.get(unit) ?? unit
  return latin.replace(/[iI]``/g, 'i`')
}
