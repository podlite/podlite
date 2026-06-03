import * as path from 'path'
import { runLint } from '../src/lint'
import { parseContent, readFile } from '../src/lint/loader'
import { headingHierarchyRule, HEADING_HIERARCHY_RULE_ID } from '../src/lint/rules/heading-hierarchy'
import type { LintContext } from '../src/lint/types'

const FIXTURES = path.join(__dirname, 'lint-fixtures')

describe('heading-hierarchy rule', () => {
  const ctx: LintContext = { filePath: 'fake.podlite', fileType: 'podlite', config: {} }

  it('exposes stable slug and warning severity', () => {
    expect(HEADING_HIERARCHY_RULE_ID).toBe('heading-hierarchy')
    expect(headingHierarchyRule.id).toBe('heading-hierarchy')
    expect(headingHierarchyRule.severity).toBe('warning')
  })

  it('flags h1→h3 jump in podlite', () => {
    const ast = parseContent(readFile(path.join(FIXTURES, 'heading-jump.podlite')), 'podlite')
    const v = headingHierarchyRule.check(ast, ctx)
    expect(v).toHaveLength(1)
    expect(v[0].message).toMatch(/from 1 to 3/)
  })

  it('flags h1→h3 jump in markdown via unified AST', () => {
    const ast = parseContent(readFile(path.join(FIXTURES, 'heading-jump.md')), 'md')
    const v = headingHierarchyRule.check(ast, ctx)
    expect(v).toHaveLength(1)
    expect(v[0].message).toMatch(/from 1 to 3/)
  })

  it('allows descending and same-level sequences', () => {
    const ast = parseContent(readFile(path.join(FIXTURES, 'heading-ok.podlite')), 'podlite')
    expect(headingHierarchyRule.check(ast, ctx)).toEqual([])
  })

  it('allows a single heading at any level', () => {
    const ast = parseContent('=head3 Only one\n', 'podlite')
    expect(headingHierarchyRule.check(ast, ctx)).toEqual([])
  })
})

describe('runLint heading-hierarchy integration', () => {
  let stdout: jest.SpyInstance

  beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })
  afterEach(() => {
    stdout.mockRestore()
  })

  it('non-strict + heading jump → exit 0 with warning emitted', () => {
    const code = runLint([path.join(FIXTURES, 'heading-jump.podlite')], { strict: false, format: 'text' })
    expect(code).toBe(0)
    const out = stdout.mock.calls.map(c => c[0]).join('')
    expect(out).toMatch(/warning: Heading level jump.*\(heading-hierarchy\)/)
  })

  it('strict + heading jump → exit 1', () => {
    const code = runLint([path.join(FIXTURES, 'heading-jump.podlite')], { strict: true, format: 'text' })
    expect(code).toBe(1)
  })

  it('clean fixture → exit 0, no output', () => {
    const code = runLint([path.join(FIXTURES, 'heading-ok.podlite')], { strict: true, format: 'text' })
    expect(code).toBe(0)
    expect(stdout).not.toHaveBeenCalled()
  })
})
