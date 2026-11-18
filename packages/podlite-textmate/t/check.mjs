// Checks the cases of fixtures/cases.json against a grammar, through the real shiki.
// Usage: node check.mjs <grammar.json> → JSON report on stdout.
// Each expectation names a piece of text by its n-th occurrence; every token piece that
// overlaps it must carry (has) or must not carry (hasNot) a scope starting with the prefix.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const grammarPath = process.argv[2]
const { quickstart, cases } = JSON.parse(readFileSync(join(here, 'fixtures', 'cases.json'), 'utf8'))
const quickstartCode = readFileSync(join(here, 'fixtures', quickstart), 'utf8')
const THEMES = ['one-light', 'github-dark']

const tokenize = list =>
  JSON.parse(
    execFileSync('node', [join(here, 'tokenize.mjs')], {
      input: JSON.stringify({ grammar: { json: grammarPath }, cases: list }),
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }),
  )

const locate = (code, find, nth) => {
  let at = -1
  for (let i = 0; i <= nth; i++) {
    at = code.indexOf(find, at + 1)
    if (at < 0) return -1
  }
  return at
}

const covering = (pieces, start, length) =>
  pieces.filter(p => p.offset < start + length && p.offset + p.text.length > start && p.text.length > 0)

const carries = (piece, prefix) => piece.scopes.some(s => s === prefix || s.startsWith(prefix + '.'))

const judge = (code, pieces, e) => {
  const at = locate(code, e.find, e.nth ?? 0)
  if (at < 0) return `text "${e.find}" #${e.nth ?? 0} not found`
  const over = covering(pieces, at, e.find.length)
  if (!over.length) return `no token covers "${e.find}"`
  const show = over.map(p => `${JSON.stringify(p.text)}: ${p.scopes.slice(1).join(' > ') || '-'}`).join('; ')
  if (e.has && !over.every(p => carries(p, e.has))) return `expected ${e.has}, got ${show}`
  if (e.hasNot && over.some(p => carries(p, e.hasNot))) return `expected no ${e.hasNot}, got ${show}`
  return null
}

const caseInputs = engine => cases.map(c => ({ code: c.code, theme: 'github-dark', engine }))
const onig = tokenize(caseInputs('oniguruma'))
const js = tokenize(caseInputs('javascript'))

const report = { cases: {}, engines: {}, colours: {} }
cases.forEach((c, i) => {
  report.cases[c.id] = c.expect.map(e => judge(c.code, onig[i].pieces, e)).filter(Boolean)
  const a = JSON.stringify(onig[i].pieces.map(p => [p.offset, p.text, p.scopes]))
  const b = JSON.stringify(js[i].pieces.map(p => [p.offset, p.text, p.scopes]))
  report.engines[c.id] = a === b
})

const themed = tokenize(THEMES.map(theme => ({ code: quickstartCode, theme })))
THEMES.forEach((theme, i) => {
  const { pieces, fg } = themed[i]
  const at = (find, nth = 0) => covering(pieces, locate(quickstartCode, find, nth), find.length)[0]
  report.colours[theme] = {
    directive: at('=begin').color,
    name: at('nested').color,
    attribute: at('notice').color,
    value: at('<note>').scopes,
    cell: { color: at('Alice').color, fontStyle: at('Alice').fontStyle, fg },
    separator: at('|').scopes,
  }
})
process.stdout.write(JSON.stringify(report, null, 1))
