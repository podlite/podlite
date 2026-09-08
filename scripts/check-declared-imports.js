// A package that imports what its manifest does not declare works only while a
// neighbour happens to install the same thing. The neighbour is free to stop.
//
// Three places are read, because a dependency can enter from any of them:
//   src            what the author wrote
//   lib, esm       what the compiler emitted, which can add its own imports;
//                  importHelpers turns into require("tslib") that appears nowhere
//                  in the sources
//   *.d.ts         what the published types refer to, which a consumer resolves
//
// A type-only import in the sources is erased by the compiler and may come from
// devDependencies. The same import inside a published .d.ts is not erased: the
// consumer resolves it, and devDependencies are not installed for them, so it has
// to be a runtime dependency there.
//
// WHAT IT MODELS, and what it does not. This reads syntax, so it sees a reference
// only where one is written as a literal: import and export declarations, import
// assignments, dynamic import, require, module.require, require.resolve, triple
// slash type references, and module augmentation. A dependency can also arrive
// through a name the code binds to a loader - createRequire is the common one -
// and no amount of syntax will show that. Specifiers built at runtime are listed
// as unchecked, and so is a file that mentions createRequire by name - but only
// that name: a loader bound some other way passes in silence and always will.
// Read the unchecked lines. A clean exit means nothing was found in what could be
// read, not that nothing is there.
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const ROOTS = process.argv[2]
  ? [path.resolve(process.argv[2])]
  : fs.readdirSync(path.join(__dirname, '..', 'packages')).map(name => path.join(__dirname, '..', 'packages', name))

const BUILTIN = new Set(require('module').builtinModules)

const packageOf = spec => {
  if (spec.startsWith('.') || spec.startsWith('/')) return null
  const parts = spec.split('/')
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

// Angle-bracket type assertions are valid TypeScript and invalid JSX. Parsing a
// .ts file as TSX misreads them and quietly drops whatever follows
const kindOf = file => (/\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS)

const sourcesIn = dir => {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourcesIn(full)
    return /\.(m|c)?[jt]sx?$/.test(entry.name) ? [full] : []
  })
}

const unchecked = []

// require(...), import(...) and module.require(...) all load a module; an
// unrelated object's own require method does not
const isModuleLoad = expression => {
  if (expression.kind === ts.SyntaxKind.ImportKeyword) return true
  if (ts.isIdentifier(expression)) return expression.text === 'require'
  if (!ts.isPropertyAccessExpression(expression)) return false
  // require.resolve names a package as surely as require does
  if (ts.isIdentifier(expression.expression) && expression.expression.text === 'require') {
    return expression.name.text === 'resolve'
  }
  return (
    expression.name.text === 'require' &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'module'
  )
}

const typesPackageFor = name =>
  name.startsWith('@types/') ? null : '@types/' + name.replace('@', '').replace('/', '__')

// import { type A } from 'x' erases just like import type does, but says so on
// each name instead of on the declaration
const bindingIsTypeOnly = clause => {
  if (clause.isTypeOnly) return true
  if (clause.name) return false
  const bindings = clause.namedBindings
  if (!bindings || !ts.isNamedImports(bindings)) return false
  return bindings.elements.length > 0 && bindings.elements.every(element => element.isTypeOnly)
}

const exportIsTypeOnly = clause => {
  if (!clause || !ts.isNamedExports(clause)) return false
  return clause.elements.length > 0 && clause.elements.every(element => element.isTypeOnly)
}

// Every import a file reaches for, each marked by whether it survives compilation
const importsOf = (file, root) => {
  const text = fs.readFileSync(file, 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kindOf(file))
  const declaration = /\.d\.(m|c)?ts$/.test(file)
  const found = []

  // /// <reference types="x" /> pulls a package in for the consumer as surely as
  // an import does
  for (const reference of source.typeReferenceDirectives || []) {
    const name = packageOf(reference.fileName)
    // A directive names the types, and those usually live in @types: a reference to
    // jest is satisfied by @types/jest
    if (name)
      found.push({ name, alias: typesPackageFor(name), typeOnly: true, declaration, file: path.relative(root, file) })
  }
  const visit = node => {
    let literal = null
    let typeOnly = false
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      literal = node.moduleSpecifier
      typeOnly = !!node.importClause && bindingIsTypeOnly(node.importClause)
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      literal = node.moduleSpecifier
      typeOnly = node.isTypeOnly || exportIsTypeOnly(node.exportClause)
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      literal = node.moduleReference.expression
      typeOnly = !!node.isTypeOnly
    } else if (ts.isModuleDeclaration(node) && ts.isStringLiteral(node.name)) {
      // Inside a module, declare module 'x' augments x and therefore needs it.
      // In a file that is not a module it declares x instead, and needs nothing
      if (ts.isExternalModule(source)) {
        literal = node.name
        typeOnly = true
      }
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      literal = node.argument.literal
      typeOnly = true
    } else if (ts.isCallExpression(node) && isModuleLoad(node.expression)) {
      literal = node.arguments[0]
    }
    if (literal) {
      if (ts.isStringLiteralLike(literal)) {
        const name = packageOf(literal.text)
        if (name) found.push({ name, typeOnly, declaration, file: path.relative(root, file) })
      } else {
        unchecked.push(`${path.relative(root, file)}: ${literal.getText(source)}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)

  // A loader bound to a name is beyond syntax: say so instead of passing quietly
  if (/\bcreateRequire\b/.test(text)) {
    unchecked.push(`${path.relative(root, file)}: createRequire binds a loader this cannot follow`)
  }
  return found
}

let failed = 0

for (const root of ROOTS) {
  const manifestPath = path.join(root, 'package.json')
  if (!fs.existsSync(manifestPath)) continue
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const runtime = new Set([
    ...Object.keys(manifest.dependencies || {}),
    ...Object.keys(manifest.peerDependencies || {}),
    ...Object.keys(manifest.optionalDependencies || {}),
  ])
  const anyKind = new Set([...runtime, ...Object.keys(manifest.devDependencies || {})])

  const uses = []
  for (const dir of ['src', 'lib', 'esm']) {
    for (const file of sourcesIn(path.join(root, dir))) uses.push(...importsOf(file, root))
  }

  // Each use is judged on its own. Folding them together first let a type
  // reference, which an @types package satisfies, cover a plain import of the
  // same name, which it does not
  const satisfied = use =>
    use.name === manifest.name ||
    BUILTIN.has(use.name) ||
    use.name.startsWith('node:') ||
    (use.typeOnly && !use.declaration ? anyKind : runtime).has(use.name) ||
    (use.alias && (use.typeOnly && !use.declaration ? anyKind : runtime).has(use.alias))

  // One line per package, showing the use that is hardest to satisfy
  const rank = use => (!use.typeOnly ? 2 : use.declaration ? 1 : 0)
  const worst = new Map()
  for (const use of uses.filter(u => !satisfied(u))) {
    const seen = worst.get(use.name)
    if (!seen || rank(use) > rank(seen)) worst.set(use.name, use)
  }
  const missing = [...worst.values()]

  if (missing.length) {
    failed += missing.length
    console.log(`${manifest.name}: ${missing.length} imported but not declared`)
    for (const use of missing) {
      const how = !use.typeOnly ? 'value' : use.declaration ? 'published type' : 'type'
      console.log(`  ${use.name.padEnd(34)} ${how.padEnd(15)} ${use.file}`)
    }
  }
}

if (unchecked.length) {
  console.log(`check-declared-imports: ${unchecked.length} computed specifiers could not be checked:`)
  for (const line of unchecked.slice(0, 10)) console.log(`  ${line}`)
}
if (failed) process.exitCode = 1
else if (unchecked.length) console.log('check-declared-imports: every import it could read is declared')
else console.log('check-declared-imports: every import is declared')
