import { podlitePluggable } from '../src/pluggableParser'
import { runSelector } from '../src/selectors'

type Entry = { name?: string; value?: unknown; from?: string }
type Node = {
  type?: string
  name?: string
  text?: string
  value?: unknown
  id?: string
  config?: Entry[]
  content?: unknown
}

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null && !Array.isArray(value)

const nodes = (tree: unknown, out: Node[] = []): Node[] => {
  if (Array.isArray(tree)) tree.forEach(child => nodes(child, out))
  else if (isNode(tree)) {
    out.push(tree)
    nodes(tree.content, out)
  }
  return out
}

const textOf = (node: unknown): string => {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (!isNode(node)) return ''
  if (typeof node.value === 'string') return node.value
  if (typeof node.text === 'string' && node.content === undefined) return node.text
  return textOf(node.content)
}

const read = (doc: string) => {
  const p = podlitePluggable()
  const ast = p.toAst(p.parse(doc, { podMode: 1 }))
  const all = nodes(ast)
  const block = (name: string) => all.find(n => n.type === 'block' && n.name === name)
  const numbered = (node?: Node) => (node?.config || []).filter(c => c.name === 'numbered')
  const term = all.find(n => n.type === 'para' && n.name === 'term')
  return { ast, all, block, numbered, term, html: p.toHtml(ast).toString() }
}

describe('a lone # numbers a definition', () => {
  it.each([
    ['=defn', '=defn # SUCCESS\nThe one unpardonable sin.\n'],
    ['=for defn', '=for defn\n# SUCCESS\nThe one unpardonable sin.\n'],
    ['=begin defn', '=begin defn\n# SUCCESS\nThe one unpardonable sin.\n=end defn\n'],
  ])('in the %s form', (_, doc) => {
    const { block, numbered, term } = read(doc)
    expect(numbered(block('defn'))).toEqual([{ name: 'numbered', value: true, type: 'boolean' }])
    expect(textOf(term).trim()).toBe('SUCCESS')
    expect(textOf(block('defn'))).toContain('The one unpardonable sin.')
  })

  it('keeps the body when the term is a # alone', () => {
    const { block, numbered, term, html } = read('=begin defn\n#\nBody\n=end defn\n')
    expect(numbered(block('defn'))).toHaveLength(1)
    expect(term?.text).toBe('')
    expect(html.replace(/\n/g, '')).toContain('<dt></dt><dd><p>Body</p></dd>')
  })

  it('keeps a markup code in the term', () => {
    const { term } = read('=defn # B<TERM>\nBody.\n')
    expect(JSON.stringify(term)).toContain('"name":"B"')
    expect(textOf(term)).not.toContain('#')
  })

  it('leaves the identifier of =set on the paragraph of the body', () => {
    const { all, term } = read('=begin defn\n=set :id<body>\n# TERM\nBody.\n=end defn\n')
    expect(textOf(term).trim()).toBe('TERM')
    const body = all.find(n => n.type === 'para' && n.name !== 'term' && textOf(n).includes('Body'))
    const idOf = (node?: Node) => (node?.config || []).find(c => c.name === 'id')?.value
    expect(idOf(body)).toBe('body')
    expect(idOf(term)).toBeUndefined()
  })

  it('is chosen by a selector', () => {
    const { ast } = read('=for defn :id<t>\n# TERM\nBody.\n')
    expect(runSelector('defn[ :numbered ]', [{ file: 'x.podlite', node: ast }])).toHaveLength(1)
  })

  it('removes one # of two', () => {
    expect(textOf(read('=defn # # T\nBody.\n').term).trim()).toBe('# T')
  })

  it('wins over =set :!numbered with a value of its own', () => {
    const { block, numbered } = read('=set :!numbered\n=defn # TERM\nBody.\n')
    expect(numbered(block('defn'))).toEqual([{ name: 'numbered', value: true, type: 'boolean' }])
  })
})

describe('a lone # numbers a block whose text starts after a blank line or a setting', () => {
  it.each([
    ['an item after a blank line', '=begin item\n\n# x\n=end item\n', 'item'],
    ['an item after blank lines', '=begin item\n\n\n# x\n=end item\n', 'item'],
    ['a heading after a blank line', '=begin head1\n\n# T\n=end head1\n', 'head'],
    ['an item after =config', '=begin item\n=config para :x<y>\n# x\n=end item\n', 'item'],
    ['an item after =alias', '=begin item\n=alias A word\n# x\n=end item\n', 'item'],
    ['a heading after =config', '=begin head1\n=config para :x<y>\n# T\n=end head1\n', 'head'],
    ['a definition after =config', '=begin defn\n=config para :x<y>\n# TERM\nBody.\n=end defn\n', 'defn'],
  ])('%s', (_, doc, name) => {
    const { block, numbered, all } = read(doc)
    expect(numbered(block(name))).toEqual([{ name: 'numbered', value: true, type: 'boolean' }])
    expect(textOf(block(name))).not.toMatch(/#/)
    // removing the marker changes nothing else: the blank lines stay where they were
    const blank = (tree: Node[]) => tree.filter(n => n.type === 'blankline').length
    expect(blank(all)).toBe(blank(read(doc.replace('# ', '')).all))
  })

  it('leaves the # of indented code in an item', () => {
    const { block, numbered } = read('=begin item\n  # code\n=end item\n')
    expect(numbered(block('item'))).toEqual([])
    expect(textOf(block('item'))).toContain('# code')
  })
})

describe('what stays as it was', () => {
  it('keeps a written :!numbered and its # on a definition', () => {
    const { block, numbered, term } = read('=for defn :!numbered\n# TERM\nBody.\n')
    expect(numbered(block('defn'))).toEqual([{ name: 'numbered', value: false, type: 'boolean' }])
    expect(textOf(term).trim()).toBe('# TERM')
  })

  it.each([
    ['## TERM', '=defn ## TERM\nBody.\n', '## TERM'],
    ['#TERM', '=defn #TERM\nBody.\n', '#TERM'],
  ])('leaves %s in the term', (_, doc, kept) => {
    const { block, numbered, term } = read(doc)
    expect(numbered(block('defn'))).toEqual([])
    expect(textOf(term).trim()).toBe(kept)
  })

  it('takes only the first text: code before a later # leaves it', () => {
    const { block, numbered } = read('=begin item\n  code\n\n# later\n=end item\n')
    expect(numbered(block('item'))).toEqual([])
    expect(textOf(block('item'))).toContain('# later')
    const defn = read('=begin defn\n  code\n\n# later\n=end defn\n')
    expect(defn.numbered(defn.block('defn'))).toEqual([])
  })

  it('keeps the value and source of =config and =set without the shorthand', () => {
    const config = read('=config defn :numbered\n\n=defn TERM\nBody.\n')
    expect(config.numbered(config.block('defn'))).toEqual([
      { name: 'numbered', value: true, type: 'boolean', from: 'config' },
    ])
    const set = read('=set :numbered\n=defn TERM\nBody.\n')
    expect(set.numbered(set.block('defn'))).toEqual([{ name: 'numbered', value: true, type: 'boolean', from: 'set' }])
  })

  it('reads a checkbox from the first text, as the # shorthand is read', () => {
    const { block } = read('=begin item\n\n[x] task\n=end item\n')
    expect(textOf(block('item'))).not.toContain('[x]')
  })

  it('keeps the carriage returns of a definition written with CRLF', () => {
    const { term, block } = read('=for defn\r\n# TERM\r\nBody\r\n')
    expect(term?.text).toBe('TERM\r')
    expect(textOf(block('defn'))).toContain('Body\r\n')
  })

  it('keeps =item # x and =head1 # T', () => {
    expect(read('=item # x\n').numbered(read('=item # x\n').block('item'))).toHaveLength(1)
    expect(read('=head1 # T\n').numbered(read('=head1 # T\n').block('head'))).toHaveLength(1)
  })
})
