// A relative specifier without an extension is what tsc writes and what Node's ESM
// loader refuses. tsc never rewrites specifiers, so the extension is added here,
// after the build, over the emitted esm/ directories.
//
// The files are parsed rather than searched: an earlier regex version rewrote a path
// that sat inside a console.warn message. Only real import and export declarations
// and dynamic import calls are touched.
//
// Idempotent on purpose: tsc is incremental and skips emit when sources are
// unchanged, so this walks already-corrected output on most runs.
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

// Called once per package from g:build with the package directory, and with no
// argument it walks them all, which is what a one-off run wants.
const ROOTS = process.argv[2]
  ? [path.resolve(process.argv[2])]
  : fs
      .readdirSync(path.join(__dirname, '..', 'packages'))
      .map(name => path.join(__dirname, '..', 'packages', name))

const resolveTarget = (fromFile, spec) => {
  if (/\.(js|json|mjs|cjs|css)$/.test(spec)) return null
  const base = path.resolve(path.dirname(fromFile), spec)
  if (fs.existsSync(base + '.js')) return spec + '.js'
  if (fs.existsSync(path.join(base, 'index.js'))) return spec.replace(/\/+$/, '') + '/index.js'
  return undefined
}

const unchecked = []

const specifiersOf = source => {
  const found = []
  const visit = node => {
    let literal = null
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      literal = node.moduleSpecifier
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      literal = node.arguments[0]
    }
    if (literal && ts.isStringLiteral(literal)) {
      if (literal.text.startsWith('.')) found.push(literal)
    } else if (literal) {
      // A computed specifier cannot be checked here. None exist today; report one
      // rather than let it pass as if it had been looked at.
      unchecked.push(literal.getText().slice(0, 60))
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

const jsFiles = dir =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? jsFiles(full) : entry.name.endsWith('.js') ? [full] : []
  })

let rewritten = 0
let touched = 0
const orphans = []

for (const root of ROOTS) {
  const esm = path.join(root, 'esm')
  if (!fs.existsSync(esm)) continue
  for (const file of jsFiles(esm)) {
    const before = fs.readFileSync(file, 'utf8')
    const source = ts.createSourceFile(file, before, ts.ScriptTarget.Latest, true)
    const edits = []
    for (const literal of specifiersOf(source)) {
      const target = resolveTarget(file, literal.text)
      if (target === null) continue
      if (target === undefined) {
        orphans.push(`${path.relative(root, file)}: ${literal.text}`)
        continue
      }
      edits.push({ start: literal.getStart() + 1, end: literal.getEnd() - 1, target })
    }
    if (!edits.length) continue
    let after = before
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      after = after.slice(0, edit.start) + edit.target + after.slice(edit.end)
    }
    fs.writeFileSync(file, after)
    rewritten += edits.length
    touched++
  }
}

console.log(`fix-esm-specifiers: rewrote ${rewritten} specifiers in ${touched} files`)
if (unchecked.length) {
  console.log(`fix-esm-specifiers: ${unchecked.length} computed specifiers could not be checked:`)
  for (const line of unchecked.slice(0, 10)) console.log(`  ${line}`)
}
if (orphans.length) {
  console.log(`fix-esm-specifiers: ${orphans.length} specifiers point at nothing and were left alone:`)
  for (const line of orphans.slice(0, 10)) console.log(`  ${line}`)
  process.exitCode = 1
}
