import { toHtml, toMarkdown, parse } from '../src'

const asHtml = (pod: string): string => String(toHtml({}).run(pod).toString())
const asMarkdown = (pod: string): string => String(toMarkdown({}).run(pod).toString())

const codeNames = (pod: string): string[] => {
  const found: string[] = []
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    if (node.type === 'fcode') found.push(node.name)
    if (Array.isArray(node.content)) node.content.forEach(walk)
  }
  walk(parse(pod, { podMode: 1 }))
  return found
}

describe('the struck-out code', () => {
  it('is read as its own node', () => {
    expect(codeNames('=pod\nO<gone>\n')).toEqual(['O'])
  })

  it('renders as a deletion in html', () => {
    expect(asHtml('=pod\nO<gone>\n')).toContain('<del>gone</del>')
  })

  it('survives an export to markdown', () => {
    expect(asMarkdown('=pod\nO<gone>\n')).toContain('gone')
  })

  it('carries other codes inside', () => {
    expect(asHtml('=pod\nO<B<gone>>\n')).toContain('<del><strong>gone</strong></del>')
  })

  it('exports an empty one', () => {
    expect(() => asHtml('=pod\nO<>\n')).not.toThrow()
  })
})

describe('the raised and lowered codes', () => {
  it('are read as their own nodes', () => {
    expect(codeNames('=pod\nH<up> and J<down>\n')).toEqual(['H', 'J'])
  })

  it('render as superscript and subscript', () => {
    const html = asHtml('=pod\nx H<2> and y J<3>\n')
    expect(html).toContain('<sup>2</sup>')
    expect(html).toContain('<sub>3</sub>')
  })

  it('nest one inside the other', () => {
    expect(asHtml('=pod\nH<J<deep>>\n')).toContain('<sup><sub>deep</sub></sup>')
  })

  it('export empty ones', () => {
    expect(() => asHtml('=pod\nH<> J<>\n')).not.toThrow()
  })
})
