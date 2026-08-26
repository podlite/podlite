import { podlitePluggable, toHtml, toMarkdown, applyFoldedSections } from '../src'

const parse = (src: string) => {
  const p = podlitePluggable()
  return p.toAst(p.parse(src, { podMode: 1 }))
}
const asHtml = (src: string) => String(toHtml({}).run(parse(src)).toString())
const asMarkdown = (src: string) => String(toMarkdown({}).run(parse(src)).toString())

const namesIn = (tree: any): string[] => {
  const found: string[] = []
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    if (node.name) found.push(node.name)
    if (Array.isArray(node.content)) node.content.forEach(walk)
  }
  walk(tree)
  return found
}

const folded = [
  '=for head1 :folded',
  'Folded section',
  '',
  'text under the heading',
  '',
  '=head1 Next',
  '',
  'other',
  '',
].join('\n')

describe('a section folded by its heading', () => {
  it('is grouped while the tree is built, before any renderer sees it', () => {
    expect(namesIn(parse(folded))).toContain('_folded_section')
  })

  it('renders as a native disclosure in html', () => {
    const html = asHtml(folded)
    expect(html).toContain('<details class="folded-section"')
    expect(html).toContain('<summary class="folded-section-summary">')
    expect(html).toContain('text under the heading')
  })

  it('leaves the following heading outside the fold', () => {
    const html = asHtml(folded)
    const closed = html.indexOf('</details>')
    expect(closed).toBeGreaterThan(-1)
    expect(html.indexOf('Next')).toBeGreaterThan(closed)
  })

  it('opens the disclosure when the attribute says so', () => {
    const src = '=for head1 :folded(0)\nHeading\n\nbody text\n'
    expect(asHtml(src)).toContain('<details class="folded-section" open>')
  })

  it('writes the whole section out in markdown, which has no disclosure', () => {
    expect(namesIn(parse(folded))).toContain('_folded_section')
    const md = asMarkdown(folded)
    expect(md).toContain('# Folded section')
    expect(md).toContain('text under the heading')
    expect(md).not.toContain('<details')
  })

  it('leaves a document with no folded heading untouched', () => {
    const plain = '=head1 One\n\ntext\n'
    expect(asHtml(plain)).not.toContain('folded-section')
  })

  it('is idempotent, so a second pass changes nothing', () => {
    const once = parse(folded)
    const twice = applyFoldedSections(once)
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once))
  })
})
