import matter from 'gray-matter'
import yaml from 'js-yaml'

// A Markdown document names the language of its front matter itself, and gray-matter
// runs a front matter written in JavaScript. So the language is looked up first:
// YAML and JSON are read, any other language is refused with the name of the file.
const languages = new Map<string, 'yaml' | 'json'>([
  ['', 'yaml'],
  ['yaml', 'yaml'],
  ['yml', 'yaml'],
  ['json', 'json'],
])
type Fields = { [name: string]: unknown }
type Engine = { parse: (text: string) => Fields }
// front matter that holds no mapping, a single number, word or list, gives no fields
const fieldsOf = (value: unknown): Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {}
const engineOf: { [kind: string]: Engine } = {
  yaml: { parse: (text: string) => fieldsOf(yaml.safeLoad(text)) },
  json: { parse: (text: string) => fieldsOf(JSON.parse(text)) },
}
const refused: Engine = {
  parse: () => {
    throw new Error('front matter in JavaScript is not read')
  },
}

// The front matter the way gray-matter finds it: after one byte order mark, three
// dashes not followed by a fourth, then the language up to the end of the line.
const DELIMITER = '---'
const languageOf = (text: string): { name: string; line: string } | null => {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  if (!body.startsWith(DELIMITER) || body.charAt(DELIMITER.length) === '-') return null
  const rest = body.slice(DELIMITER.length)
  return { name: matter.language(rest).name, line: rest.split(/\r?\n/, 1)[0].trim() }
}

// The front matter of a Markdown text and the text after it; a text without front
// matter comes back whole.
export const readFrontMatter = (text: string, file = 'the text'): { data: Fields; content: string } => {
  const found = languageOf(text)
  const engines: { [name: string]: Engine } = { ...engineOf, javascript: refused }
  if (found) {
    const kind = languages.get(found.name.toLowerCase())
    if (!kind) throw new Error(`front matter in ${file} is written in ${found.line}; only YAML and JSON are read`)
    // gray-matter takes the engine by the name the document wrote, as written
    if (found.name) engines[found.name] = engineOf[kind]
  }
  const { data, content } = matter(text, { language: 'yaml', engines })
  return { data, content }
}
