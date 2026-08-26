import { execFileSync } from 'child_process'
import { join } from 'path'

// Two copies of the same package make an extension do nothing at all, without
// an error: the extension comes from one set of modules, the editor state from
// another, so it never finds its own field
const CRITICAL = ['@codemirror/state', '@codemirror/view', '@codemirror/language', '@lezer/common', '@lezer/highlight']

const root = join(__dirname, '..', '..', '..')

const copiesOf = (pkg: string): string[] =>
  execFileSync('find', ['node_modules', '-path', `*node_modules/${pkg}/package.json`], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    .map(p => p.replace(/\/package\.json$/, ''))

describe('one copy of each package the editor builds on', () => {
  for (const pkg of CRITICAL) {
    it(pkg, () => {
      expect(copiesOf(pkg)).toHaveLength(1)
    })
  }
})

describe('the editor and the renderer highlight from one module', () => {
  // Two copies would mean two highlighters, each fetching the same grammar and
  // keeping its own cache, which is the thing the shared package removes
  const resolvedFrom = (pkg: string) => require.resolve('@podlite/highlight', { paths: [join(root, 'packages', pkg)] })

  it('resolves to the same file from both packages', () => {
    expect(resolvedFrom('podlite-editor-react')).toBe(resolvedFrom('podlite-to-jsx'))
  })

  it('hands out the shared component, not a copy of its own', () => {
    const fromEditor = require('@podlite/editor-react').HighlightedCode
    const shared = require('@podlite/highlight').HighlightedCode
    expect(fromEditor).toBeDefined()
    expect(fromEditor).toBe(shared)
  })
})
