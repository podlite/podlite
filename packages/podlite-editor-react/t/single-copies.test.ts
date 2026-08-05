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
