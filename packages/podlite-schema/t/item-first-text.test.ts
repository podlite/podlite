import { podlitePluggable } from '../src/pluggableParser'
import { runSelector } from '../src/selectors'

// the tree is read by field, so a test needs no cast
const field = (node: unknown, key: string): unknown =>
  typeof node === 'object' && node !== null ? Reflect.get(node, key) : undefined
const kids = (node: unknown): unknown[] => {
  const content = field(node, 'content')
  return Array.isArray(content) ? content : []
}
const all = (node: unknown): unknown[] => [node, ...kids(node).flatMap(all)]
const text = (node: unknown): string => {
  if (typeof node === 'string') return node
  const value = field(node, 'value')
  return (typeof value === 'string' ? value : '') + kids(node).map(text).join('')
}

const read = (src: string) => {
  const p = podlitePluggable()
  const ast = p.toAst(p.parse(src))
  const nodes = all(ast)
  const item = nodes.find(n => field(n, 'type') === 'block' && field(n, 'name') === 'item')
  const list = nodes.find(n => field(n, 'type') === 'list')
  const config = field(item, 'config')
  return {
    item,
    list: field(list, 'list'),
    checked: field(item, 'checked'),
    checkedConfig: (Array.isArray(config) ? config : [])
      .filter(c => field(c, 'name') === 'checked')
      .map(c => field(c, 'value')),
    numbered: (Array.isArray(config) ? config : []).some(
      c => field(c, 'name') === 'numbered' && field(c, 'value') === true,
    ),
    body: text(item),
    html: String(p.toHtml(ast)),
    markdown: String(p.toMarkdown(ast)),
    selected: runSelector('item[ :checked ]', [{ file: 'x.podlite', node: ast }]).length,
  }
}

describe('a check box read from the first text of an item', () => {
  it.each([
    ['after a blank line', '=begin item\n\n[x] task\n=end item\n', true],
    ['after a blank line, unchecked', '=begin item\n\n[ ] task\n=end item\n', false],
    ['after =config', '=begin item\n=config para :x\n[x] task\n=end item\n', true],
    ['after =alias', '=begin item\n=alias A x\n[x] task\n=end item\n', true],
  ])('%s', (_, src, value) => {
    const found = read(src)
    expect(found.list).toBe('task')
    expect(found.checked).toBe(value)
    expect(found.checkedConfig).toEqual([value])
    expect(found.body).not.toContain('[')
    expect(found.body).toContain('task')
  })

  it('shows the box in HTML and Markdown and is found by its selector', () => {
    const found = read('=begin item\n\n[x] task\n=end item\n')
    expect(found.html).toContain('type="checkbox"')
    expect(found.markdown).toContain('- [x] task')
    expect(found.selected).toBe(1)
  })

  it('makes no task of implicit code that starts the item', () => {
    const found = read('=begin item\n  [x] code\n=end item\n')
    expect(found.list).toBe('itemized')
    expect(found.checked).toBeUndefined()
    expect(found.checkedConfig).toEqual([])
    expect(found.body).toContain('[x] code')
    expect(field(kids(found.item)[0], 'text')).toBe('[x] code\n')
  })

  it('reads a box after =config, which comes after the check box is read', () => {
    const found = read('=config item :!checked\n\n=begin item\n\n[x] a\n=end item\n')
    expect(found.checked).toBe(true)
    expect(found.checkedConfig).toEqual([true])
    expect(found.body.trim()).toBe('a')
  })

  it('reads a box after a blank line written with CRLF', () => {
    const found = read('=begin item\r\n\r\n[x] task\r\n=end item\r\n')
    expect(found.list).toBe('task')
    expect(found.body).toContain('task\r\n')
    expect(found.body).not.toContain('[x]')
  })

  it('leaves the box of a nested item to that item', () => {
    const p = podlitePluggable()
    const items = all(
      p.toAst(p.parse('=begin item1\n=begin item2\n[x] child\n=end item2\n\n[x] later\n=end item1\n')),
    ).filter(n => field(n, 'type') === 'block' && field(n, 'name') === 'item')
    expect(items.map(n => field(n, 'checked'))).toEqual([undefined, true])
  })

  it.each([
    ['a box first, then a #', '=begin item\n\n[x] # a\n=end item\n', 'ordered', true],
    ['a # first, then a box', '=begin item\n\n# [x] a\n=end item\n', 'ordered', false],
  ])('reads %s after a blank line', (_, src, list, box) => {
    const found = read(src)
    expect(found.numbered).toBe(true)
    expect(found.list).toBe(list)
    expect(found.body.includes('[x]')).toBe(!box)
    expect(found.checked).toBe(box ? true : undefined)
  })
})

describe('a check box that stays text', () => {
  it.each([
    ['after implicit code', '=begin item\n  code\n\n[x] later\n=end item\n'],
    ['after a nested paragraph', '=begin item\n=para x\n\n[x] later\n=end item\n'],
    ['after a comment', '=begin item\n=begin comment\nnote\n=end comment\n[x] later\n=end item\n'],
  ])('%s: the search stops at the first element', (_, src) => {
    const found = read(src)
    expect(found.checked).toBeUndefined()
    expect(found.body).toContain('[x] later')
  })

  it.each([
    ['a :checked on the item', '=for item :checked\n[ ] a\n', true],
    ['a :checked on a delimited item before a blank line', '=begin item :checked\n\n[ ] a\n=end item\n', true],
    ['an =set before the item', '=set :!checked\n=item [x] a\n', false],
  ])('when %s decides', (_, src, value) => {
    const found = read(src)
    expect(found.checked).toBe(value)
    expect(found.body).toContain('[')
  })

  it('keeps the old reading of a box on the first line', () => {
    expect(read('=for item\n[x] a\n').checked).toBe(true)
    expect(read('=item [x] a\r\n').body).toContain('a\r\n')
  })
})
