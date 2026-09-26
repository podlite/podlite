import { podlitePluggable } from '../src/pluggableParser'
import { applySetToFirst, mergeSet } from '../src/set-assign'
import { ConfigItem } from '../src/types'

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

const attr = (block: any, name: string) => (block?.config || []).find((c: any) => c.name === name)

const item = (name: string, value: any, from?: 'set' | 'config'): ConfigItem =>
  from ? { name, value, type: 'string', from } : { name, value, type: 'string' }

const block = (name: string, config: any[] = [], content: any[] = []) => ({ type: 'block', name, config, content })

describe('=set before =include', () => {
  it('keeps the assignments on the include and gives nothing to the block after it', () => {
    const tree = parseToAst('=set :id<intro>\n=include file:./part.podlite\n\n=head1 After\n')
    const include = findBlock(tree, 'include')
    expect(include.set).toEqual([expect.objectContaining({ name: 'id', value: 'intro', from: 'set' })])
    expect(attr(include, 'id')).toBeUndefined()
    expect(attr(findBlock(tree, 'head'), 'id')).toBeUndefined()
  })

  it('warns only about the assignment written after the include', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    parseToAst('=set :id<intro>\n=include file:./part.podlite\n\n=set :caption Orphan\n')
    const warnings = spy.mock.calls.map(c => String(c[0])).filter(s => s.includes('no target block'))
    spy.mockRestore()
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/: caption$/)
  })
})

describe('where a value came from', () => {
  it('marks a =set value and a =config default, and leaves a written one unmarked', () => {
    const src = [
      '=config table :width<100%>',
      '=set :caption Renewable',
      '=begin table :id<t1>',
      'A | B',
      '=end table',
      '',
    ].join('\n')
    const tree = parseToAst(src)
    const table = findBlock(tree, 'table')
    expect(attr(table, 'caption').from).toBe('set')
    expect(attr(table, 'width').from).toBe('config')
    expect(attr(table, 'id').from).toBeUndefined()
  })

  it('does not mark the item on the =config directive itself', () => {
    const src = ['=config table :width<100%>', '=begin table', 'A | B', '=end table', ''].join('\n')
    const tree = parseToAst(src)
    const directive = JSON.stringify(tree).match(/"type":"config"[^]*?"config":\[[^\]]*\]/)
    expect(directive).not.toBeNull()
    expect(directive![0]).not.toContain('"from"')
  })
})

describe('mergeSet', () => {
  it('lets a later item replace an earlier one of the same name, keeping first order', () => {
    const merged = mergeSet([item('id', 'a'), item('caption', 'x')], [item('id', 'b'), item('lang', 'en')])
    expect(merged.map(c => [c.name, c.value])).toEqual([
      ['id', 'b'],
      ['caption', 'x'],
      ['lang', 'en'],
    ])
  })
})

describe('applySetToFirst', () => {
  const set = [item('id', 'intro', 'set')]

  it('skips nodes transparent to =set targeting', () => {
    const nodes = [
      { type: 'blankline' },
      { type: 'config', name: 'table', config: [] },
      block('comment'),
      block('head', [], ['Title']),
    ]
    const { nodes: out, outcome } = applySetToFirst(nodes, set, { mode: 'include' })
    expect(outcome).toBe('block')
    expect(attr(out[3], 'id')).toMatchObject({ value: 'intro', from: 'set' })
    expect(attr(out[2], 'id')).toBeUndefined()
  })

  it('looks inside root and _folded_section, and takes pod as a target', () => {
    const pod = block('pod', [], [block('head', [], ['Inside'])])
    const nodes = [block('root', [], [block('_folded_section', [], [pod])])]
    const { nodes: out, outcome } = applySetToFirst(nodes, set, { mode: 'include' })
    expect(outcome).toBe('block')
    const target = out[0].content[0].content[0]
    expect(target.name).toBe('pod')
    expect(attr(target, 'id')).toMatchObject({ value: 'intro' })
    expect(attr(target.content[0], 'id')).toBeUndefined()
  })

  it('keeps a written attribute and a =set value, and replaces a =config value in place', () => {
    const head = block('head', [item('caption', 'written'), item('id', 'inner', 'set'), item('lang', 'ru', 'config')])
    const incoming = [item('caption', 'outer', 'set'), item('id', 'outer', 'set'), item('lang', 'en', 'set')]
    const { nodes: out } = applySetToFirst([head], incoming, { mode: 'include' })
    expect(out[0].config.map((c: any) => [c.name, c.value, c.from])).toEqual([
      ['caption', 'written', undefined],
      ['id', 'inner', 'set'],
      ['lang', 'en', 'set'],
    ])
  })

  it('in carry mode replaces only a =config default', () => {
    const head = block('head', [item('id', 'own', 'set'), item('lang', 'ru', 'config')])
    const incoming = [item('id', 'carried', 'set'), item('lang', 'en', 'set')]
    const { nodes: out } = applySetToFirst([head], incoming, { mode: 'carry' })
    expect(out[0].config.map((c: any) => [c.name, c.value])).toEqual([
      ['id', 'own'],
      ['lang', 'en'],
    ])
  })

  it('gives the assignments to an include met first, behind its own', () => {
    const include = { ...block('include'), set: [item('id', 'own', 'set')] }
    const { nodes: out, outcome } = applySetToFirst(
      [include, block('head')],
      [item('id', 'outer', 'set'), item('lang', 'en', 'set')],
      { mode: 'include' },
    )
    expect(outcome).toBe('include')
    expect(out[0].set.map((c: any) => [c.name, c.value])).toEqual([
      ['id', 'own'],
      ['lang', 'en'],
    ])
    expect(attr(out[1], 'id')).toBeUndefined()
  })

  it('leaves the given nodes unchanged and carries their origin to the copies', () => {
    const text = { type: 'para', content: ['x'] }
    const head = block('head', [], [text])
    const nodes = [head]
    const origin = new WeakMap<object, any>([
      [head, { file: 'part.podlite' }],
      [text, { file: 'part.podlite' }],
    ])
    const before = JSON.stringify(nodes)
    const { nodes: out } = applySetToFirst(nodes, set, { mode: 'include', origin })
    expect(JSON.stringify(nodes)).toBe(before)
    expect(out[0]).not.toBe(head)
    expect(origin.get(out[0])).toEqual({ file: 'part.podlite' })
    expect(origin.get(out[0].content[0])).toEqual({ file: 'part.podlite' })
  })

  it('marks a target that receives :masked as guarded', () => {
    const { nodes: out } = applySetToFirst([block('para', [], ['secret'])], [item('masked', true, 'set')], {
      mode: 'include',
    })
    expect(out[0].guarded).toBe(true)
  })

  it('reports none when no block is found', () => {
    const nodes = [{ type: 'blankline' }, block('comment')]
    const { nodes: out, outcome } = applySetToFirst(nodes, set, { mode: 'include' })
    expect(outcome).toBe('none')
    expect(out).toEqual(nodes)
  })
})
