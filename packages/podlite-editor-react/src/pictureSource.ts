// The :src option of a picture written so that it reads back as the same string:
// angle brackets for a value without space or brackets, quotes otherwise. A quoted
// value holds no quote of its own kind and no line end; a value with both quotes and
// a space or a bracket has no spelling the parser reads back, and is left in brackets
// for the author to see.
export const sourceOption = (value: string): string => {
  if (/^[^\s<>]+$/.test(value)) return `:src<${value}>`
  if (!value.includes("'")) return `:src('${value}')`
  if (!value.includes('"')) return `:src("${value}")`
  return `:src<${value}>`
}
