import { toHtml, toMarkdown } from '../src'

const asHtml = (pod: string): string => String(toHtml({}).run(pod).toString())
const asMarkdown = (pod: string): string => String(toMarkdown({}).run(pod).toString())

describe('the space-preserving code', () => {
  it('keeps its spaces in markdown', () => {
    expect(asMarkdown('=pod\nS<a   b>\n')).toContain('a&nbsp;&nbsp;&nbsp;b')
  })

  it('keeps its spaces in html', () => {
    expect(asHtml('=pod\nS<a   b>\n')).toContain('a&nbsp;&nbsp;&nbsp;b')
  })

  it('exports an empty one', () => {
    expect(() => asMarkdown('=pod\nS<>\n')).not.toThrow()
    expect(() => asHtml('=pod\nS<>\n')).not.toThrow()
  })
})
