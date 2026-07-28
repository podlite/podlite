import { podlitePluggable } from '../src/pluggableParser'

const parseToAst = (src: string) => {
  const p = podlitePluggable()
  return p.toAst(p.parse(src, { podMode: 1 }))
}

const findBlock = (node: any, name: string): any => {
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findBlock(n, name)
      if (found) return found
    }
    return null
  }
  if (!node || typeof node !== 'object') return null
  if (node.type === 'block' && node.name === name) return node
  if (node.content) return findBlock(node.content, name)
  return null
}

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

const attr = (block: any, name: string) => (block?.config || []).find((c: any) => c.name === name)

describe('=set directive', () => {
  it('assigns configuration syntax attributes to the next block', () => {
    const table = findBlock(
      parseToAst(`=set :caption('Product comparison') :id<table-1>\n\n=begin table\nA | B\n=end table\n`),
      'table',
    )
    expect(attr(table, 'caption')).toMatchObject({ value: 'Product comparison' })
    expect(attr(table, 'id')).toMatchObject({ value: 'table-1' })
  })

  it('joins a multiline alias value with single spaces', () => {
    const src = [
      '=set :caption Selected B<chemical> elements with their',
      '=          L<atomic numbers|#elements> and symbols',
      '',
      '=begin table',
      'A | B',
      '=end table',
      '',
    ].join('\n')
    const table = findBlock(parseToAst(src), 'table')
    expect(attr(table, 'caption').value).toBe(
      'Selected B<chemical> elements with their L<atomic numbers|#elements> and symbols',
    )
  })

  it('mixes configuration and alias continuation lines', () => {
    const src = [
      '=set :id<special-table>',
      '=    :folded<true>',
      '=set :caption Product Metrics',
      '=          with detailed analysis',
      '',
      '=begin table',
      'A | B',
      '=end table',
      '',
    ].join('\n')
    const table = findBlock(parseToAst(src), 'table')
    expect(attr(table, 'id').value).toBe('special-table')
    expect(attr(table, 'folded').value).toBe('true')
    expect(attr(table, 'caption').value).toBe('Product Metrics with detailed analysis')
  })

  it('passes through directives and comment blocks to the next real block', () => {
    const src = [
      '=set :caption Renewable energy',
      '=config table :width<100%>',
      '=alias COMPANY Acme Corp',
      '=comment Approved',
      '=begin table',
      'A | B',
      '=end table',
      '',
    ].join('\n')
    const table = findBlock(parseToAst(src), 'table')
    expect(attr(table, 'caption').value).toBe('Renewable energy')
  })

  it('keeps the last assignment when the same key repeats', () => {
    const src = [
      '=set :caption First',
      '=set :caption Revised version',
      '',
      '=begin table',
      'A | B',
      '=end table',
      '',
    ].join('\n')
    expect(attr(findBlock(parseToAst(src), 'table'), 'caption').value).toBe('Revised version')
  })

  it('yields to an explicit attribute on the block declaration', () => {
    const src = ['=set :caption Set-value', `=begin table :caption('Explicit')`, 'A | B', '=end table', ''].join('\n')
    expect(attr(findBlock(parseToAst(src), 'table'), 'caption').value).toBe('Explicit')
  })

  it('treats a bare attribute as boolean true and a bang form as false', () => {
    const src = ['=set :numbered', '=set :!folded', '=head1 Title', ''].join('\n')
    const head = findBlock(parseToAst(src), 'head')
    expect(attr(head, 'numbered').value).toBe(true)
    expect(attr(head, 'folded').value).toBe(false)
  })

  it('applies to the next block only', () => {
    const heads = findAll(parseToAst('=set :lang<en>\n=head1 First\n\n=head1 Second\n'), 'head')
    expect(attr(heads[0], 'lang').value).toBe('en')
    expect(attr(heads[1], 'lang')).toBeUndefined()
  })

  it('warns when no target block follows in scope', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    parseToAst('=head1 Title\n\n=set :caption Orphan\n')
    expect(spy.mock.calls.some(c => String(c[0]).includes('no target block'))).toBe(true)
    spy.mockRestore()
  })

  it('removes the set node from the tree', () => {
    const tree = parseToAst(`=set :id<x>\n=head1 Title\n`)
    const hasSet = JSON.stringify(tree).includes('"type":"set"')
    expect(hasSet).toBe(false)
  })
})
