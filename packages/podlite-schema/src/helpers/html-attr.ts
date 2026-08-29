// The value of an attribute written inside double quotes. The ampersand goes
// first: escaping it after the quote would rewrite the `&quot;` this produced. A
// value arrives as document text, so every `&` in it is a literal one the
// browser must not read as a character reference.
export const quoteAttribute = (value: string): string => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
