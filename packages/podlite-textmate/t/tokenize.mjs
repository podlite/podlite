// Runs the real shiki in a plain Node process: jest cannot load shiki's ES modules.
// Input on stdin: { grammar, cases: [{ code, lang, theme, engine }] }, where grammar is
// a path to a JSON file or a module to import podliteGrammar from.
// Output: for each case, every explained piece with its offset, colour, style and scopes.
import { createHighlighter, createOnigurumaEngine } from 'shiki'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { readFileSync } from 'node:fs'

const input = JSON.parse(readFileSync(0, 'utf8'))

const loadGrammar = async spec => {
  if (spec.json) return JSON.parse(readFileSync(spec.json, 'utf8'))
  const module = await import(spec.module)
  return module.podliteGrammar ?? module.default?.podliteGrammar
}

const grammar = await loadGrammar(input.grammar)
const themes = [...new Set(input.cases.map(c => c.theme))]
const highlighters = {}
const highlighterFor = async engine => {
  if (!highlighters[engine]) {
    highlighters[engine] = await createHighlighter({
      langs: [grammar],
      themes,
      engine: engine === 'javascript' ? createJavaScriptRegexEngine() : createOnigurumaEngine(import('shiki/wasm')),
    })
  }
  return highlighters[engine]
}

const results = []
for (const c of input.cases) {
  const h = await highlighterFor(c.engine || 'oniguruma')
  const out = h.codeToTokens(c.code, { lang: c.lang || 'podlite', theme: c.theme, includeExplanation: true })
  const pieces = []
  out.tokens.forEach(line => {
    for (const token of line) {
      let offset = token.offset
      for (const e of token.explanation ?? [{ content: token.content, scopes: [] }]) {
        pieces.push({
          offset,
          text: e.content,
          color: token.color,
          fontStyle: token.fontStyle ?? 0,
          scopes: e.scopes.map(s => s.scopeName),
        })
        offset += e.content.length
      }
    }
  })
  results.push({ fg: out.fg, pieces })
}
process.stdout.write(JSON.stringify(results))
