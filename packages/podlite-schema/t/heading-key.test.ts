import {
  assignHeadingKeys,
  buildBindingIndex,
  fingerprint,
  getFromTree,
  indexAnchors,
  podlitePluggable,
  sameDocTarget,
  toFragment,
  toMarkdown,
} from '../src'

const keysOf = (tree: any): string[] => getFromTree(tree, 'head').map((h: any) => h.headingKey)
const parse = (text: string): any => {
  const p = podlitePluggable()
  return p.toAst(p.parse(text, { podMode: 1 }))
}

describe('the fingerprint a heading key carries', () => {
  // cyrb53 (bryc), seed 0, over UTF-16 code units: fourteen lowercase hex digits
  it.each([
    ['=head1 Привет\n', '18c528554f97a1'],
    ['', '0bdcb81aee8d83'],
    ['=head1 Same\n\n=comment azqi1m\n', '1b54e76bdce957'],
    ['=head1 Same\n\n=comment dwcx65\n', '09f29dba60f267'],
  ])('of %j is %s', (text, print) => {
    expect(fingerprint(text)).toBe(print)
  })
})

describe('the key a parse gives a heading', () => {
  it('numbers the headings of the tree in document order, not by their text', () => {
    const text = '=head1 Intro\n\n=head1 Intro\n\n=head2 Other\n'
    const print = fingerprint(text)
    expect(keysOf(parse(text))).toEqual([`h1.${print}`, `h2.${print}`, `h3.${print}`])
  })

  it('gives the same text the same keys and another text other keys', () => {
    expect(keysOf(parse('=head1 Same\n'))).toEqual(keysOf(parse('=head1 Same\n')))
    expect(keysOf(parse('=head1 Same\n'))).not.toEqual(keysOf(parse('=head1 Same\n\n=para x\n')))
  })

  it('keeps a key a heading already has when called again', () => {
    const tree = parse('=head1 One\n\n=head1 Two\n')
    const before = keysOf(tree)
    assignHeadingKeys(tree, 'another text')
    expect(keysOf(tree)).toEqual(before)
  })
})

// a tree with two headings of one name and a generated link to the second
const linked = (link: Record<string, unknown>) => {
  const tree = parse('=head1 Intro\n\n=head1 Intro\n\n=para link\n')
  const [, second] = getFromTree(tree, 'head') as any[]
  const node = { type: 'fcode', name: 'L', content: ['x'], ...link }
  const ctx = { __anchors: indexAnchors(tree), __bindings: buildBindingIndex(tree) }
  return { tree, second, node, ctx }
}

describe('a generated link bound by the key of its heading', () => {
  it('reaches the heading the key names, whatever its meta says', () => {
    const { second, node, ctx } = linked({})
    const target = { ...node, meta: '#Intro', headingRef: second.headingKey }
    expect(sameDocTarget(target.meta, ctx, ctx.__anchors, target)).toBe('#Intro-2')
  })

  it('has no address when no heading holds the key', () => {
    const { node, ctx } = linked({})
    const target = { ...node, meta: '#Intro', headingRef: 'h9.00000000000000' }
    expect(sameDocTarget(target.meta, ctx, ctx.__anchors, target)).toBeUndefined()
  })

  it('has no address when the output gave the heading no anchor', () => {
    const { second, node, ctx } = linked({})
    const target = { ...node, meta: '#Intro', headingRef: second.headingKey }
    const empty = { ...ctx.__anchors, byNode: new Map() }
    expect(sameDocTarget(target.meta, ctx, empty, target)).toBeUndefined()
  })

  it('keeps an author name apart: a block named with the key text does not take the link', () => {
    const text = '=head1 Intro\n\n=head1 Intro\n'
    const second = `h2.${fingerprint(text)}`
    const tree = parse(`${text}\n=for para :id<${second}>\nnamed\n`)
    const [, head] = getFromTree(tree, 'head') as any[]
    // the parse of the longer text gives other keys; the heading is keyed as the shorter one was
    head.headingKey = second
    const ctx = { __anchors: indexAnchors(tree), __bindings: buildBindingIndex(tree) }
    const generated = { type: 'fcode', name: 'L', meta: `#${second}`, headingRef: second }
    expect(sameDocTarget(generated.meta, ctx, ctx.__anchors, generated)).toBe('#Intro-2')
    const written = { type: 'fcode', name: 'L', meta: `#${second}` }
    // the author's link reaches the named block, at the anchor this output gives an explicit id
    expect(sameDocTarget(written.meta, ctx, ctx.__anchors, written)).toBe(`#${toFragment(second)}`)
  })

  // a tree, not a document an author writes: a generated link in an ordinary paragraph
  it('gives the markdown anchor of the keyed heading', () => {
    const tree = parse('=head1 Intro\n\n=head1 Intro\n\n=para link\n')
    const [, second] = getFromTree(tree, 'head') as any[]
    const [para] = getFromTree(tree, 'para') as any[]
    para.content = [{ type: 'fcode', name: 'L', meta: '#Intro', headingRef: second.headingKey, content: ['to second'] }]
    const md = String(toMarkdown({}).run(tree))
    expect(md).toContain('[to second](#intro-1)')
  })
})
