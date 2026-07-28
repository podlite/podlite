import { toHtml } from '../src'

const render = (pod: string): string => toHtml({}).run(pod).toString()
const body = (html: string): string => (html.match(/<li[^>]*>([\s\S]*?)<\/li>/) || ['', ''])[1]

// The spec states the shorthand forms are equivalent to the attributes:
// "[ ] ... it eqvivalent of :checked attribute" and "if the first word of the
// item consists of a single # character, the item is treated as having a
// :numbered option". Equivalence is testable, so it is tested.
describe('item markers keep the parsed line', () => {
  const inline = 'text with L<label|#A> and C<code> and B<bold>'

  it('checkbox shorthand matches the checked attribute', () => {
    const shorthand = body(render(`=pod\n=for item\n[ ] ${inline}\n`))
    const attribute = body(render(`=pod\n=for item :!checked\n${inline}\n`))
    expect(shorthand).toEqual(attribute)
  })

  it('numbered shorthand matches the numbered attribute', () => {
    const shorthand = body(render(`=pod\n=for item\n# ${inline}\n`))
    const attribute = body(render(`=pod\n=for item :numbered\n${inline}\n`))
    expect(shorthand).toEqual(attribute)
  })

  it('marker is removed from the text', () => {
    const html = render(`=pod\n=for item\n[x] done\n`)
    expect(html).toContain('checked')
    expect(html).not.toContain('[x]')
  })

  it('formatting survives after a checkbox', () => {
    const html = render(`=pod\n=for item\n[ ] ${inline}\n`)
    expect(html).toContain('<a href="#A">label</a>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('<strong>bold</strong>')
  })
})
