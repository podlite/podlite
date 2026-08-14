import { podlitePluggable } from '../src/pluggableParser'
import { toHtml, toMarkdown } from '../src'
import { makeAttrs } from '../src/helpers/config'
import { propagateConfigDefaults } from '../src/helpers/configPropagation'

const findHeads = (node: any, out: any[] = []): any[] => {
  if (Array.isArray(node)) {
    node.forEach(n => findHeads(n, out))
    return out
  }
  if (!node || typeof node !== 'object') return out
  if (node.type === 'block' && node.name === 'head') out.push(node)
  if (node.content) findHeads(node.content, out)
  return out
}

const parseToAst = (src: string) => {
  const p = podlitePluggable()
  return p.toAst(p.parse(src, { podMode: 1 }))
}

describe('=config block preconfiguration propagation', () => {
  it('applies =config defaults to subsequent matching block', () => {
    const ast = parseToAst(`
=config head2 :folded

=head2 X
`)
    const heads = findHeads(ast)
    expect(heads.length).toBe(1)
    const conf = makeAttrs(heads[0])
    expect(conf.exists('folded')).toBe(true)
  })

  it('own attribute on the block overrides =config default', () => {
    const ast = parseToAst(`
=config head2 :folded

=for head2 :!folded
Not folded
`)
    const heads = findHeads(ast)
    expect(heads.length).toBe(1)
    const conf = makeAttrs(heads[0])
    const folded = conf.getFirstValue('folded')
    expect(folded === false || folded === 0 || folded === '0').toBe(true)
  })

  it('propagates multiple attributes from one =config', () => {
    const ast = parseToAst(`
=config head1 :numbered :folded

=head1 Top
`)
    const heads = findHeads(ast)
    const conf = makeAttrs(heads[0])
    expect(conf.exists('numbered')).toBe(true)
    expect(conf.exists('folded')).toBe(true)
  })

  it('later =config replaces earlier for the same block name', () => {
    const ast = parseToAst(`
=config head2 :folded

=config head2 :numbered

=head2 X
`)
    const heads = findHeads(ast)
    const conf = makeAttrs(heads[0])
    expect(conf.exists('numbered')).toBe(true)
    expect(conf.exists('folded')).toBe(false)
  })

  it('does not affect blocks of a different type', () => {
    const ast = parseToAst(`
=config head2 :folded

=head3 Y
`)
    const heads = findHeads(ast)
    expect(heads.length).toBe(1)
    expect(heads[0].level).toBe('3')
    const conf = makeAttrs(heads[0])
    expect(conf.exists('folded')).toBe(false)
  })

  it('only affects blocks that come after the =config in source order', () => {
    const ast = parseToAst(`
=head2 Before

=config head2 :folded

=head2 After
`)
    const heads = findHeads(ast)
    expect(heads.length).toBe(2)
    expect(makeAttrs(heads[0]).exists('folded')).toBe(false)
    expect(makeAttrs(heads[1]).exists('folded')).toBe(true)
  })

  it('is a no-op when called directly on an AST without =config nodes', () => {
    const ast = parseToAst(`=head2 Plain`)
    const before = JSON.stringify(ast)
    propagateConfigDefaults(ast)
    expect(JSON.stringify(ast)).toBe(before)
  })
})

describe('=config lexical scope', () => {
  const findAll = (node: any, name: string, out: any[] = []): any[] => {
    if (Array.isArray(node)) {
      node.forEach(n => findAll(n, name, out))
      return out
    }
    if (!node || typeof node !== 'object') return out
    if (node.type === 'block' && node.name === name) out.push(node)
    if (node.content) findAll(node.content, name, out)
    return out
  }

  it('a declaration inside a block does not reach the blocks after it', () => {
    const ast = parseToAst(`=begin pod
=begin nested
=config head2 :folded

=head2 Inside
=end nested

=head2 After
=end pod`)
    const heads = findAll(ast, 'head')
    expect(heads.length).toBe(2)
    expect(makeAttrs(heads[0]).exists('folded')).toBe(true)
    expect(makeAttrs(heads[1]).exists('folded')).toBe(false)
  })

  it('a declaration reaches blocks nested deeper in the same scope', () => {
    const ast = parseToAst(`=begin pod
=config head2 :folded

=begin nested
=head2 Deeper
=end nested
=end pod`)
    const heads = findAll(ast, 'head')
    expect(heads.length).toBe(1)
    expect(makeAttrs(heads[0]).exists('folded')).toBe(true)
  })
})

describe('=config :allow reaches the markup-code parse', () => {
  it('opens a code block to a listed markup code', () => {
    const out = toHtml({})
      .run(
        `=begin pod
=config code :allow<B>

=begin code
B<loud> and C<run>
=end code
=end pod`,
      )
      .toString()
    expect(out).toContain('<strong>loud</strong>')
    expect(out).toContain('C&lt;run&gt;')
  })

  it('narrows the codes acting in a cell', () => {
    const out = toHtml({})
      .run(
        `=begin pod
=config cell :allow<B>

=begin table
=begin row
=for cell
B<loud> and C<run>
=end row
=end table
=end pod`,
      )
      .toString()
    expect(out).toContain('<strong>loud</strong>')
    expect(out).toContain('C&lt;run&gt;')
  })

  it('own :allow on the block wins over the declaration', () => {
    const out = toHtml({})
      .run(
        `=begin pod
=config cell :allow<B>

=begin table
=begin row
=for cell :allow<I>
I<slanted> and B<loud>
=end row
=end table
=end pod`,
      )
      .toString()
    expect(out).toContain('<em>slanted</em>')
    expect(out).toContain('B&lt;loud&gt;')
  })

  it('leaves a cell built from data as text', () => {
    const out = toHtml({})
      .run(
        `=begin pod
=config cell :allow<B>

=begin data-table :mime-type('text/csv; header=present')
name,value
bold,B<loud>
=end data-table
=end pod`,
      )
      .toString()
    expect(out).toContain('B&lt;loud&gt;')
    expect(out).not.toContain('<strong>loud</strong>')
  })
})

describe('=config lexical scope in export', () => {
  const src = `=begin pod
=begin nested
=config table :caption('CAP')

=begin table
a | b
=end table
=end nested

=begin table
c | d
=end table
=end pod`

  it('html keeps a declaration inside the block it sits in', () => {
    const out = toHtml({}).run(src).toString()
    expect(out.match(/<caption>CAP<\/caption>/g)).toHaveLength(1)
  })

  it('markdown keeps a declaration inside the block it sits in', () => {
    const out = toMarkdown({}).run(src).toString()
    expect(out.match(/CAP/g)).toHaveLength(1)
  })

  it('a declaration at document level reaches every block below it', () => {
    const out = toHtml({})
      .run(
        `=begin pod
=config table :caption('CAP')

=begin table
a | b
=end table

=begin nested
=begin table
c | d
=end table
=end nested
=end pod`,
      )
      .toString()
    expect(out.match(/<caption>CAP<\/caption>/g)).toHaveLength(2)
  })

  it('own attribute on the block still overrides the declaration', () => {
    const out = toHtml({})
      .run(
        `=begin pod
=config table :caption('CAP')

=begin table :caption('OWN')
a | b
=end table
=end pod`,
      )
      .toString()
    expect(out).toContain('<caption>OWN</caption>')
    expect(out).not.toContain('<caption>CAP</caption>')
  })
})
