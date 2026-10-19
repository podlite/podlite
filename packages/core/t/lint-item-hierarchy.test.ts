import { runLint, lintSource } from '../src/lint'
import { sourcesFromFiles } from '../src/assemble'
import { parseContent } from '../src/lint/loader'
import { itemHierarchyRule, ITEM_HIERARCHY_RULE_ID } from '../src/lint/rules/item-hierarchy'
import type { LintContext } from '../src/lint/types'

const ctx: LintContext = { filePath: 'fake.podlite', fileType: 'podlite', config: {} }
const check = (src: string, fileType: LintContext['fileType'] = 'podlite') =>
  itemHierarchyRule.check(parseContent(src, fileType), { ...ctx, fileType })
const withParts = (src: string, parts: Record<string, string>) =>
  itemHierarchyRule.check(parseContent(src, 'podlite'), {
    filePath: 'input.podlite',
    fileType: 'podlite',
    config: {},
    sources: sourcesFromFiles(parts),
    context: '',
    self: '/input.podlite',
  })

describe('item-hierarchy rule', () => {
  it('exposes stable slug and warning severity', () => {
    expect(ITEM_HIERARCHY_RULE_ID).toBe('item-hierarchy')
    expect(itemHierarchyRule.id).toBe('item-hierarchy')
    expect(itemHierarchyRule.severity).toBe('warning')
  })

  it('flags an item two levels below the one before it', () => {
    const v = check('=item1 One\n=item3 Three\n')
    expect(v).toHaveLength(1)
    expect(v[0].message).toBe('=item3 has no preceding =item2 in the same block')
    expect(v[0].location?.start.line).toBe(2)
  })

  it('stays silent on items in order, with text between them', () => {
    expect(check('=item1 One\n=item2 Two\n=item3 Three\n=item1 Back\n')).toEqual([])
    expect(check('=item1 One\n\nSome text.\n\n=head2 Part\n\n=item2 Two\n')).toEqual([])
  })

  it('takes =item without a number for level 1', () => {
    expect(check('=item One\n=item2 Two\n')).toEqual([])
  })

  it('counts items within their own surrounding block', () => {
    const v = check('=item1 One\n\n=begin nested\n=item2 Alone\n=end nested\n')
    expect(v.map(x => x.location?.start.line)).toEqual([4])
    expect(check('=begin nested\n=item1 One\n=item2 Two\n=end nested\n')).toEqual([])
  })

  it('flags a lower item placed inside a higher one', () => {
    const v = check('=begin item1\nThe choices are:\n=item2 Liberty\n=end item1\n')
    expect(v).toHaveLength(1)
    expect(v[0].location?.start.line).toBe(3)
  })

  it('counts items of a definition in its own block', () => {
    expect(check('=begin defn\nTerm\n\nMeaning.\n\n=item1 One\n=item2 Two\n=end defn\n')).toEqual([])
    expect(check('=item1 One\n\n=begin defn\nTerm\n\nMeaning.\n\n=item2 Two\n=end defn\n')).toHaveLength(1)
  })

  it('counts items of a table cell in its own block', () => {
    const table = (cell: string) =>
      `=item1 One\n\n=begin table\n=begin row\n=begin cell\n${cell}=end cell\n=end row\n=end table\n`
    expect(check(table('=item2 Two\n'))).toHaveLength(1)
    expect(check(table('=item1 One\n=item2 Two\n'))).toEqual([])
  })

  it('reads the level from the name, not from a :level option', () => {
    expect(check('=for item1 :level(2)\nOne\n\n=item2 Two\n')).toEqual([])
    expect(check('=for item3 :level(2)\nThree\n')).toHaveLength(1)
  })

  it('does not count an item with no usable level but reads what it holds', () => {
    const item = (level: unknown, content: unknown[] = []) => ({ type: 'block', name: 'item', level, content })
    const tree = (...content: unknown[]) => ({ type: 'block', name: 'root', content })
    const run = (...content: unknown[]) => {
      const ast: Parameters<typeof itemHierarchyRule.check>[0] = JSON.parse(JSON.stringify(tree(...content)))
      return itemHierarchyRule.check(ast, ctx).map(v => v.message)
    }
    for (const level of ['0', '', '1.5', '9007199254740993', true]) {
      expect(run(item(level), item('2'))).toEqual(['=item2 has no preceding =item1 in the same block'])
    }
    expect(run(item('x', [item('3')]))).toEqual(['=item3 has no preceding =item2 in the same block'])
  })

  it('takes no setting for an item', () => {
    expect(check('=config item1 :numbered\n\n=item2 Two\n')).toHaveLength(1)
    expect(check('=for item1 :numbered\nOne\n\n=item2 Two\n')).toEqual([])
  })

  it('leaves a Markdown list alone', () => {
    expect(check('- one\n  - two\n    - three\n', 'md')).toEqual([])
  })

  it('counts an item brought by an include as preceding', () => {
    const src = '=include file:part.podlite | item1\n\n=item2 Two\n'
    expect(withParts(src, { 'part.podlite': '=item1 One\n' })).toEqual([])
    expect(withParts('=item2 Two\n', { 'part.podlite': '=item1 One\n' })).toHaveLength(1)
  })

  it('counts the items of a file included whole as preceding', () => {
    expect(withParts('=include file:part.podlite\n\n=item2 Two\n', { 'part.podlite': '=item1 One\n' })).toEqual([])
  })

  it('counts an item of a file included inside a nested block', () => {
    const src = '=begin nested\n=include file:part.podlite\n\n=item2 Two\n=end nested\n'
    expect(withParts(src, { 'part.podlite': '=item1 One\n' })).toEqual([])
  })

  it('counts items through a folded section', () => {
    const part = '=for head1 :folded\nSection\n\n=item1 One\n'
    expect(withParts('=include file:part.podlite\n\n=item2 Two\n', { 'part.podlite': part })).toEqual([])
    expect(check('=for head1 :folded\nSection\n\n=item1 One\n=item2 Two\n')).toEqual([])
  })

  it('reports no item of an included file', () => {
    expect(withParts('=include file:part.podlite\n', { 'part.podlite': '=item1 One\n=item3 Three\n' })).toEqual([])
  })
})

describe('item-hierarchy through its callers', () => {
  let stdout: jest.SpyInstance

  beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })
  afterEach(() => {
    stdout.mockRestore()
  })

  const run = (options: Partial<Parameters<typeof runLint>[1]> = {}) => {
    const code = runLint([], { strict: false, format: 'text', stdinContent: '=item1 One\n=item3 Three\n', ...options })
    return { code, out: stdout.mock.calls.map(c => c[0]).join('') }
  }

  it('prints a warning and exits 0, or 1 in strict mode', () => {
    const plain = run()
    expect(plain.code).toBe(0)
    expect(plain.out).toMatch(/2:1: warning: =item3 has no preceding =item2 in the same block \(item-hierarchy\)/)
    expect(run({ strict: true }).code).toBe(1)
  })

  it('is turned off by its name in the configuration and on the command line', () => {
    const src = '=item1 One\n=item3 Three\n'
    expect(lintSource(src, 'x.podlite', {}).violations.map(v => v.rule)).toContain('item-hierarchy')
    const report = lintSource(src, 'x.podlite', { rules: { 'item-hierarchy': 'off' } })
    expect(report.violations.map(v => v.rule)).not.toContain('item-hierarchy')
    expect(run({ disable: ['item-hierarchy'] }).out).not.toContain('item-hierarchy')
  })
})
