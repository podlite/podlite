import { podlitePluggable } from '../src/pluggableParser'
import { toMarkdown } from '../src'
import Writer from '../src/writer'

// the parser of this package, so a run against its earlier source reads that source
const p = podlitePluggable()
const tree = (doc: string) => p.toAst(p.parse(doc, { podMode: 1 }))
const markdown = (doc: string) => String(p.toMarkdown(tree(doc)))

const code = (body: string, attrs = '') => `=begin code${attrs}\n${body}=end code\n`

describe('the fence of a code block in markdown output', () => {
  it('is longer than a run of backticks in the body', () => {
    expect(markdown(code('before\n```\nafter\n') + '\n=para After\n')).toBe('````\nbefore\n```\nafter\n````\nAfter\n\n')
    expect(markdown(code('before\n````\nafter\n'))).toBe('`````\nbefore\n````\nafter\n`````\n')
  })

  it('writes a body that holds many runs of backticks', () => {
    expect(markdown(code('` '.repeat(130000) + '\n')).startsWith('```\n` ` `')).toBe(true)
  })

  it('counts a run of backticks anywhere in a line', () => {
    expect(markdown(code('before\n  ```\nafter\n'))).toBe('````\nbefore\n  ```\nafter\n````\n')
  })

  it('is longer than a run of backticks in an implicit code block', () => {
    expect(markdown('=begin pod\n\n    before\n    ```\n    after\n\n=para After\n=end pod\n')).toContain(
      '````\nbefore\n```\nafter\n````\n',
    )
  })

  it('closes on a line of its own when the code ends without a line break', () => {
    expect(markdown('=code single')).toBe('```\nsingle\n```\n')
  })

  it('opens on the line of the marker of an item and stays inside the item', () => {
    expect(markdown('=begin item\n=begin code\nx <y>\n=end code\n=end item\n')).toBe('- ```\n  x <y>\n  ```\n')
    expect(markdown('=begin nested\n=begin item\n=begin code\nx <y>\n=end code\n=end item\n=end nested\n')).toBe(
      '> - ```\n>   x <y>\n>   ```\n\n',
    )
  })

  it('opens on a line of its own after the term of a definition', () => {
    expect(markdown('=begin defn\nTerm\n=begin code\nfirst\nsecond\n=end code\n=end defn\n')).toContain(
      '**Term:** \n```\nfirst\nsecond\n```\n',
    )
  })

  it('keeps the cells after a code block in a cell of merged cells', () => {
    const doc =
      '=begin table\n=begin row\n=begin cell :colspan(2)\n=begin code\nbefore\n```\nafter\n=end code\n=end cell\n=cell Neighbor\n=end row\n=end table\n'
    expect(markdown(doc)).toContain(
      '<td colspan="2">\n\n````\nbefore\n```\nafter\n````\n\n</td>\n<td>\n\nNeighbor\n\n</td>',
    )
  })
})

describe('what stays as it was', () => {
  it('writes the language after the fence', () => {
    expect(markdown(code('a\nb\n', ' :lang<sh>'))).toBe('```sh\na\nb\n```\n')
  })

  it('writes a code block inside a quote with the sign of the quote on every line', () => {
    expect(markdown('=begin nested\n=begin code\nx\n=end code\n=end nested\n')).toBe('> ```\n> x\n> ```\n\n')
    expect(markdown('=begin nested :nested(2)\n=begin code\nx\n=end code\n=end nested\n')).toBe(
      '> > ```\n> > x\n> > ```\n\n',
    )
  })

  it('writes an empty code block and a body of tildes with three backticks', () => {
    expect(markdown(code(''))).toBe('```\n```\n')
    expect(markdown(code('before\n~~~\nafter\n'))).toBe('```\nbefore\n~~~\nafter\n```\n')
  })

  it('measures the fence on the hidden body of a masked block', () => {
    expect(markdown(code('before\n````\nafter\n', ' :masked'))).toBe('```\n██████\n████\n█████\n```\n')
  })

  it('writes the plain fence with a writer that has no output function', () => {
    const parts: string[] = []
    class Collecting extends Writer {
      writeRaw(str: string) {
        if (typeof str === 'string' && str !== '') this.lastWritten = str
        parts.push(str)
      }
    }
    toMarkdown({ writer: new Collecting() }).run(tree(code('before\n```\nafter\n')))
    expect(parts.join('')).toBe('```\nbefore\n```\nafter\n```\n')
  })
})
