import { podlite } from '../../core/src'
import { runSelector } from '../src/selectors'

const read = (body: string) => {
  const p = podlite({ importPlugins: true })
  const ast = p.toAst(p.parse(`=begin pod\n${body}\n=end pod\n`, { podMode: 1 }))
  const heads: any[] = []
  const walk = (node: any) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    if (node.type === 'block' && node.name === 'head') heads.push(node)
    walk(node.content)
  }
  walk(ast)
  return {
    head: heads[0],
    selected: runSelector('head2[ :numbered ]', [{ file: 'x.podlite', node: ast }]).length,
    html: p.toHtml(ast).toString(),
  }
}

describe('a heading whose first word is a single #', () => {
  const forms = {
    abbreviated: '=head2 # Shorthand',
    paragraph: '=for head2\n# Shorthand',
    delimited: '=begin head2\n# Shorthand\n=end head2',
  }

  for (const [form, body] of Object.entries(forms)) {
    it(`is numbered in the ${form} form`, () => {
      const { head, selected, html } = read(body)
      expect(selected).toBe(1)
      expect(head.numberPrefix).toBe('1.')
      expect(html).toContain('Shorthand')
      expect(html).not.toContain('#')
    })
  }

  it('keeps its other attributes', () => {
    const { head, selected, html } = read('=for head2 :id<x>\n# Shorthand')
    expect(selected).toBe(1)
    expect(head.numberPrefix).toBe('1.')
    expect(html).toContain('id="x"')
  })

  it('keeps the formatting codes written after the #', () => {
    const { html } = read('=head2 # Use B<bold> here')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).not.toContain('#')
  })

  it('is numbered once over a :!numbered given by =set', () => {
    const { head, selected } = read('=set :!numbered\n=head2 # Shorthand')
    expect(selected).toBe(1)
    expect(head.numberPrefix).toBe('1.')
    expect(head.config.filter((c: any) => c.name === 'numbered')).toHaveLength(1)
  })

  it('is numbered once with an explicit :numbered', () => {
    const { head, selected, html } = read('=for head2 :numbered\n# Shorthand')
    expect(selected).toBe(1)
    expect(head.config.filter((c: any) => c.name === 'numbered')).toHaveLength(1)
    expect(html).not.toContain('#')
  })

  it('stays as written with an explicit :!numbered', () => {
    const { head, selected, html } = read('=for head2 :!numbered\n# Literal')
    expect(selected).toBe(0)
    expect(head.numberPrefix).toBeUndefined()
    expect(html).toContain('# Literal')
    expect(head.content[0].text).toBe('# Literal\n')
    expect(head.config.filter((c: any) => c.name === 'numbered')).toEqual([expect.objectContaining({ value: false })])
  })

  it('stays as written with an explicit :!numbered over a type-wide :numbered', () => {
    const { head, selected } = read('=config head2 :numbered\n\n=for head2 :!numbered\n# Literal')
    expect(selected).toBe(0)
    expect(head.numberPrefix).toBeUndefined()
    expect(head.content[0].text).toBe('# Literal\n')
  })

  it('is numbered over a type-wide :!numbered', () => {
    const { head, selected } = read('=config head2 :!numbered\n\n=head2 # Shorthand')
    expect(selected).toBe(1)
    expect(head.numberPrefix).toBe('1.')
  })
})

describe('a # that is not a whole first word', () => {
  const written = ['C# tips', '#Hash topic', '## twice', 'Topic # later']

  for (const text of written) {
    it(`leaves "${text}" unnumbered and as written`, () => {
      const { head, selected } = read(`=head2 ${text}`)
      expect(selected).toBe(0)
      expect(head.numberPrefix).toBeUndefined()
      expect(head.content[0].text).toBe(`${text}\n`)
      expect(Array.isArray(head.config ?? [])).toBe(true)
    })
  }
})

describe('a heading with a # that is not a whole first word keeps its attributes', () => {
  it('keeps an explicit :id', () => {
    expect(read('=for head2 :id<x>\nC# tips').html).toContain('id="x"')
  })

  it('keeps an explicit :numbered', () => {
    const { head, selected } = read('=for head2 :numbered\nC# tips')
    expect(selected).toBe(1)
    expect(head.numberPrefix).toBe('1.')
  })
})

describe('headings numbered without the #', () => {
  it('numbers a heading written with :numbered', () => {
    expect(read('=for head2 :numbered\nPlain').head.numberPrefix).toBe('1.')
  })

  it('numbers headings by =config', () => {
    expect(read('=config head2 :numbered\n\n=head2 Plain').head.numberPrefix).toBe('1.')
  })
})

describe('code inside an item', () => {
  for (const text of ['# Literal', '[x] Literal']) {
    it(`keeps "${text}" as written`, () => {
      const p = podlite({ importPlugins: true })
      const ast = p.toAst(p.parse(`=begin pod\n=begin item\n    ${text}\n=end item\n=end pod\n`, { podMode: 1 }))
      expect(p.toHtml(ast).toString()).toContain(`<code>${text}\n</code>`)
    })
  }
})
